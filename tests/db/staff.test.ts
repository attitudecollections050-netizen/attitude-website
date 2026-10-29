import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: staff roles (owner vs Product Staff)", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let owner: string, staffer: string, deleter: string, customer: string, disabled: string;
  let categoryId: string;
  const user = (id: string) => ({ role: "authenticated" as const, userId: id });

  beforeAll(async () => {
    const t = await createTestDatabase("ac_staff_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    owner = await createUser(db, "owner@example.com");
    staffer = await createUser(db, "staff@example.com");
    deleter = await createUser(db, "deleter@example.com");
    customer = await createUser(db, "customer@example.com");
    disabled = await createUser(db, "gone@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    for (const [id, email, canDelete, status] of [[staffer, "staff@example.com", false, "active"], [deleter, "deleter@example.com", true, "active"], [disabled, "gone@example.com", false, "disabled"]] as const) {
      await db.query(`insert into staff_members (user_id, email, role, status, can_delete_products) values ($1, $2, 'product_staff', $3, $4)`, [id, email, status, canDelete]);
      await db.query(`insert into user_roles (user_id, role) values ($1, 'product_staff')`, [id]);
    }
    categoryId = (await db.query(`select id from categories limit 1`)).rows[0].id;
    await db.query(`grant select, insert, update, delete on storage.objects to authenticated`);
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  const newProduct = (who: string, slug: string) =>
    as(db, user(who), () =>
      db.query(`insert into products (name, slug, description, category_id, price, status) values ('Test', $1, '', $2, 1000000, 'draft') returning id`, [slug, categoryId]),
    );

  it("Product Staff can create, read (drafts), edit and stock products", async () => {
    const { rows } = await newProduct(staffer, "staff-made");
    const id = rows[0].id;
    const read = await as(db, user(staffer), () => db.query(`select id from products where id = $1`, [id]));
    expect(read.rowCount).toBe(1);
    const upd = await as(db, user(staffer), () => db.query(`update products set name = 'Renamed', price = 1200000 where id = $1 returning id`, [id]));
    expect(upd.rowCount).toBe(1);
    const v = await as(db, user(staffer), () => db.query(`insert into product_variants (product_id, sku, size, color) values ($1, 'SKU-STAFF-1', 'M', 'Black') returning id`, [id]));
    await as(db, user(staffer), () => db.query(`select public.admin_set_stock($1, 7, 'staff test')`, [v.rows[0].id]));
    expect((await db.query(`select on_hand from inventory where variant_id = $1`, [v.rows[0].id])).rows[0].on_hand).toBe(7);
    const img = await as(db, user(staffer), () => db.query(`insert into product_images (product_id, url, alt) values ($1, 'https://example.com/a.jpg', 'a') returning id`, [id]));
    expect(img.rowCount).toBe(1);
  });

  it("Product Staff can't delete products unless the owner allows it", async () => {
    const a = (await newProduct(staffer, "keep-me")).rows[0].id;
    const del = await as(db, user(staffer), () => db.query(`delete from products where id = $1 returning id`, [a]));
    expect(del.rowCount).toBe(0);
    expect((await db.query(`select 1 from products where id = $1`, [a])).rowCount).toBe(1);
    const b = (await newProduct(deleter, "delete-me")).rows[0].id;
    const del2 = await as(db, user(deleter), () => db.query(`delete from products where id = $1 returning id`, [b]));
    expect(del2.rowCount).toBe(1);
  });

  it("Product Staff are denied orders, customers, payments, settings, suppliers, discounts and staff data", async () => {
    // Real sensitive rows, so "nothing returned" means "denied", not "empty table".
    await db.query(`insert into store_settings (key, value, is_public) values ('secret_test', '{"x":1}', false) on conflict (key) do nothing`);
    await db.query(`insert into suppliers (name) values ('Supplier X')`);
    await db.query(`insert into addresses (user_id, full_name, phone, country_code, city, line1) values ($1, 'Ada Customer', '+2348000000000', 'NG', 'Lagos', '12 Allen Avenue')`, [customer]);
    const order = await db.query(
      `insert into orders (email, phone, customer_name, shipping_address, shipping_method_name, currency, subtotal, discount_total, shipping_fee, tax_total, total, status, payment_status, idempotency_key, user_id)
       values ('customer@example.com', '+2348000000000', 'Ada Customer', '{}'::jsonb, 'Standard', 'NGN', 1000000, 0, 0, 0, 1000000, 'paid', 'paid', 'staff-test-1', $1) returning id`,
      [customer],
    );
    await db.query(`insert into payments (order_id, reference, amount, currency, status) values ($1, 'ref-staff-test', 1000000, 'NGN', 'success')`, [order.rows[0].id]);
    await db.query(`insert into contact_messages (name, email, subject, message) values ('Ada', 'customer@example.com', 'Hi', 'A private message')`);
    for (const table of ["orders", "payments", "suppliers", "contact_messages"]) {
      expect((await as(db, user(owner), () => db.query(`select 1 from ${table}`))).rowCount, `owner sees ${table}`).toBeGreaterThan(0);
    }
    for (const [sql, label] of [
      [`select * from orders`, "orders"],
      [`select * from payments`, "payments"],
      [`select * from profiles where id <> auth.uid()`, "other people's profiles"],
      [`select * from addresses`, "addresses"],
      [`select * from suppliers`, "suppliers"],
      [`select * from product_supplier_info`, "supplier costs"],
      [`select * from discounts`, "discounts"],
      [`select * from store_settings where key = 'secret_test'`, "private settings"],
      [`select * from staff_members where user_id <> auth.uid()`, "other staff"],
      [`select * from user_roles where user_id <> auth.uid()`, "other people's roles"],
      [`select * from exchange_rate_log`, "rate log"],
      [`select * from contact_messages`, "messages"],
    ] as const) {
      const r = await as(db, user(staffer), () => db.query(sql));
      expect(r.rowCount, label).toBe(0);
    }
    await expect(as(db, user(staffer), () => db.query(`select public.admin_dashboard_stats()`))).rejects.toThrow();
    await expect(as(db, user(staffer), () => db.query(`select public.admin_analytics_report(current_date - 7, current_date, 'Africa/Lagos', 'day')`))).rejects.toThrow();
    await expect(as(db, user(staffer), () => db.query(`insert into categories (name, slug) values ('Nope', 'nope')`))).rejects.toThrow();
    const settings = await as(db, user(staffer), () => db.query(`update store_settings set value = '{}' where key = 'store' returning key`));
    expect(settings.rowCount).toBe(0);
  });

  it("nobody can give themselves a role or edit staff records through the API", async () => {
    await expect(as(db, user(staffer), () => db.query(`insert into user_roles (user_id, role) values ($1, 'admin')`, [staffer]))).rejects.toThrow();
    await expect(as(db, user(customer), () => db.query(`insert into user_roles (user_id, role) values ($1, 'product_staff')`, [customer]))).rejects.toThrow();
    const r = await as(db, user(staffer), () => db.query(`update staff_members set can_delete_products = true where user_id = $1 returning user_id`, [staffer]));
    expect(r.rowCount).toBe(0);
    expect((await as(db, user(staffer), () => db.query(`select status from staff_members`))).rows).toEqual([{ status: "active" }]);
  });

  it("disabled staff and customers can't manage products", async () => {
    for (const who of [disabled, customer]) {
      await expect(newProduct(who, `nope-${who.slice(0, 6)}`)).rejects.toThrow();
      const r = await as(db, user(who), () => db.query(`select id from products where status = 'draft'`));
      expect(r.rowCount).toBe(0);
    }
    await expect(as(db, user(customer), () => db.query(`select public.admin_set_stock(gen_random_uuid(), 1, null)`))).rejects.toThrow(/forbidden/);
  });

  it("product image storage: owner and Product Staff only, and only the product-images bucket", async () => {
    const put = (who: string, bucket: string) =>
      as(db, user(who), () => db.query(`insert into storage.objects (bucket_id, name) values ($1, 'p/x.jpg') returning id`, [bucket]));
    expect((await put(staffer, "product-images")).rowCount).toBe(1);
    expect((await put(owner, "product-images")).rowCount).toBe(1);
    await expect(put(customer, "product-images")).rejects.toThrow();
    await expect(put(disabled, "product-images")).rejects.toThrow();
    await expect(put(staffer, "banners")).rejects.toThrow();
    const bucket = (await db.query(`select file_size_limit, allowed_mime_types from storage.buckets where id = 'product-images'`)).rows[0];
    expect(Number(bucket.file_size_limit)).toBe(5242880);
    expect(bucket.allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  });

  it("the owner keeps full access and can't be removed or turned into staff", async () => {
    expect((await newProduct(owner, "owner-made")).rowCount).toBe(1);
    expect((await as(db, user(owner), () => db.query(`select * from staff_members`))).rowCount).toBe(3);
    await expect(db.query(`delete from user_roles where user_id = $1 and role = 'admin'`, [owner])).rejects.toThrow(/owner role cannot be removed/);
    await expect(db.query(`insert into staff_members (user_id, email, role) values ($1, 'owner@example.com', 'product_staff')`, [owner])).rejects.toThrow(/owner account/);
    await expect(db.query(`insert into staff_members (user_id, email, role) values ($1, 'c@example.com', 'admin')`, [customer])).rejects.toThrow();
  });
});
