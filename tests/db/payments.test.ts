import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: staff payments (withdrawn and balance left)", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let owner: string, staffA: string, staffB: string, customer: string;
  const user = (id: string) => ({ role: "authenticated" as const, userId: id });

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
    // Ada added 25 products → ₦2,000 product earnings.
    const cat = (await db.query(`select id from categories limit 1`)).rows[0].id;
    for (let i = 0; i < 25; i++) {
      await db.query(`insert into products (name, slug, description, category_id, price, status, added_by) values ('Product', $1, '', $2, 100000, 'published', $3)`, [`ada-${i}`, cat, staffA]);
    }
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  const totals = (who: string, target: string | null = null) =>
    as(db, user(who), () => db.query(`select * from staff_payment_totals($1)`, [target]));

  it("staff must add valid bank details before they can be paid", async () => {
    await expect(as(db, user(owner), () => db.query(`select pay_staff($1, 1500)`, [staffA]))).rejects.toThrow(/no_bank_details/);
    await expect(as(db, user(staffA), () => db.query(`select set_my_bank_details('Access Bank', '01234', 'Ada Test')`))).rejects.toThrow(/invalid_account_number/);
    await expect(as(db, user(customer), () => db.query(`select set_my_bank_details('Access Bank', '0123456789', 'Someone')`))).rejects.toThrow(/forbidden/);
    await as(db, user(staffA), () => db.query(`select set_my_bank_details('Access Bank', '012 345 6789', 'Ada Test')`));
    const bank = (await as(db, user(staffA), () => db.query(`select * from staff_bank_details()`))).rows[0];
    expect(bank).toMatchObject({ bank_name: "Access Bank", account_number: "0123456789", account_name: "ADA TEST" });
    await expect(as(db, user(staffA), () => db.query(`select * from staff_bank_details($1)`, [staffB]))).rejects.toThrow(/forbidden/);
    expect((await as(db, user(owner), () => db.query(`select * from staff_bank_details()`))).rowCount).toBe(2);
  });

  it("a payout copies their bank details and waits for them to confirm receipt", async () => {
    const r = await as(db, user(owner), () => db.query(`select pay_staff($1, 1500, 'October payout') as res`, [staffA]));
    expect(r.rows[0].res).toMatchObject({ ok: true, status: "pending", total_earnings: 2000, total_withdrawn: 0, pending_amount: 1500, balance_left: 500 });
    const pay = (await db.query(`select * from staff_payments where id = $1`, [r.rows[0].res.payment_id])).rows[0];
    expect(pay).toMatchObject({ status: "pending", bank_name: "Access Bank", account_number: "0123456789", account_name: "ADA TEST" });
    // only the staff member can answer, once
    await expect(as(db, user(staffB), () => db.query(`select confirm_my_payout($1, true)`, [pay.id]))).rejects.toThrow(/not_found/);
    await expect(as(db, user(owner), () => db.query(`select confirm_my_payout($1, true)`, [pay.id]))).rejects.toThrow(/not_found/);
    const c = await as(db, user(staffA), () => db.query(`select confirm_my_payout($1, true) as res`, [pay.id]));
    expect(c.rows[0].res).toMatchObject({ status: "confirmed", total_withdrawn: 1500, pending_amount: 0, balance_left: 500 });
    await expect(as(db, user(staffA), () => db.query(`select confirm_my_payout($1, false)`, [pay.id]))).rejects.toThrow(/already_answered/);
  });

  it("a payout they didn't receive goes back into their balance", async () => {
    const r = await as(db, user(owner), () => db.query(`select pay_staff($1, 200, 'Test transfer') as res`, [staffA]));
    expect(Number(r.rows[0].res.balance_left)).toBe(300);
    const n = await as(db, user(staffA), () => db.query(`select confirm_my_payout($1, false, 'Nothing arrived') as res`, [r.rows[0].res.payment_id]));
    expect(n.rows[0].res).toMatchObject({ status: "rejected", total_withdrawn: 1500, balance_left: 500 });
    expect((await db.query(`select staff_note from staff_payments where id = $1`, [r.rows[0].res.payment_id])).rows[0].staff_note).toBe("Nothing arrived");
  });

  it("bonuses count straight away and totals add up", async () => {
    await as(db, user(owner), () => db.query(`select pay_staff($1, 300, 'Great week', 'bonus')`, [staffA]));
    const row = (await totals(owner)).rows.find((x) => x.user_id === staffA);
    expect(Number(row.product_earnings)).toBe(2000);
    expect(Number(row.extra_earnings)).toBe(300);
    expect(Number(row.total_earnings)).toBe(2300);
    expect(Number(row.total_withdrawn)).toBe(1500);
    expect(Number(row.balance_left)).toBe(800);
    expect(row.full_name).toBe("Ada");
    expect(row.account_number).toBe("0123456789");
    expect(Number(row.pending_amount)).toBe(0);
  });

  it("the owner sees every staff member, including ones never paid", async () => {
    const rows = (await totals(owner)).rows;
    expect(rows.map((r) => r.email).sort()).toEqual(["ada@example.com", "bayo@example.com"]);
    const bayo = rows.find((r) => r.user_id === staffB);
    expect(Number(bayo.total_withdrawn)).toBe(0);
    expect(Number(bayo.balance_left)).toBe(0);
  });

  it("a staff member sees only their own payments and totals", async () => {
    const mine = await as(db, user(staffA), () => db.query(`select amount, type, status from staff_payments order by created_at`));
    expect(mine.rows.map((r) => [Number(r.amount), r.type, r.status])).toEqual([[1500, "withdrawal", "confirmed"], [200, "withdrawal", "rejected"], [300, "bonus", "confirmed"]]);
    const theirs = await as(db, user(staffB), () => db.query(`select * from staff_payments`));
    expect(theirs.rowCount).toBe(0);
    expect(Number((await totals(staffA, staffA)).rows[0].balance_left)).toBe(800);
    await expect(totals(staffA)).rejects.toThrow(/forbidden/);
    await expect(totals(staffA, staffB)).rejects.toThrow(/forbidden/);
  });

  it("only the owner can pay, and payments can't be edited or deleted", async () => {
    await expect(as(db, user(staffA), () => db.query(`select pay_staff($1, 100000)`, [staffA]))).rejects.toThrow(/forbidden/);
    await expect(as(db, user(customer), () => db.query(`select pay_staff($1, 100)`, [staffA]))).rejects.toThrow(/forbidden/);
    await expect(as(db, user(staffA), () => db.query(`insert into staff_payments (staff_id, amount) values ($1, 999999)`, [staffA]))).rejects.toThrow();
    const upd = await as(db, user(owner), () => db.query(`update staff_payments set amount = 1 returning id`));
    expect(upd.rowCount).toBe(0);
    const del = await as(db, user(staffA), () => db.query(`delete from staff_payments returning id`));
    expect(del.rowCount).toBe(0);
  });

  it("rejects bad payments", async () => {
    await expect(as(db, user(owner), () => db.query(`select pay_staff($1, 0)`, [staffA]))).rejects.toThrow(/invalid_amount/);
    await expect(as(db, user(owner), () => db.query(`select pay_staff($1, 10.555)`, [staffA]))).rejects.toThrow(/invalid_amount/);
    await expect(as(db, user(owner), () => db.query(`select pay_staff($1, 100, null, 'gift')`, [staffA]))).rejects.toThrow(/invalid_type/);
    await expect(as(db, user(owner), () => db.query(`select pay_staff($1, 100)`, [customer]))).rejects.toThrow(/not_staff/);
  });
});
