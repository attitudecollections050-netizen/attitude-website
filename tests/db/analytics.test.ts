import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: analytics, reports and feedback", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let admin: string, staff: string, alice: string;
  let products: { id: string; name: string; category: string }[];

  beforeAll(async () => {
    const t = await createTestDatabase("ac_analytics_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    admin = await createUser(db, "owner@example.com");
    staff = await createUser(db, "staff@example.com");
    alice = await createUser(db, "alice@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    await db.query(`select public.grant_role_by_email('staff@example.com', 'staff')`);
    const { rows } = await db.query(
      `select p.id, p.name, coalesce(parent.name, c.name) as category from products p join categories c on c.id = p.category_id
       left join categories parent on parent.id = c.parent_id where p.status = 'published' order by p.name limit 3`,
    );
    products = rows;
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  let seq = 0;
  /** Inserts an order with full control over status and timestamps (amounts in kobo). */
  async function order(o: {
    created: string; paid?: string | null; status?: string; payment?: string; currency?: string; userId?: string | null; email?: string;
    items: { product: number; qty: number; price: number }[]; discount?: number; shipping?: number; tax?: number; visitor?: string | null;
  }) {
    const subtotal = o.items.reduce((a, i) => a + i.qty * i.price, 0);
    const discount = o.discount ?? 0, shipping = o.shipping ?? 0, tax = o.tax ?? 0;
    const { rows } = await db.query(
      `insert into orders (email, phone, customer_name, shipping_address, shipping_method_name, currency, subtotal, discount_total, shipping_fee, tax_total, total,
                           status, payment_status, idempotency_key, created_at, paid_at, user_id, analytics_visitor_id,
                           refunded_at, cancelled_at)
       values ($1, '+2348000000000', 'Test Buyer', '{}'::jsonb, 'Standard', $2, $3, $4, $5, $6, $7, $8::order_status, $9::payment_status, $10, $11, $12, $13, $14,
               case when $8 = 'refunded' then $12::timestamptz end, case when $8 = 'cancelled' then $11::timestamptz end)
       returning id`,
      [o.email ?? `buyer${seq}@example.com`, o.currency ?? "NGN", subtotal, discount, shipping, tax, subtotal - discount + shipping + tax,
       o.status ?? (o.paid ? "paid" : "pending_payment"), o.payment ?? (o.paid ? "paid" : "unpaid"), `k${++seq}`, o.created, o.paid ?? null, o.userId ?? null, o.visitor ?? null],
    );
    for (const i of o.items) {
      const p = products[i.product];
      await db.query(`insert into order_items (order_id, product_id, product_name, unit_price, quantity, line_total) values ($1, $2, $3, $4, $5, $6)`,
        [rows[0].id, p.id, p.name, i.price, i.qty, i.price * i.qty]);
    }
    return rows[0].id as string;
  }
  const report = (from: string, to: string, bucket = "day", who = admin) =>
    as(db, { role: "authenticated", userId: who }, () => db.query(`select public.admin_analytics_report($1, $2, 'Africa/Lagos', $3) as r`, [from, to, bucket])).then((x) => x.rows[0].r);
  const event = (type: string, visitor: string, at: string, extra: Record<string, unknown> = {}) =>
    db.query(`insert into analytics_events (event_type, visitor_id, session_id, path, created_at, source, device, product_id) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [type, visitor, extra.session ?? visitor, extra.path ?? "/", at, extra.source ?? null, extra.device ?? "mobile", extra.product ?? null]);

  const V1 = "11111111-1111-4111-8111-111111111111";
  const V2 = "22222222-2222-4222-8222-222222222222";
  const V3 = "33333333-3333-4333-8333-333333333333";

  describe("sales & payment reporting", () => {
    beforeAll(async () => {
      // March 2026 (all times UTC; Lagos = UTC+1)
      await order({ created: "2026-03-02T10:00Z", paid: "2026-03-02T10:05Z", items: [{ product: 0, qty: 2, price: 1000000 }], shipping: 250000, discount: 100000 });
      await order({ created: "2026-03-03T09:00Z", paid: "2026-03-03T09:10Z", items: [{ product: 1, qty: 1, price: 500000 }], shipping: 400000, tax: 37500 });
      // refunded after payment: excluded from revenue, counted as refund
      await order({ created: "2026-03-04T09:00Z", paid: "2026-03-04T09:05Z", status: "refunded", payment: "refunded", items: [{ product: 2, qty: 1, price: 800000 }], shipping: 250000 });
      // cancelled after payment
      await order({ created: "2026-03-05T09:00Z", paid: "2026-03-05T09:05Z", status: "cancelled", payment: "paid", items: [{ product: 0, qty: 1, price: 1000000 }] });
      // unpaid / failed — never sales
      await order({ created: "2026-03-06T09:00Z", items: [{ product: 1, qty: 3, price: 500000 }] });
      await order({ created: "2026-03-06T10:00Z", payment: "failed", items: [{ product: 1, qty: 1, price: 500000 }] });
      // paid in another currency — reported separately
      await order({ created: "2026-03-07T09:00Z", paid: "2026-03-07T09:01Z", currency: "USD", items: [{ product: 2, qty: 1, price: 5000 }] });
      // timezone edge: placed & paid 23:30 UTC on 31 March = 00:30 on 1 April in Lagos
      await order({ created: "2026-03-31T23:30Z", paid: "2026-03-31T23:40Z", items: [{ product: 2, qty: 1, price: 700000 }] });
      // shipped (paid) order = pending delivery
      await order({ created: "2026-02-10T09:00Z", paid: "2026-02-10T09:00Z", status: "shipped", items: [{ product: 0, qty: 1, price: 1000000 }] });

      const o1 = (await db.query(`select id from orders order by created_at limit 1 offset 1`)).rows[0].id;
      await db.query(`insert into payments (order_id, reference, amount, currency, status, created_at) values
        ($1, 'ref-ok', 2150000, 'NGN', 'success', '2026-03-02T10:01Z'),
        ($1, 'ref-dup', 2150000, 'NGN', 'success', '2026-03-02T10:02Z'),
        ($1, 'ref-pend', 2150000, 'NGN', 'initialized', '2026-03-02T10:03Z'),
        ($1, 'ref-fail', 2150000, 'NGN', 'failed', '2026-03-02T10:04Z'),
        ($1, 'ref-abandon', 2150000, 'NGN', 'abandoned', '2026-03-02T10:04Z')`, [o1]);
      await db.query(`update payments set failure_reason = 'duplicate_payment_refund_required' where reference = 'ref-dup'`);
    });

    it("calculates gross, net, refunds, shipping, tax, revenue and AOV per currency", async () => {
      const r = await report("2026-03-01", "2026-03-31");
      const ngn = r.sales.find((s: { currency: string }) => s.currency === "NGN");
      const usd = r.sales.find((s: { currency: string }) => s.currency === "USD");
      expect(ngn.paid_orders).toBe(4); // 2 qualifying + refunded + cancelled (the 31st 23:30Z order is April in Lagos)
      expect(ngn.qualifying_orders).toBe(2);
      expect(ngn.gross_sales).toBe(2000000 + 500000 + 800000 + 1000000);
      expect(ngn.discounts).toBe(100000);
      expect(ngn.refunds).toBe(800000);
      expect(ngn.cancellations).toBe(1000000);
      expect(ngn.net_sales).toBe(1900000 + 500000);
      expect(ngn.net_sales).toBe(ngn.gross_sales - ngn.discounts - ngn.refunds - ngn.cancellations);
      expect(ngn.shipping).toBe(250000 + 400000);
      expect(ngn.tax).toBe(37500);
      expect(ngn.revenue).toBe(ngn.net_sales + ngn.shipping + ngn.tax);
      expect(ngn.revenue).toBe(2150000 + 937500);
      expect(ngn.average_order_value).toBe(Math.round((2150000 + 937500) / 2));
      expect(ngn.refunded_to_customers).toBe(1050000);
      expect(usd.revenue).toBe(5000);
    });

    it("never counts unpaid or failed orders as sales but reports them", async () => {
      const r = await report("2026-03-01", "2026-03-31");
      expect(r.orders.total).toBe(7);
      expect(r.orders.awaiting_payment).toBe(1);
      expect(r.orders.failed_payment).toBe(1);
      expect(r.pending_deliveries).toBe(5); // snapshot of all paid, undelivered orders: 2 March NGN + USD + 1 April + shipped Feb
    });

    it("reports payment attempts by status, excluding duplicate charges from successes", async () => {
      const r = await report("2026-03-01", "2026-03-31");
      expect(r.payments).toEqual({ attempts: 5, successful: 1, duplicate: 1, pending: 1, failed: 1, abandoned: 1 });
    });

    it("applies date filters in the business timezone", async () => {
      const march31 = await report("2026-03-31", "2026-03-31");
      expect(march31.orders.total).toBe(0);
      const april1 = await report("2026-04-01", "2026-04-01");
      expect(april1.orders.total).toBe(1);
      expect(april1.sales[0].revenue).toBe(700000);
      const day = await report("2026-03-02", "2026-03-02");
      expect(day.orders.total).toBe(1);
      expect(day.series).toHaveLength(1);
    });

    it("buckets the time series by day, week and month with no gaps", async () => {
      const days = await report("2026-03-01", "2026-03-31", "day");
      expect(days.series).toHaveLength(31);
      expect(days.series.find((p: { bucket: string }) => p.bucket === "2026-03-02").revenue.NGN).toBe(2150000);
      const total = days.series.reduce((a: number, p: { revenue: Record<string, number> }) => a + (p.revenue.NGN ?? 0), 0);
      expect(total).toBe(2150000 + 937500);
      const months = await report("2026-01-01", "2026-04-30", "month");
      expect(months.series.map((p: { bucket: string }) => p.bucket)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
      const weeks = await report("2026-03-01", "2026-03-31", "week");
      expect(weeks.series[0].bucket).toBe("2026-02-23"); // weeks start on Monday
    });

    it("ranks best sellers and categories from qualifying paid orders only", async () => {
      const r = await report("2026-03-01", "2026-03-31");
      const ngnSellers = r.best_sellers.filter((b: { currency: string }) => b.currency === "NGN");
      expect(ngnSellers[0]).toMatchObject({ name: products[0].name, units: 2, revenue: 2000000 });
      expect(ngnSellers.map((b: { name: string }) => b.name)).not.toContain(products[2].name); // only refunded in NGN
      const revenueByCat = r.categories.filter((c: { currency: string }) => c.currency === "NGN").reduce((a: number, c: { revenue: number }) => a + c.revenue, 0);
      expect(revenueByCat).toBe(2500000);
    });

    it("rejects invalid ranges", async () => {
      await expect(report("2026-03-10", "2026-03-01")).rejects.toThrow(/invalid_range/);
      await expect(report("2026-03-01", "2026-03-10", "hour")).rejects.toThrow(/invalid_bucket/);
    });
  });

  describe("visitor analytics", () => {
    beforeAll(async () => {
      await event("page_view", V1, "2026-05-01T08:00Z", { source: "search", path: "/" });
      await event("page_view", V1, "2026-05-01T08:01Z", { path: "/shop" });
      await event("product_view", V1, "2026-05-01T08:02Z", { product: products[0].id, path: "/products/x" });
      await event("add_to_cart", V1, "2026-05-01T08:03Z", { product: products[0].id });
      await event("checkout_start", V1, "2026-05-01T08:04Z", { path: "/checkout" });
      await event("page_view", V2, "2026-05-01T09:00Z", { source: "social", device: "desktop", path: "/" });
      await event("product_view", V2, "2026-05-01T09:01Z", { product: products[1].id });
      await event("page_view", V3, "2026-05-02T09:00Z", { source: "direct", path: "/" });
      await event("page_view", V1, "2026-05-02T10:00Z", { session: V3.replace("3333", "4444"), source: "direct", path: "/" });
    });

    it("distinguishes unique visitors, visits and page views", async () => {
      const r = await report("2026-05-01", "2026-05-02");
      expect(r.traffic).toEqual({ visitors: 3, visits: 4, page_views: 5, product_views: 2 });
      const may1 = r.series.find((p: { bucket: string }) => p.bucket === "2026-05-01");
      expect(may1).toMatchObject({ visitors: 2, page_views: 3 });
    });

    it("builds the funnel from distinct visitors and records purchases only from verified payments, once", async () => {
      const orderId = await order({ created: "2026-05-01T08:05Z", items: [{ product: 0, qty: 1, price: 1000000 }], visitor: V1 });
      await db.query(`update orders set status = 'paid', payment_status = 'paid', paid_at = '2026-05-01T08:06Z' where id = $1`, [orderId]);
      // A repeated "paid" update (e.g. webhook + callback race) must not add a second purchase.
      await db.query(`update orders set payment_status = 'paid' where id = $1`, [orderId]);
      await db.query(`update orders set payment_status = 'refunded' where id = $1`, [orderId]);
      await db.query(`update orders set payment_status = 'paid' where id = $1`, [orderId]);
      const { rows } = await db.query(`select count(*)::int as n from analytics_events where event_type = 'purchase' and order_id = $1`, [orderId]);
      expect(rows[0].n).toBe(1);
      await expect(db.query(`insert into analytics_events (event_type, visitor_id, order_id) values ('purchase', $1, $2)`, [V1, orderId])).rejects.toThrow(/duplicate key/);

      const r = await report("2026-05-01", "2026-05-02");
      expect(r.funnel).toEqual({ visited: 3, viewed_product: 2, added_to_cart: 1, started_checkout: 1, purchased: 1 });
      expect(r.sources.map((s: { source: string }) => s.source).sort()).toEqual(["direct", "search", "social"]);
      expect(r.devices.find((d: { device: string }) => d.device === "mobile").visitors).toBe(2);
      expect(r.top_viewed_products).toHaveLength(2);
    });

    it("does not record a purchase event for visitors without analytics consent", async () => {
      const orderId = await order({ created: "2026-05-03T08:05Z", items: [{ product: 0, qty: 1, price: 1000000 }] });
      await db.query(`update orders set payment_status = 'paid', paid_at = now() where id = $1`, [orderId]);
      const { rows } = await db.query(`select count(*)::int as n from analytics_events where order_id = $1`, [orderId]);
      expect(rows[0].n).toBe(0);
    });
  });

  describe("access control", () => {
    it("keeps analytics and financial reports admin-only", async () => {
      await expect(report("2026-03-01", "2026-03-31", "day", staff)).rejects.toThrow(/forbidden/);
      await expect(report("2026-03-01", "2026-03-31", "day", alice)).rejects.toThrow(/forbidden/);
      await expect(as(db, { role: "anon" }, () => db.query(`select public.admin_analytics_report('2026-03-01', '2026-03-31')`))).rejects.toThrow();
      const seen = await as(db, { role: "authenticated", userId: alice }, () => db.query(`select count(*)::int as n from analytics_events`));
      expect(seen.rows[0].n).toBe(0);
      const adminSeen = await as(db, { role: "authenticated", userId: admin }, () => db.query(`select count(*)::int as n from analytics_events`));
      expect(adminSeen.rows[0].n).toBeGreaterThan(0);
      await expect(as(db, { role: "anon" }, () => db.query(`insert into analytics_events (event_type, visitor_id) values ('purchase', $1)`, [V1]))).rejects.toThrow();
    });

    it("lets staff (not customers) list customers", async () => {
      const r = await as(db, { role: "authenticated", userId: staff }, () => db.query(`select * from admin_customers('buyer1', 10, 0)`));
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows[0]).toHaveProperty("total_spent");
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`select * from admin_customers()`))).rejects.toThrow(/forbidden/);
    });
  });

  describe("feedback & reviews", () => {
    let siteFb: string, review: string, hiddenReview: string;
    beforeAll(async () => {
      const ins = async (v: Record<string, unknown>) =>
        (await db.query(
          `insert into feedback (kind, product_id, user_id, rating, sentiment, comment, reason, suggestion, publish_consent, moderation, flag, display_name_pref, display_name, is_verified_purchase, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
          [v.kind ?? "site", v.product ?? null, v.user ?? null, v.rating, v.sentiment, v.comment ?? null, v.reason ?? null, v.suggestion ?? null,
           v.consent ?? false, v.moderation ?? "pending", v.flag ?? null, v.pref ?? "anonymous", v.name ?? null, v.verified ?? false, v.at ?? "2026-06-10T10:00Z"],
        )).rows[0].id as string;
      siteFb = await ins({ rating: 1, sentiment: "negative", comment: "Delivery was late", reason: "delivery", suggestion: "Faster dispatch" });
      await ins({ rating: 2, sentiment: "negative", reason: "delivery", at: "2026-06-11T10:00Z" });
      await ins({ rating: 3, sentiment: "neutral", at: "2026-06-11T10:00Z" });
      review = await ins({ kind: "product", product: products[0].id, user: alice, rating: 5, sentiment: "positive", comment: "Love it", consent: true, moderation: "approved", pref: "first_name", name: "Alice", verified: true });
      hiddenReview = await ins({ kind: "product", product: products[0].id, rating: 1, sentiment: "negative", comment: "spam spam", consent: true, moderation: "hidden", flag: "spam" });
      await ins({ kind: "product", product: products[0].id, rating: 2, sentiment: "negative", comment: "No consent", consent: false, moderation: "approved" });
    });

    it("summarises ratings, sentiment, complaints and suggestions for staff", async () => {
      const r = (await as(db, { role: "authenticated", userId: staff }, () => db.query(`select admin_feedback_report('2026-06-01', '2026-06-30') as r`))).rows[0].r;
      expect(r.total).toBe(6);
      expect(r).toMatchObject({ positive: 1, neutral: 1, negative: 4 });
      expect(Number(r.average)).toBeCloseTo((1 + 2 + 3 + 5 + 1 + 2) / 6, 2);
      expect(r.distribution.map((d: { count: number }) => d.count)).toEqual([2, 2, 1, 0, 1]);
      expect(r.complaints[0]).toMatchObject({ reason: "delivery", count: 2 });
      expect(r.suggestions.map((s: { suggestion: string }) => s.suggestion)).toEqual(["Faster dispatch"]);
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`select admin_feedback_report('2026-06-01', '2026-06-30')`))).rejects.toThrow(/forbidden/);
    });

    it("publishes only approved, consented, unflagged product reviews — and nothing private", async () => {
      const r = await as(db, { role: "anon" }, () => db.query(`select * from public_product_reviews($1)`, [products[0].id]));
      expect(r.rows.map((x) => x.id)).toEqual([review]);
      expect(r.rows[0]).toMatchObject({ display_name: "Alice", is_verified_purchase: true });
      expect(Object.keys(r.rows[0])).not.toContain("user_id");
      const s = await as(db, { role: "anon" }, () => db.query(`select public_product_review_summary($1) as s`, [products[0].id]));
      expect(s.rows[0].s).toEqual({ count: 1, average: 5 });
      expect(hiddenReview).toBeTruthy();
    });

    it("blocks customers from reading, inserting or editing feedback and internal notes", async () => {
      const read = await as(db, { role: "authenticated", userId: alice }, () => db.query(`select count(*)::int as n from feedback`));
      expect(read.rows[0].n).toBe(0);
      await expect(as(db, { role: "anon" }, () => db.query(`insert into feedback (rating, sentiment) values (5, 'positive')`))).rejects.toThrow();
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`insert into feedback (rating, sentiment) values (5, 'positive')`))).rejects.toThrow();
      const upd = await as(db, { role: "authenticated", userId: alice }, () => db.query(`update feedback set moderation = 'approved' where id = $1`, [siteFb]));
      expect(upd.rowCount).toBe(0);
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`insert into feedback_notes (feedback_id, note) values ($1, 'x')`, [siteFb]))).rejects.toThrow();
    });

    it("lets staff moderate and add notes, but never change the customer's rating or words", async () => {
      await as(db, { role: "authenticated", userId: staff }, () => db.query(`update feedback set status = 'reviewed', moderation = 'hidden', flag = 'abusive' where id = $1`, [siteFb]));
      await as(db, { role: "authenticated", userId: staff }, () => db.query(`insert into feedback_notes (feedback_id, author_id, note) values ($1, $2, 'Spoke to courier')`, [siteFb, staff]));
      const after = await db.query(`select status, moderation, flag, rating, comment from feedback where id = $1`, [siteFb]);
      expect(after.rows[0]).toEqual({ status: "reviewed", moderation: "hidden", flag: "abusive", rating: 1, comment: "Delivery was late" });
      await expect(as(db, { role: "authenticated", userId: staff }, () => db.query(`update feedback set rating = 5 where id = $1`, [siteFb]))).rejects.toThrow(/permission denied/);
      await expect(as(db, { role: "authenticated", userId: admin }, () => db.query(`update feedback set comment = 'Great!' where id = $1`, [siteFb]))).rejects.toThrow(/permission denied/);
    });

    it("allows one review per product per customer and checks verified purchases", async () => {
      await expect(db.query(`insert into feedback (kind, product_id, user_id, rating, sentiment) values ('product', $1, $2, 4, 'positive')`, [products[0].id, alice])).rejects.toThrow(/duplicate key/);
      const none = await db.query(`select verified_purchase_order($1, $2) as o`, [alice, products[1].id]);
      expect(none.rows[0].o).toBeNull();
      const paidId = await order({ created: "2026-06-01T10:00Z", paid: "2026-06-01T10:01Z", userId: alice, email: "alice@example.com", items: [{ product: 1, qty: 1, price: 500000 }] });
      const yes = await db.query(`select verified_purchase_order($1, $2) as o`, [alice, products[1].id]);
      expect(yes.rows[0].o).toBe(paidId);
      await db.query(`update orders set status = 'refunded', payment_status = 'refunded' where id = $1`, [paidId]);
      const refunded = await db.query(`select verified_purchase_order($1, $2) as o`, [alice, products[1].id]);
      expect(refunded.rows[0].o).toBeNull();
      await expect(as(db, { role: "authenticated", userId: alice }, () => db.query(`select verified_purchase_order($1, $2)`, [alice, products[1].id]))).rejects.toThrow(/permission denied/);
    });
  });
});
