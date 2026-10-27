import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: catalogue, RLS, orders and payments", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let alice: string, bob: string, admin: string, staff: string;

  beforeAll(async () => {
    const t = await createTestDatabase("ac_test_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    alice = await createUser(db, "alice@example.com");
    bob = await createUser(db, "bob@example.com");
    admin = await createUser(db, "owner@example.com");
    staff = await createUser(db, "staff@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    await db.query(`select public.grant_role_by_email('staff@example.com', 'staff')`);
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  // ------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------
  async function variant(sku: string) {
    const { rows } = await db.query(
      `select v.id, v.sku, p.id as product_id, p.name, p.slug, coalesce(p.sale_price, p.price) as unit_price, i.on_hand
       from product_variants v join products p on p.id = v.product_id join inventory i on i.variant_id = v.id where v.sku = $1`,
      [sku],
    );
    return rows[0];
  }
  async function anyInStockVariant(minStock = 3) {
    const { rows } = await db.query(
      `select v.sku from product_variants v join inventory i on i.variant_id = v.id join products p on p.id = v.product_id
       where i.on_hand >= $1 and not p.allow_backorder order by v.sku limit 1`, [minStock]);
    return variant(rows[0].sku);
  }
  function orderPayload(v: { id: string; product_id: string; name: string; slug: string; sku: string; unit_price: number }, qty: number, over: Record<string, unknown> = {}) {
    const subtotal = v.unit_price * qty;
    const order = {
      idempotency_key: "key-" + Math.random().toString(36).slice(2), user_id: null, email: "guest@example.com",
      phone: "+2348000000000", customer_name: "Guest Buyer",
      shipping_address: { full_name: "Guest Buyer", phone: "+2348000000000", country_code: "NG", region: "Lagos", city: "Lagos", line1: "1 Marina Road" },
      shipping_method_name: "Standard delivery", currency: "NGN", subtotal, discount_total: 0, discount_code: null,
      shipping_fee: 250000, tax_total: 0, total: subtotal + 250000, ...over,
    };
    const items = [{ product_id: v.product_id, variant_id: v.id, product_name: v.name, product_slug: v.slug, sku: v.sku, unit_price: v.unit_price, quantity: qty }];
    return { order, items };
  }
  async function createOrder(p: { order: Record<string, unknown>; items: unknown[] }) {
    const { rows } = await db.query(`select public.create_order($1::jsonb, $2::jsonb) as r`, [JSON.stringify(p.order), JSON.stringify(p.items)]);
    return rows[0].r;
  }
  async function addPayment(orderId: string, reference: string, amount: number) {
    await db.query(`insert into payments (order_id, reference, amount, currency) values ($1, $2, $3, 'NGN')`, [orderId, reference, amount]);
  }
  async function finalize(reference: string, amount: number, currency = "NGN") {
    const { rows } = await db.query(`select public.finalize_payment($1, $2, $3, 'tx', 'card', now(), '{}'::jsonb) as r`, [reference, amount, currency]);
    return rows[0].r;
  }

  // ------------------------------------------------------------------
  describe("catalogue", () => {
    it("searches, filters and sorts published products as an anonymous visitor", async () => {
      const r = await as(db, { role: "anon" }, () => db.query(`select name, total_count from catalog_search(p_query => 'satin', p_sort => 'price_asc')`));
      expect(r.rows.map((x) => x.name)).toEqual(["Pleated Satin Midi Skirt", "Satin Slip Midi Dress"]);

      const sneakers = await as(db, { role: "anon" }, () =>
        db.query(`select coalesce(sale_price, price) as p, total_count from catalog_search(p_category_id => (select id from categories where slug = 'sneakers' and parent_id is null), p_sort => 'price_desc', p_limit => 50)`));
      const prices = sneakers.rows.map((x) => x.p);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
      expect(Number(sneakers.rows[0].total_count)).toBe(5);

      const sized = await as(db, { role: "anon" }, () => db.query(`select id from catalog_search(p_sizes => array['XXL'], p_limit => 60)`));
      expect(sized.rows.length).toBeGreaterThan(0);
      const priced = await as(db, { role: "anon" }, () => db.query(`select coalesce(sale_price, price) p from catalog_search(p_min_price => 3000000, p_max_price => 4000000, p_limit => 60)`));
      expect(priced.rows.every((x) => x.p >= 3000000 && x.p <= 4000000)).toBe(true);
      const pinks = await as(db, { role: "anon" }, () => db.query(`select colors from catalog_search(p_colors => array['rose'], p_limit => 60)`));
      expect(pinks.rows.every((x) => x.colors.some((c: { name: string }) => c.name === "Rose"))).toBe(true);
    });

    it("paginates with a stable total", async () => {
      const p1 = await as(db, { role: "anon" }, () => db.query(`select id, total_count from catalog_search(p_limit => 10, p_offset => 0)`));
      const p2 = await as(db, { role: "anon" }, () => db.query(`select id, total_count from catalog_search(p_limit => 10, p_offset => 10)`));
      expect(p1.rows[0].total_count).toBe(p2.rows[0].total_count);
      expect(p1.rows.map((r) => r.id)).not.toContain(p2.rows[0].id);
    });

    it("hides draft products from the public but not from staff", async () => {
      await db.query(`update products set status = 'draft' where slug = 'canvas-low-tops'`);
      const anon = await as(db, { role: "anon" }, () => db.query(`select 1 from products where slug = 'canvas-low-tops'`));
      const st = await as(db, { role: "authenticated", userId: staff }, () => db.query(`select 1 from products where slug = 'canvas-low-tops'`));
      expect(anon.rowCount).toBe(0);
      expect(st.rowCount).toBe(1);
      await db.query(`update products set status = 'published' where slug = 'canvas-low-tops'`);
    });

    it("reports availability filters correctly", async () => {
      await db.query(`update inventory set on_hand = 0 where variant_id in (select v.id from product_variants v join products p on p.id = v.product_id where p.slug = 'mini-crossbody-bag')`);
      const oos = await as(db, { role: "anon" }, () => db.query(`select slug from catalog_search(p_availability => 'out_of_stock', p_limit => 60)`));
      expect(oos.rows.map((r) => r.slug)).toContain("mini-crossbody-bag");
      const ins = await as(db, { role: "anon" }, () => db.query(`select slug from catalog_search(p_availability => 'in_stock', p_limit => 60)`));
      expect(ins.rows.map((r) => r.slug)).not.toContain("mini-crossbody-bag");
    });
  });

  // ------------------------------------------------------------------
  describe("row level security", () => {
    it("keeps supplier data, payments, carts and discounts away from customers", async () => {
      await db.query(`insert into suppliers (name) values ('Secret Supplier')`);
      await db.query(`insert into product_supplier_info (product_id, supplier_cost) select id, 1000 from products limit 1`);
      for (const actor of [{ role: "anon" as const }, { role: "authenticated" as const, userId: alice }]) {
        for (const table of ["suppliers", "product_supplier_info", "payments", "carts", "webhook_events", "discounts", "fulfilments", "inventory_movements"]) {
          const r = await as(db, actor, () => db.query(`select * from ${table}`));
          expect(r.rowCount, `${actor.role} reading ${table}`).toBe(0);
        }
      }
      const adminView = await as(db, { role: "authenticated", userId: admin }, () => db.query(`select * from product_supplier_info`));
      expect(adminView.rowCount).toBe(1);
    });

    it("prevents users from granting themselves admin", async () => {
      await expect(
        as(db, { role: "authenticated", userId: alice }, () => db.query(`insert into user_roles (user_id, role) values ($1, 'admin')`, [alice])),
      ).rejects.toThrow(/row-level security/);
      await expect(
        as(db, { role: "authenticated", userId: alice }, () => db.query(`select public.grant_role_by_email('alice@example.com', 'admin')`)),
      ).rejects.toThrow(/permission denied/);
      const roles = await db.query(`select * from user_roles where user_id = $1`, [alice]);
      expect(roles.rowCount).toBe(0);
    });

    it("lets customers see only their own orders and addresses", async () => {
      const v = await anyInStockVariant();
      const a = await createOrder(orderPayload(v, 1, { user_id: alice, email: "alice@example.com" }));
      await createOrder(orderPayload(v, 1, { user_id: bob, email: "bob@example.com" }));
      await db.query(`insert into addresses (user_id, full_name, phone, country_code, region, city, line1) values ($1, 'Bob', '+2348000000001', 'NG', 'LA', 'Lagos', '2 Broad St')`, [bob]);

      const mine = await as(db, { role: "authenticated", userId: alice }, () => db.query(`select id, email from orders`));
      expect(mine.rows).toEqual([{ id: a.order_id, email: "alice@example.com" }]);
      const items = await as(db, { role: "authenticated", userId: alice }, () => db.query(`select order_id from order_items`));
      expect(new Set(items.rows.map((r) => r.order_id))).toEqual(new Set([a.order_id]));
      const addrs = await as(db, { role: "authenticated", userId: alice }, () => db.query(`select * from addresses`));
      expect(addrs.rowCount).toBe(0);
      const anon = await as(db, { role: "anon" }, () => db.query(`select * from orders`));
      expect(anon.rowCount).toBe(0);
    });

    it("blocks customers from modifying orders or calling privileged functions", async () => {
      const upd = await as(db, { role: "authenticated", userId: alice }, () => db.query(`update orders set total = 1, payment_status = 'paid'`));
      expect(upd.rowCount).toBe(0);
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`select public.finalize_payment('x', 1, 'NGN', 't', 'c', now(), '{}')`))).rejects.toThrow(/permission denied/);
      await expect(as(db, { role: "anon" }, () => db.query(`select public.create_order('{}', '[]')`))).rejects.toThrow(/permission denied/);
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`select public.admin_dashboard_stats()`))).rejects.toThrow(/forbidden/);
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`select public.admin_set_stock((select id from product_variants limit 1), 99)`))).rejects.toThrow(/forbidden/);
    });

    it("restricts profile updates to safe columns", async () => {
      await as(db, { role: "authenticated", userId: alice }, () => db.query(`update profiles set full_name = 'Alice A' where id = $1`, [alice]));
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`update profiles set email = 'x@y.z' where id = $1`, [alice]))).rejects.toThrow(/permission denied/);
      const other = await as(db, { role: "authenticated", userId: alice }, () => db.query(`update profiles set full_name = 'Hacked' where id = $1`, [bob]));
      expect(other.rowCount).toBe(0);
    });

    it("staff can manage orders but not the catalogue", async () => {
      const r = await as(db, { role: "authenticated", userId: staff }, () => db.query(`update products set price = 1`));
      expect(r.rowCount).toBe(0);
      const stats = await as(db, { role: "authenticated", userId: staff }, () => db.query(`select public.admin_dashboard_stats() as s`));
      expect(stats.rows[0].s).toHaveProperty("total_orders");
    });
  });

  // ------------------------------------------------------------------
  describe("order creation", () => {
    it("is idempotent for the same key", async () => {
      const v = await anyInStockVariant();
      const p = orderPayload(v, 1);
      const first = await createOrder(p);
      const second = await createOrder(p);
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.order_id).toBe(first.order_id);
    });

    it("rejects tampered prices, wrong subtotals and inconsistent totals", async () => {
      const v = await anyInStockVariant();
      const tampered = orderPayload(v, 1);
      (tampered.items[0] as { unit_price: number }).unit_price = 100;
      await expect(createOrder({ ...tampered, order: { ...tampered.order, subtotal: 100, total: 100 + 250000 } })).rejects.toThrow(/price_changed/);
      const p = orderPayload(v, 1);
      await expect(createOrder({ ...p, order: { ...p.order, subtotal: 1, total: 1 + 250000 } })).rejects.toThrow(/subtotal_mismatch/);
      await expect(createOrder({ ...p, order: { ...p.order, total: 5 } })).rejects.toThrow(/total_consistent/);
    });

    it("rejects out-of-stock and unavailable variants", async () => {
      const v = await anyInStockVariant();
      await expect(createOrder(orderPayload(v, v.on_hand + 1))).rejects.toThrow(/insufficient_stock|quantity/);
      await db.query(`update product_variants set is_active = false where id = $1`, [v.id]);
      await expect(createOrder(orderPayload(v, 1))).rejects.toThrow(/variant_unavailable/);
      await db.query(`update product_variants set is_active = true where id = $1`, [v.id]);
    });

    it("rejects invalid discount codes", async () => {
      const v = await anyInStockVariant();
      await db.query(`insert into discounts (code, type, value, is_active) values ('EXPIRED5', 'percentage', 5, false)`);
      const p = orderPayload(v, 1, { discount_code: "EXPIRED5" });
      await expect(createOrder(p)).rejects.toThrow(/discount_invalid/);
    });
  });

  // ------------------------------------------------------------------
  describe("payment finalisation", () => {
    it("rejects amount or currency mismatches", async () => {
      const v = await anyInStockVariant();
      const o = await createOrder(orderPayload(v, 1));
      await addPayment(o.order_id, `${o.order_number}-mismatch1`, o.total);
      expect((await finalize(`${o.order_number}-mismatch1`, o.total - 100)).code).toBe("amount_mismatch");
      await addPayment(o.order_id, `${o.order_number}-mismatch2`, o.total);
      expect((await finalize(`${o.order_number}-mismatch2`, o.total, "USD")).code).toBe("amount_mismatch");
      const { rows } = await db.query(`select payment_status, status from orders where id = $1`, [o.order_id]);
      expect(rows[0]).toEqual({ payment_status: "unpaid", status: "pending_payment" });
    });

    it("marks paid once, decrements stock once, and counts discount use once", async () => {
      const v = await anyInStockVariant(4);
      await db.query(`insert into discounts (code, type, value) values ('ONCE10', 'percentage', 10)`);
      const subtotal = v.unit_price * 2;
      const discount = Math.round(subtotal * 0.1);
      const o = await createOrder(orderPayload(v, 2, { discount_code: "ONCE10", discount_total: discount, total: subtotal - discount + 250000 }));
      const ref = `${o.order_number}-pay1`;
      await addPayment(o.order_id, ref, o.total);

      const r1 = await finalize(ref, o.total);
      const r2 = await finalize(ref, o.total); // duplicate webhook / callback
      expect(r1.code).toBe("paid");
      expect(r2.code).toBe("already_processed");

      const after = await variant(v.sku);
      expect(after.on_hand).toBe(v.on_hand - 2);
      const { rows } = await db.query(`select status, payment_status, paid_at is not null as paid from orders where id = $1`, [o.order_id]);
      expect(rows[0]).toEqual({ status: "paid", payment_status: "paid", paid: true });
      const d = await db.query(`select usage_count from discounts where code = 'ONCE10'`);
      expect(d.rows[0].usage_count).toBe(1);

      // a second, different successful payment for the same order is flagged, not re-applied
      await addPayment(o.order_id, `${o.order_number}-pay2`, o.total);
      expect((await finalize(`${o.order_number}-pay2`, o.total)).code).toBe("duplicate_payment");
      expect((await variant(v.sku)).on_hand).toBe(v.on_hand - 2);
    });

    it("never downgrades a verified payment to failed", async () => {
      const v = await anyInStockVariant();
      const o = await createOrder(orderPayload(v, 1));
      const ref = `${o.order_number}-ok`;
      await addPayment(o.order_id, ref, o.total);
      await finalize(ref, o.total);
      const { rows } = await db.query(`select public.record_payment_failure($1, 'late failure', '{}') as r`, [ref]);
      expect(rows[0].r.code).toBe("already_paid");
    });

    it("records failed payments", async () => {
      const v = await anyInStockVariant();
      const o = await createOrder(orderPayload(v, 1));
      const ref = `${o.order_number}-fail`;
      await addPayment(o.order_id, ref, o.total);
      await db.query(`select public.record_payment_failure($1, 'Declined', '{}')`, [ref]);
      const { rows } = await db.query(`select o.payment_status, p.status from orders o join payments p on p.order_id = o.id where p.reference = $1`, [ref]);
      expect(rows[0]).toEqual({ payment_status: "failed", status: "failed" });
    });

    it("flags an inventory conflict instead of overselling", async () => {
      const v = await anyInStockVariant(2);
      const o = await createOrder(orderPayload(v, 2));
      await db.query(`update inventory set on_hand = 1 where variant_id = $1`, [v.id]); // someone else bought stock meanwhile
      const ref = `${o.order_number}-race`;
      await addPayment(o.order_id, ref, o.total);
      const r = await finalize(ref, o.total);
      expect(r).toMatchObject({ ok: true, code: "paid", inventory_conflict: true });
      expect((await variant(v.sku)).on_hand).toBe(1);
    });

    it("deduplicates webhook events at the database level", async () => {
      await db.query(`insert into webhook_events (provider, dedupe_key, event_type, payload) values ('paystack', 'k1', 'charge.success', '{}')`);
      await expect(db.query(`insert into webhook_events (provider, dedupe_key, event_type, payload) values ('paystack', 'k1', 'charge.success', '{}')`)).rejects.toThrow(/duplicate key/);
    });
  });

  // ------------------------------------------------------------------
  describe("fulfilment and tracking", () => {
    it("enforces status transitions and restocks on refund", async () => {
      const v = await anyInStockVariant(3);
      const o = await createOrder(orderPayload(v, 1));
      await expect(
        as(db, { role: "authenticated", userId: staff }, () => db.query(`select public.admin_update_order_status($1, 'paid')`, [o.order_id])),
      ).rejects.toThrow(/invalid_transition/);
      const ref = `${o.order_number}-ful`;
      await addPayment(o.order_id, ref, o.total);
      await finalize(ref, o.total);
      const stockAfterSale = (await variant(v.sku)).on_hand;

      await as(db, { role: "authenticated", userId: staff }, () => db.query(`select public.admin_update_order_status($1, 'ordered_from_supplier', 'Your order is being prepared.')`, [o.order_id]));
      await expect(
        as(db, { role: "authenticated", userId: alice }, () => db.query(`select public.admin_update_order_status($1, 'shipped')`, [o.order_id])),
      ).rejects.toThrow(/forbidden/);
      await as(db, { role: "authenticated", userId: admin }, () => db.query(`select public.admin_update_order_status($1, 'refunded', null, true)`, [o.order_id]));
      expect((await variant(v.sku)).on_hand).toBe(stockAfterSale + 1);
      const { rows } = await db.query(`select status, payment_status from orders where id = $1`, [o.order_id]);
      expect(rows[0]).toEqual({ status: "refunded", payment_status: "refunded" });
    });

    it("tracks orders only with a matching email and hides private details", async () => {
      const v = await anyInStockVariant();
      const o = await createOrder(orderPayload(v, 1, { email: "track@example.com" }));
      const miss = await db.query(`select public.track_order($1, 'someone@else.com') as r`, [o.order_number]);
      expect(miss.rows[0].r).toBeNull();
      const hit = await db.query(`select public.track_order($1, ' TRACK@example.com ') as r`, [o.order_number.toLowerCase()]);
      const r = hit.rows[0].r;
      expect(r.order_number).toBe(o.order_number);
      expect(r.destination).toEqual({ city: "Lagos", region: "Lagos", country_code: "NG" });
      expect(JSON.stringify(r)).not.toMatch(/Marina|\+234|access_token/);
      await expect(as(db, { role: "anon" }, () => db.query(`select public.track_order('x', 'y')`))).rejects.toThrow(/permission denied/);
    });
  });

  it("rate limiter blocks after the configured number of attempts", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { rows } = await db.query(`select public.check_rate_limit('login:test', 3, 60) as ok`);
      results.push(rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
