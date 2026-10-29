import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: bank transfer payments", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let owner: string, orderStaff: string, productStaff: string, customer: string;
  let variantId: string;
  const user = (id: string) => ({ role: "authenticated" as const, userId: id });
  let n = 0;

  beforeAll(async () => {
    const t = await createTestDatabase("ac_transfer_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    owner = await createUser(db, "owner@example.com");
    orderStaff = await createUser(db, "orders@example.com");
    productStaff = await createUser(db, "products@example.com");
    customer = await createUser(db, "customer@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    await db.query(`select public.grant_role_by_email('orders@example.com', 'staff')`);
    await db.query(`insert into staff_members (user_id, email, role, status) values ($1, 'products@example.com', 'product_staff', 'active')`, [productStaff]);
    await db.query(`insert into user_roles (user_id, role) values ($1, 'product_staff')`, [productStaff]);
    const v = await db.query(`select v.id from product_variants v join inventory i on i.variant_id = v.id where i.on_hand >= 5 limit 1`);
    variantId = v.rows[0].id;
  });
  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  /** A bank-transfer order for ₦10,000 (1 item), its payment record and a pending claim. */
  async function transferOrder(reference = `FT${Date.now()}${n}`) {
    n++;
    const o = await db.query(
      `insert into orders (email, phone, customer_name, shipping_address, shipping_method_name, currency, subtotal, discount_total, shipping_fee, tax_total, total, idempotency_key, payment_method)
       values ('customer@example.com', '+2348000000000', 'Ada Customer', '{}'::jsonb, 'Standard', 'NGN', 1000000, 0, 0, 0, 1000000, $1, 'bank_transfer') returning id, order_number`,
      [`transfer-test-${n}`],
    );
    const orderId = o.rows[0].id;
    await db.query(
      `insert into order_items (order_id, product_id, variant_id, product_name, unit_price, quantity, line_total)
       select $1, v.product_id, v.id, 'Dress', 1000000, 1, 1000000 from product_variants v where v.id = $2`,
      [orderId, variantId],
    );
    const p = await db.query(`insert into payments (order_id, provider, channel, reference, amount, currency) values ($1, 'bank_transfer', 'bank_transfer', $2, 1000000, 'NGN') returning id`, [orderId, `${o.rows[0].order_number}-TRANSFER`]);
    await db.query(`update orders set payment_status = 'pending' where id = $1`, [orderId]);
    const c = await db.query(
      `insert into payment_claims (order_id, payment_id, customer_name, amount_paid, transfer_reference, whatsapp) values ($1, $2, 'Ada Customer', 1000000, $3, '08031234567') returning id`,
      [orderId, p.rows[0].id, reference],
    );
    return { orderId, claimId: c.rows[0].id as string, orderNumber: o.rows[0].order_number as string };
  }
  const review = (who: string, claim: string, decision: string, note: string | null = null) =>
    as(db, user(who), () => db.query(`select public.admin_review_payment_claim($1, $2, $3) as r`, [claim, decision, note]));
  const stock = async () => (await db.query(`select on_hand from inventory where variant_id = $1`, [variantId])).rows[0].on_hand as number;

  it("the owner confirms a transfer: order paid, stock committed, payment recorded", async () => {
    const { orderId, claimId } = await transferOrder();
    const before = await stock();
    const r = (await review(owner, claimId, "verified")).rows[0].r;
    expect(r).toMatchObject({ ok: true, decision: "verified", code: "paid" });
    const order = (await db.query(`select status, payment_status, paid_at from orders where id = $1`, [orderId])).rows[0];
    expect(order).toMatchObject({ status: "paid", payment_status: "paid" });
    expect(order.paid_at).not.toBeNull();
    expect(await stock()).toBe(before - 1);
    const pay = (await db.query(`select status, channel, provider_transaction_id from payments where order_id = $1`, [orderId])).rows[0];
    expect(pay).toMatchObject({ status: "success", channel: "bank_transfer" });
    expect((await db.query(`select status, reviewed_by from payment_claims where id = $1`, [claimId])).rows[0]).toEqual({ status: "verified", reviewed_by: owner });
    expect((await db.query(`select 1 from fulfilments where order_id = $1`, [orderId])).rowCount).toBe(1);
    // Can't be reviewed twice (no double stock deduction).
    await expect(review(owner, claimId, "verified")).rejects.toThrow(/already_reviewed/);
    expect(await stock()).toBe(before - 1);
  });

  it("declining puts the order back to unpaid so the customer can resubmit", async () => {
    const { orderId, claimId } = await transferOrder();
    const before = await stock();
    await review(owner, claimId, "declined", "Amount was short.");
    expect((await db.query(`select status, payment_status from orders where id = $1`, [orderId])).rows[0]).toEqual({ status: "pending_payment", payment_status: "unpaid" });
    expect((await db.query(`select status, admin_note from payment_claims where id = $1`, [claimId])).rows[0]).toEqual({ status: "declined", admin_note: "Amount was short." });
    expect(await stock()).toBe(before);
    const note = await db.query(`select public_note from order_status_history where order_id = $1 order by created_at desc limit 1`, [orderId]);
    expect(note.rows[0].public_note).toMatch(/couldn't confirm your bank transfer/);
  });

  it("only the owner can see or review transfers", async () => {
    const { claimId } = await transferOrder();
    for (const who of [orderStaff, productStaff, customer]) {
      await expect(review(who, claimId, "verified")).rejects.toThrow(/forbidden/);
      expect((await as(db, user(who), () => db.query(`select * from payment_claims`))).rowCount).toBe(0);
      await expect(as(db, user(who), () => db.query(`update payment_claims set status = 'verified' where id = $1`, [claimId]))).resolves.toMatchObject({ rowCount: 0 });
    }
    await expect(as(db, { role: "anon" }, () => db.query(`select public.admin_review_payment_claim($1, 'verified', null)`, [claimId]))).rejects.toThrow();
    expect((await as(db, user(owner), () => db.query(`select id from payment_claims where id = $1`, [claimId]))).rowCount).toBe(1);
    expect((await db.query(`select status from payment_claims where id = $1`, [claimId])).rows[0].status).toBe("pending");
  });

  it("the same bank reference can't back two live claims, but can be reused after a decline", async () => {
    const ref = `FT-DUP-${Date.now()}`;
    const first = await transferOrder(ref);
    await expect(transferOrder(` ${ref.toLowerCase()} `.trim())).rejects.toThrow(/payment_claims_reference_live_idx/);
    await review(owner, first.claimId, "declined");
    await expect(transferOrder(ref)).resolves.toBeTruthy();
  });

  it("customers can't insert claims or read the receipt bucket directly", async () => {
    const { orderId } = await transferOrder();
    const pay = (await db.query(`select id from payments where order_id = $1`, [orderId])).rows[0].id;
    await expect(as(db, user(customer), () => db.query(`insert into payment_claims (order_id, payment_id, customer_name, amount_paid, transfer_reference, whatsapp) values ($1, $2, 'X Y', 100, 'FAKE1234', '08030000000')`, [orderId, pay]))).rejects.toThrow();
    const bucket = (await db.query(`select public, file_size_limit from storage.buckets where id = 'payment-proofs'`)).rows[0];
    expect(bucket).toEqual({ public: false, file_size_limit: "5242880" });
    await db.query(`grant select, insert on storage.objects to authenticated`);
    await expect(as(db, user(customer), () => db.query(`insert into storage.objects (bucket_id, name) values ('payment-proofs', 'x/y.jpg')`))).rejects.toThrow();
  });

  it("bank details setting is seeded and public", async () => {
    const row = (await as(db, { role: "anon" }, () => db.query(`select value from store_settings where key = 'bank_transfer'`))).rows[0];
    expect(row.value).toMatchObject({ enabled: true, bank_name: "First Bank", account_number: "3043027979", account_name: "OKONYE JUSTICE JESSICA" });
  });
});
