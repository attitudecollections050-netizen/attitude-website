import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: staff withdrawals (staff request, owner approves)", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let owner: string, staffA: string, staffB: string, customer: string;
  let cat: string;
  const user = (id: string) => ({ role: "authenticated" as const, userId: id });

  const addProducts = async (who: string, n: number, prefix: string) => {
    for (let i = 0; i < n; i++) {
      await db.query(`insert into products (name, slug, description, category_id, price, status, added_by) values ('Product', $1, '', $2, 100000, 'published', $3)`, [`${prefix}-${i}`, cat, who]);
    }
  };

  beforeAll(async () => {
    const t = await createTestDatabase("ac_pay_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    owner = await createUser(db, "owner@example.com");
    staffA = await createUser(db, "ada@example.com");
    staffB = await createUser(db, "bayo@example.com");
    customer = await createUser(db, "customer@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    for (const [id, email, name] of [[staffA, "ada@example.com", "Ada"], [staffB, "bayo@example.com", "Bayo"]]) {
      await db.query(`insert into staff_members (user_id, email, full_name, role, status) values ($1, $2, $3, 'product_staff', 'active')`, [id, email, name]);
      await db.query(`insert into user_roles (user_id, role) values ($1, 'product_staff')`, [id]);
    }
    cat = (await db.query(`select id from categories limit 1`)).rows[0].id;
    await addProducts(staffA, 25, "ada"); // ₦2,000
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  const totals = async (who: string, target: string | null = who) => (await as(db, user(who), () => db.query(`select * from staff_payment_totals($1)`, [target]))).rows;
  const request = (who: string, amount: number | null = null) => as(db, user(who), () => db.query(`select request_withdrawal($1) as res`, [amount]));
  const review = (who: string, id: string, approve: boolean, note: string | null = null) =>
    as(db, user(who), () => db.query(`select review_withdrawal($1, $2, $3) as res`, [id, approve, note]));

  it("the old manual pay functions are gone", async () => {
    const fns = (await db.query(`select proname from pg_proc where proname in ('pay_staff', 'confirm_my_payout')`)).rows;
    expect(fns).toEqual([]);
  });

  it("staff need valid bank details before they can request a withdrawal", async () => {
    await expect(request(staffA)).rejects.toThrow(/no_bank_details/);
    await expect(as(db, user(staffA), () => db.query(`select set_my_bank_details('Access Bank', '01234', 'Ada Test')`))).rejects.toThrow(/invalid_account_number/);
    await as(db, user(staffA), () => db.query(`select set_my_bank_details('Access Bank', '012 345 6789', 'Ada Test')`));
    await as(db, user(staffB), () => db.query(`select set_my_bank_details('Opay', '9876543210', 'Bayo Test')`));
    expect((await as(db, user(staffA), () => db.query(`select * from staff_bank_details()`))).rows[0]).toMatchObject({ account_number: "0123456789", account_name: "ADA TEST" });
  });

  it("staff choose any amount from ₦500 up to their balance (₦10,000 / ₦499 refused)", async () => {
    await expect(request(staffA, 10000)).rejects.toThrow(/amount_too_large/);
    await expect(request(staffA, 499)).rejects.toThrow(/amount_too_small/);
    await expect(request(staffA, 10.555)).rejects.toThrow(/invalid_amount/);
    const r = (await request(staffA, 500)).rows[0].res;
    expect(r).toMatchObject({ ok: true, total_withdrawn: 0, pending_amount: 500, balance_left: 1500 });
    expect(Number(r.amount)).toBe(500);
    const pay = (await db.query(`select * from staff_payments where id = $1`, [r.payment_id])).rows[0];
    expect(pay).toMatchObject({ status: "pending", type: "withdrawal", created_by: staffA, bank_name: "Access Bank", account_number: "0123456789", account_name: "ADA TEST" });
    await expect(request(staffA, 500)).rejects.toThrow(/already_requested/);
  });

  it("nothing to withdraw, or not staff, is refused", async () => {
    await expect(request(staffB, 500)).rejects.toThrow(/no_balance/);
    await expect(request(customer, 500)).rejects.toThrow(/forbidden/);
  });

  it("only the owner can approve, once; then it counts as withdrawn", async () => {
    const id = (await db.query(`select id from staff_payments where staff_id = $1 and status = 'pending'`, [staffA])).rows[0].id;
    await expect(review(staffA, id, true)).rejects.toThrow(/forbidden/);
    await expect(review(customer, id, true)).rejects.toThrow(/forbidden/);
    expect((await review(owner, id, true)).rows[0].res).toMatchObject({ status: "paid", total_withdrawn: 500, pending_amount: 0, balance_left: 1500 });
    await expect(review(owner, id, false)).rejects.toThrow(/already_answered/);
    // then ₦1,500 (the rest)
    await expect(request(staffA, 1500.01)).rejects.toThrow(/amount_too_large/);
    const r2 = (await request(staffA, 1500)).rows[0].res;
    expect((await review(owner, r2.payment_id, true)).rows[0].res).toMatchObject({ status: "paid", total_withdrawn: 2000, balance_left: 0 });
    await expect(request(staffA, 500)).rejects.toThrow(/no_balance/);
    const row = (await totals(owner, null)).find((t) => t.user_id === staffA);
    expect(Number(row.total_earnings)).toBe(2000);
    expect(Number(row.total_withdrawn)).toBe(2000);
    expect(row.last_paid_at).not.toBeNull();
  });

  it("a declined request goes back into the balance", async () => {
    await addProducts(staffA, 10, "ada-more"); // +₦1,000
    const r = (await request(staffA)).rows[0].res;
    expect(Number(r.amount)).toBe(1000);
    const d = (await review(owner, r.payment_id, false, "Wrong account number")).rows[0].res;
    expect(d).toMatchObject({ status: "rejected", total_withdrawn: 2000, balance_left: 1000 });
    expect((await db.query(`select admin_note from staff_payments where id = $1`, [r.payment_id])).rows[0].admin_note).toBe("Wrong account number");
  });

  it("staff only see their own requests; nobody can edit or delete them", async () => {
    expect((await as(db, user(staffA), () => db.query(`select status from staff_payments order by created_at`))).rows.map((x) => x.status)).toEqual(["paid", "paid", "rejected"]);
    expect((await as(db, user(staffB), () => db.query(`select * from staff_payments`))).rowCount).toBe(0);
    await expect(totals(staffA, null)).rejects.toThrow(/forbidden/);
    await expect(totals(staffA, staffB)).rejects.toThrow(/forbidden/);
    await expect(as(db, user(staffA), () => db.query(`insert into staff_payments (staff_id, amount) values ($1, 999999)`, [staffA]))).rejects.toThrow();
    expect((await as(db, user(owner), () => db.query(`update staff_payments set amount = 1 returning id`))).rowCount).toBe(0);
    expect((await as(db, user(staffA), () => db.query(`delete from staff_payments returning id`))).rowCount).toBe(0);
  });
});
