import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: staff work ratings, auto ₦25 bonus/penalty and Haru notifications", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let owner: string, staffA: string, staffB: string;
  let cat: string;
  let n = 0;
  const user = (id: string) => ({ role: "authenticated" as const, userId: id });

  // Staff work is logged by the database itself when a product is added.
  const addProduct = async (who: string) => {
    n += 1;
    const r = await db.query(`insert into products (name, slug, description, category_id, price, status, added_by) values ($1, $2, '', $3, 100000, 'published', $4) returning id`, [`Dress ${n}`, `rate-${n}`, cat, who]);
    return (await db.query(`select id from staff_tasks where product_id = $1`, [r.rows[0].id])).rows[0]?.id as string | undefined;
  };
  const rate = (who: string, task: string, rating: string, reason: string | null = null) =>
    as(db, user(who), () => db.query(`select rate_staff_task($1, $2, $3) as res`, [task, rating, reason])).then((r) => r.rows[0].res);
  const balance = async (who: string) => Number((await as(db, user(who), () => db.query(`select balance_left from staff_payment_totals($1)`, [who]))).rows[0].balance_left);
  const myNotes = async (who: string) => (await as(db, user(who), () => db.query(`select * from staff_notifications order by created_at desc, id`))).rows;

  beforeAll(async () => {
    const t = await createTestDatabase("ac_rate_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    owner = await createUser(db, "owner@example.com");
    staffA = await createUser(db, "ada@example.com");
    staffB = await createUser(db, "bayo@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
    for (const [id, email, name] of [[staffA, "ada@example.com", "Ada"], [staffB, "bayo@example.com", "Bayo"]]) {
      await db.query(`insert into staff_members (user_id, email, full_name, role, status) values ($1, $2, $3, 'product_staff', 'active')`, [id, email, name]);
      await db.query(`insert into user_roles (user_id, role) values ($1, 'product_staff')`, [id]);
    }
    cat = (await db.query(`select id from categories limit 1`)).rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  it("staff work is logged automatically and the owner is notified; the owner's own work is not", async () => {
    const t = await addProduct(staffA);
    expect(t).toBeDefined();
    const task = (await db.query(`select * from staff_tasks where id = $1`, [t])).rows[0];
    expect(task).toMatchObject({ staff_id: staffA, staff_email: "ada@example.com", task_type: "upload_product", status: "pending_review" });
    expect(task.task_details).toMatch(/Uploaded product “Dress 1”/);
    const adminNotes = await myNotes(owner);
    expect(adminNotes[0]).toMatchObject({ to_role: "admin", type: "task_done", task_id: t, link: "/admin/staff-tasks" });
    expect(adminNotes[0].message).toMatch(/^Ada just finished: Uploaded product/);
    expect(await addProduct(owner)).toBeUndefined();
  });

  it("setting an order item's design is logged as staff work, with the order number", async () => {
    const o = (await db.query(
      `insert into orders (email, phone, customer_name, shipping_address, shipping_method_name, currency, subtotal, discount_total, shipping_fee, tax_total, total, status, payment_status, idempotency_key)
       values ('c@example.com', '+2348000000000', 'Okoh', '{}'::jsonb, 'Standard', 'NGN', 1000, 0, 0, 0, 1000, 'paid', 'paid', 'rate-order') returning id, order_number`,
    )).rows[0];
    const item = (await db.query(`insert into order_items (order_id, product_name, unit_price, quantity, line_total) values ($1, 'Pink Tee', 1000, 1, 1000) returning id`, [o.id])).rows[0].id;
    await db.query(`update order_items set selected_image = '/x/3.jpg', selected_variant_name = 'Photo 3 of 10', selected_set_by = $1 where id = $2`, [staffA, item]);
    const task = (await db.query(`select * from staff_tasks where order_item_id = $1`, [item])).rows[0];
    expect(task).toMatchObject({ task_type: "set_design", order_id: o.id, link: `/admin/orders/${o.id}`, status: "pending_review" });
    expect(task.task_details).toBe(`Set design “Photo 3 of 10” for Pink Tee (Order ${o.order_number})`);
    await db.query(`delete from staff_tasks where id = $1`, [task.id]); // keep the streak tests below simple
    // The owner setting it isn't logged.
    await db.query(`update order_items set selected_image = '/x/4.jpg', selected_set_by = $1 where id = $2`, [owner, item]);
    expect((await db.query(`select count(*)::int as c from staff_tasks where order_item_id = $1`, [item])).rows[0].c).toBe(0);
  });

  it("only the owner can rate; Poor needs a reason; a task can't be rated twice", async () => {
    const t = (await addProduct(staffA))!;
    await expect(rate(staffA, t, "good")).rejects.toThrow(/forbidden/);
    await expect(rate(owner, t, "poor")).rejects.toThrow(/reason_required/);
    await expect(rate(owner, t, "meh")).rejects.toThrow(/invalid_rating/);
    expect(await rate(owner, t, "good")).toMatchObject({ ok: true, good_streak: 1, poor_streak: 0, bonus: 0 });
    await expect(rate(owner, t, "poor", "Wrong photo")).rejects.toThrow(/already_rated/);
  });

  it("3 Good in a row adds ₦25 and Haru celebrates", async () => {
    await addProducts10(staffA); // earn ₦1,000 so there is a balance
    // The first test's task is still waiting; the good streak is already 1 from the previous test.
    const first = [(await db.query(`select id from staff_tasks where staff_id = $1 and status = 'pending_review' order by created_at limit 1`, [staffA])).rows[0].id, (await addProduct(staffA))!];
    const before = await balance(staffA);
    expect(await rate(owner, first[0], "good", "Lovely photos")).toMatchObject({ good_streak: 2, bonus: 0 });
    let notes = await myNotes(staffA);
    expect(notes[0]).toMatchObject({ to_role: "staff", type: "rated_good", title: "Good job! Keep it up! ✨" });
    expect(notes[0].message).toMatch(/Sugoi! Amazing work!.*Lovely photos\..*2\/3\. One more for a ₦25 bonus!/);
    const r = await rate(owner, first[1], "good");
    expect(r).toMatchObject({ good_streak: 0, bonus: 25 });
    expect(await balance(staffA)).toBe(before + 25);
    notes = await myNotes(staffA);
    expect(notes[0]).toMatchObject({ type: "bonus", title: "Bonus! ₦25 Added! 🎉", link: "/staff/earnings" });
    expect(notes[0].message).toContain(`Your balance is now ₦${(before + 25).toLocaleString("en-US")}`);
    const pay = (await db.query(`select * from staff_payments where staff_id = $1 and type = 'bonus'`, [staffA])).rows;
    expect(pay).toHaveLength(1);
    expect(Number(pay[0].amount)).toBe(25);
  });

  it("a Poor resets the good streak; 3 Poor in a row takes ₦25 off with encouragement", async () => {
    const before = await balance(staffA);
    const tasks = [(await addProduct(staffA))!, (await addProduct(staffA))!, (await addProduct(staffA))!];
    expect(await rate(owner, tasks[0], "poor", "Wrong design for Product X")).toMatchObject({ poor_streak: 1, good_streak: 0, penalty: 0 });
    let notes = await myNotes(staffA);
    expect(notes[0]).toMatchObject({ type: "rated_poor", title: "Needs correction - Wrong design for Product X" });
    expect(notes[0].message).toMatch(/rated POOR\.\.\. Reason: Wrong design for Product X\. Please go back and fix it, okay\? You can do it! 💪 Poor streak: 1\/3/);
    expect(notes[0].link).toMatch(/^\/admin\/products\//);
    expect((await rate(owner, tasks[1], "poor", "Blurry photo")).poor_streak).toBe(2);
    expect((await myNotes(staffA))[0].message).toMatch(/one more in a row and ₦25 comes off/);
    expect(await rate(owner, tasks[2], "poor", "Price is wrong")).toMatchObject({ poor_streak: 0, penalty: 25 });
    expect(await balance(staffA)).toBe(before - 25);
    notes = await myNotes(staffA);
    expect(notes[0]).toMatchObject({ type: "penalty", title: "₦25 Deducted - Try Harder" });
    expect(notes[0].message).toMatch(/I know you can do better!.*so ₦25 was deducted\..*Reason: Price is wrong.*I believe in you!/);
  });

  it("a penalty never takes the balance below ₦0", async () => {
    for (let i = 0; i < 3; i++) await rate(owner, (await addProduct(staffB))!, "poor", "Wrong product");
    expect(await balance(staffB)).toBe(0);
    expect((await db.query(`select count(*)::int as c from staff_payments where staff_id = $1`, [staffB])).rows[0].c).toBe(0);
    expect((await myNotes(staffB))[0].message).toMatch(/Your balance is ₦0, so nothing was deducted/);
  });

  it("staff can mark a Poor task corrected; the owner is told and can rate it again", async () => {
    const t = (await addProduct(staffA))!;
    await rate(owner, t, "poor", "Missing sizes");
    await expect(as(db, user(staffB), () => db.query(`select mark_task_corrected($1)`, [t]))).rejects.toThrow(/not_found/);
    await as(db, user(staffA), () => db.query(`select mark_task_corrected($1)`, [t]));
    await expect(as(db, user(staffA), () => db.query(`select mark_task_corrected($1)`, [t]))).rejects.toThrow(/not_poor/);
    expect((await myNotes(owner))[0]).toMatchObject({ type: "corrected", task_id: t });
    expect(await rate(owner, t, "good", "Fixed, thank you")).toMatchObject({ good_streak: 1, poor_streak: 0 });
  });

  it("everyone sees only their own notifications, can only mark those read, and can't write any", async () => {
    const a = await myNotes(staffA);
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((x) => x.to_role === "staff" && x.staff_id === staffA)).toBe(true);
    expect((await myNotes(staffB)).every((x) => x.staff_id === staffB)).toBe(true);
    expect((await myNotes(owner)).every((x) => x.to_role === "admin")).toBe(true);
    expect((await as(db, user(staffB), () => db.query(`select mark_notifications_read($1::uuid[]) as n`, [[a[0].id]]))).rows[0].n).toBe(0);
    expect((await as(db, user(staffA), () => db.query(`select mark_notifications_read(null) as n`))).rows[0].n).toBe(a.length);
    await expect(as(db, user(staffA), () => db.query(`insert into staff_notifications (to_role, title, message, type) values ('admin', 'x', 'x', 'bonus')`))).rejects.toThrow();
    await expect(as(db, user(staffA), () => db.query(`insert into staff_tasks (staff_id, task_type, task_details) values ($1, 'set_design', 'fake')`, [staffA]))).rejects.toThrow();
    expect((await as(db, user(staffA), () => db.query(`update staff_members set good_streak = 2 returning user_id`))).rowCount).toBe(0);
    await expect(as(db, user(staffA), () => db.query(`select log_staff_task($1, 'set_design', 'fake')`, [staffA]))).rejects.toThrow();
  });

  const addProducts10 = async (who: string) => {
    for (let i = 0; i < 10; i++) {
      n += 1;
      await db.query(`insert into products (name, slug, description, category_id, price, status) values ('Bulk', $1, '', $2, 100000, 'published')`, [`bulk-${n}`, cat]);
    }
    // Credit the products to the staff member without creating 10 more tasks.
    await db.query(`update products set added_by = $1 where slug like 'bulk-%' and added_by is null`, [who]);
  };
});
