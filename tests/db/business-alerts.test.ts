import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: business alerts (orders, payments, transfers, low stock) + per-device alert types", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let owner: string, staff: string, customer: string;
  let n = 0;
  const user = (id: string) => ({ role: "authenticated" as const, userId: id });
  const alerts = async () => (await db.query(`select kind, category, title, message, link from admin_alerts order by created_at desc, id`)).rows;
  const latest = async () => (await alerts())[0];
  const newOrder = async (name = "Okoh Chris", total = 3250000, method = "paystack") => {
    n += 1;
    return (await db.query(
      `insert into orders (email, phone, customer_name, shipping_address, shipping_method_name, currency, subtotal, discount_total, shipping_fee, tax_total, total, status, payment_status, idempotency_key, payment_method)
       values ('c@example.com', '+2348000000000', $1, '{}'::jsonb, 'Standard', 'NGN', $2, 0, 0, 0, $2, 'pending_payment', 'unpaid', $3, $4) returning id, order_number`,
      [name, total, `alerts-${n}`, method],
    )).rows[0] as { id: string; order_number: string };
  };

  beforeAll(async () => {
    const t = await createTestDatabase("ac_alerts_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    owner = await createUser(db, "owner@example.com");
    staff = await createUser(db, "ada@example.com");
    customer = await createUser(db, "customer@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    await db.query(`insert into staff_members (user_id, email, full_name, role, status) values ($1, 'ada@example.com', 'Ada', 'product_staff', 'active')`, [staff]);
    await db.query(`insert into user_roles (user_id, role) values ($1, 'product_staff')`, [staff]);
  });
  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  it("new order: 🛒 New Order! [ID] - ₦[amount] - [Customer]. Tap to view → /admin/orders/[id]", async () => {
    const o = await newOrder();
    expect(await latest()).toEqual({
      kind: "order_new", category: "orders", title: "🛒 New Order!",
      message: `${o.order_number} - ₦32,500 - Okoh Chris. Tap to view.`, link: `/admin/orders/${o.id}`,
    });
  });

  it("payment received shows the amount, order, customer and method (Paystack channel / Bank transfer)", async () => {
    const o = await newOrder("Ngozi Ade", 1250050);
    await db.query(`insert into payments (order_id, reference, amount, currency, status, channel, paid_at) values ($1, $2, 1250050, 'NGN', 'success', 'card', now())`, [o.id, `ref-${o.id}`]);
    await db.query(`update orders set payment_status = 'paid', status = 'paid', paid_at = now() where id = $1`, [o.id]);
    expect(await latest()).toMatchObject({ kind: "payment_received", category: "payments", title: "💰 Payment Received!", message: `₦12,500.50 for Order ${o.order_number} - Ngozi Ade. Method: Paystack (card)` });
    const b = await newOrder("Bisi Bank", 500000, "bank_transfer");
    await db.query(`update orders set payment_status = 'paid' where id = $1`, [b.id]);
    expect((await latest()).message).toBe(`₦5,000 for Order ${b.order_number} - Bisi Bank. Method: Bank transfer`);
    // updating a paid order again doesn't repeat the alert
    const count = (await alerts()).length;
    await db.query(`update orders set status = 'processing' where id = $1`, [b.id]);
    expect((await alerts()).length).toBe(count);
  });

  it("payment failed: ❌ Payment Failed - Order [ID] - ₦[amount] - customer tried to pay", async () => {
    const o = await newOrder("Tunde Try", 900000);
    await db.query(`update orders set payment_status = 'failed' where id = $1`, [o.id]);
    expect(await latest()).toMatchObject({ kind: "payment_failed", category: "payments", title: "❌ Payment Failed", message: `Order ${o.order_number} - ₦9,000 - Tunde Try tried to pay` });
  });

  it("bank transfer claim: owner is told to check the bank", async () => {
    const o = await newOrder("Chi Transfer", 2000000, "bank_transfer");
    const p = (await db.query(`insert into payments (order_id, reference, amount, currency, provider) values ($1, $2, 2000000, 'NGN', 'bank_transfer') returning id`, [o.id, `bt-${o.id}`])).rows[0].id;
    const c = (await db.query(`insert into payment_claims (order_id, payment_id, customer_name, amount_paid, transfer_reference, whatsapp) values ($1, $2, 'Chi Transfer', 2000000, 'FBN12345', '+2348011111111') returning id`, [o.id, p])).rows[0].id;
    expect(await latest()).toMatchObject({ kind: "transfer_claim", category: "payments", link: `/admin/transfers/${c}`, message: `Chi Transfer says they sent ₦20,000 for Order ${o.order_number} (ref FBN12345). Check your bank, then confirm.` });
  });

  it("order shipped, delivered, cancelled, and delivery failed (cancelled after shipping)", async () => {
    const o = await newOrder("Shola Ship");
    await db.query(`update orders set payment_status = 'paid', status = 'paid' where id = $1`, [o.id]);
    await db.query(`update orders set status = 'shipped' where id = $1`, [o.id]);
    expect(await latest()).toMatchObject({ kind: "order_shipped", title: "🚚 Order Shipped" });
    await db.query(`update orders set status = 'delivered' where id = $1`, [o.id]);
    expect(await latest()).toMatchObject({ kind: "order_delivered", title: "✅ Order Delivered" });
    const f = await newOrder("Femi Fail");
    await db.query(`update orders set payment_status = 'paid', status = 'in_transit' where id = $1`, [f.id]);
    await db.query(`update orders set status = 'cancelled' where id = $1`, [f.id]);
    expect(await latest()).toMatchObject({ kind: "delivery_failed", title: "⚠️ Delivery Failed", message: `Order ${f.order_number} - Femi Fail was cancelled after it was in transit. Check with the customer and courier.` });
    const c = await newOrder("Cancel Early");
    await db.query(`update orders set status = 'cancelled' where id = $1`, [c.id]);
    expect(await latest()).toMatchObject({ kind: "order_cancelled", title: "🚫 Order Cancelled" });
  });

  it("low stock: once when it drops to the low-stock level, once when sold out; drafts ignored", async () => {
    const cat = (await db.query(`select id from categories limit 1`)).rows[0].id;
    const p = (await db.query(`insert into products (name, slug, description, category_id, price, status) values ('Pink Satin Dress', 'alert-dress', '', $1, 100000, 'published') returning id`, [cat])).rows[0].id;
    const v = (await db.query(`insert into product_variants (product_id, sku, size, color) values ($1, 'ALERT-M', 'M', 'Pink') returning id`, [p])).rows[0].id;
    await db.query(`insert into inventory (variant_id, on_hand, low_stock_threshold) values ($1, 10, 3)`, [v]);
    const before = (await alerts()).length;
    await db.query(`update inventory set on_hand = 5 where variant_id = $1`, [v]);
    expect((await alerts()).length).toBe(before); // still fine
    await db.query(`update inventory set on_hand = 3 where variant_id = $1`, [v]);
    expect(await latest()).toEqual({ kind: "low_stock", category: "low_stock", title: "📦 Low Stock", message: "Pink Satin Dress (M / Pink) — only 3 left.", link: `/admin/products/${p}` });
    await db.query(`update inventory set on_hand = 2 where variant_id = $1`, [v]);
    expect((await alerts()).length).toBe(before + 1); // no repeat on every sale
    await db.query(`update inventory set on_hand = 0 where variant_id = $1`, [v]);
    expect(await latest()).toMatchObject({ kind: "out_of_stock", title: "⛔ Sold Out", message: "Pink Satin Dress (M / Pink) is out of stock. Restock it or hide it." });
    const d = (await db.query(`insert into products (name, slug, description, category_id, price, status) values ('Draft', 'alert-draft', '', $1, 100000, 'draft') returning id`, [cat])).rows[0].id;
    const dv = (await db.query(`insert into product_variants (product_id, sku) values ($1, 'ALERT-D') returning id`, [d])).rows[0].id;
    const c2 = (await alerts()).length;
    await db.query(`insert into inventory (variant_id, on_hand) values ($1, 0)`, [dv]);
    expect((await alerts()).length).toBe(c2);
  });

  it("only the owner can read alerts; nobody can write them", async () => {
    expect((await as(db, user(owner), () => db.query(`select * from admin_alerts`))).rowCount).toBeGreaterThan(5);
    expect((await as(db, user(staff), () => db.query(`select * from admin_alerts`))).rowCount).toBe(0);
    expect((await as(db, user(customer), () => db.query(`select * from admin_alerts`))).rowCount).toBe(0);
    await expect(as(db, user(owner), () => db.query(`insert into admin_alerts (category, kind, title, message) values ('payments', 'payment_received', 'x', 'x')`))).rejects.toThrow();
    await expect(as(db, user(owner), () => db.query(`select add_admin_alert('payments', 'payment_received', 'x', 'x', null)`))).rejects.toThrow();
  });

  it("each device chooses its alerts (all on by default); only its owner can change them", async () => {
    const dev = (await as(db, user(owner), () => db.query(`insert into push_subscriptions (user_id, endpoint, subscription_json, device_name) values ($1, 'https://push.example.com/o1', '{}', 'Chrome on Mac') returning id, alert_types`, [owner]))).rows[0];
    expect(dev.alert_types).toEqual(["staff_work", "orders", "payments", "low_stock"]);
    const set = await as(db, user(owner), () => db.query(`select set_push_alert_types($1, $2::text[]) as t`, [dev.id, ["payments", "orders"]]));
    expect(set.rows[0].t).toEqual(["orders", "payments"]);
    await expect(as(db, user(owner), () => db.query(`select set_push_alert_types($1, $2::text[])`, [dev.id, ["spam"]]))).rejects.toThrow(/invalid_alert_types/);
    await expect(as(db, user(staff), () => db.query(`select set_push_alert_types($1, $2::text[])`, [dev.id, ["payments"]]))).rejects.toThrow(/not_found/);
    expect((await db.query(`select alert_types from push_subscriptions where id = $1`, [dev.id])).rows[0].alert_types).toEqual(["orders", "payments"]);
  });
});
