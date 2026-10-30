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

  it("the owner pays a staff member and gets the new totals back", async () => {
    const r = await as(db, user(owner), () => db.query(`select pay_staff($1, 1500, 'October payout') as res`, [staffA]));
    expect(r.rows[0].res).toMatchObject({ ok: true, total_earnings: 2000, total_withdrawn: 1500, balance_left: 500 });
    await as(db, user(owner), () => db.query(`select pay_staff($1, 300, 'Great week', 'bonus')`, [staffA]));
    const row = (await totals(owner)).rows.find((x) => x.user_id === staffA);
    expect(Number(row.product_earnings)).toBe(2000);
    expect(Number(row.extra_earnings)).toBe(300);
    expect(Number(row.total_earnings)).toBe(2300);
    expect(Number(row.total_withdrawn)).toBe(1500);
    expect(Number(row.balance_left)).toBe(800);
    expect(row.full_name).toBe("Ada");
  });

  it("the owner sees every staff member, including ones never paid", async () => {
    const rows = (await totals(owner)).rows;
    expect(rows.map((r) => r.email).sort()).toEqual(["ada@example.com", "bayo@example.com"]);
    const bayo = rows.find((r) => r.user_id === staffB);
    expect(Number(bayo.total_withdrawn)).toBe(0);
    expect(Number(bayo.balance_left)).toBe(0);
  });

  it("a staff member sees only their own payments and totals", async () => {
    const mine = await as(db, user(staffA), () => db.query(`select amount, type, description from staff_payments order by created_at`));
    expect(mine.rows.map((r) => [Number(r.amount), r.type])).toEqual([[1500, "withdrawal"], [300, "bonus"]]);
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
