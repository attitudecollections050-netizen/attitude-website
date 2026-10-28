import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { as, createTestDatabase, createUser, TEST_DB_URL } from "./harness";

const run = TEST_DB_URL ? describe : describe.skip;

run("database: international store (currencies, rates, translations, preferences)", () => {
  let db: Client;
  let drop: () => Promise<void>;
  let admin: string, alice: string;
  const anon = { role: "anon" };

  beforeAll(async () => {
    const t = await createTestDatabase("ac_intl_" + process.pid);
    drop = t.drop;
    db = new Client({ connectionString: t.url });
    await db.connect();
    admin = await createUser(db, "owner@example.com");
    alice = await createUser(db, "alice@example.com");
    await db.query(`select public.grant_role_by_email('owner@example.com', 'admin')`);
  });

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  const user = (id: string) => ({ role: "authenticated", userId: id });

  it("seeds NGN as the base currency and charges in NGN only", async () => {
    const { rows } = await db.query(`select code, is_enabled, markup_bps from currencies where code = 'NGN'`);
    expect(rows[0]).toEqual({ code: "NGN", is_enabled: true, markup_bps: 0 });
    await expect(db.query(`update currencies set is_enabled = false where code = 'NGN'`)).rejects.toThrow(/ngn_is_base/);
    await expect(db.query(`update currencies set markup_bps = 100 where code = 'NGN'`)).rejects.toThrow(/ngn_is_base/);
    const intl = (await db.query(`select value from store_settings where key = 'intl'`)).rows[0].value;
    expect(intl.payment_currencies).toEqual(["NGN"]);
  });

  it("rejects invalid rates and markups", async () => {
    await expect(db.query(`insert into exchange_rates (currency, rate, source) values ('USD', 0, 'x')`)).rejects.toThrow();
    await expect(db.query(`insert into exchange_rates (currency, rate, source) values ('USD', -1, 'x')`)).rejects.toThrow();
    await expect(db.query(`update currencies set markup_bps = 9000 where code = 'USD'`)).rejects.toThrow();
  });

  it("shoppers can read currencies and rates but not change them", async () => {
    await db.query(`insert into exchange_rates (currency, rate, source) values ('USD', 0.00065, 'test') on conflict (currency) do update set rate = excluded.rate`);
    const read = await as(db, anon, () => db.query(`select currency, rate from exchange_rates`));
    expect(read.rows.length).toBe(1);
    for (const actor of [anon, user(alice)]) {
      const r = await as(db, actor, () => db.query(`update exchange_rates set rate = 1 where currency = 'USD' returning currency`));
      expect(r.rowCount).toBe(0);
      const c = await as(db, actor, () => db.query(`update currencies set is_enabled = true where code = 'JPY' returning code`));
      expect(c.rowCount).toBe(0);
      await expect(as(db, actor, () => db.query(`insert into translation_overrides (locale, key, value) values ('fr', 'cart.bag', 'x')`))).rejects.toThrow();
    }
    expect((await db.query(`select rate from exchange_rates where currency = 'USD'`)).rows[0].rate).toBe("0.000650000000");
  });

  it("only admins see the rate log and manage translations", async () => {
    await db.query(`insert into exchange_rate_log (source, ok, message) values ('test', false, 'down')`);
    expect((await as(db, anon, () => db.query(`select * from exchange_rate_log`))).rowCount).toBe(0);
    expect((await as(db, user(alice), () => db.query(`select * from exchange_rate_log`))).rowCount).toBe(0);
    expect((await as(db, user(admin), () => db.query(`select * from exchange_rate_log`))).rowCount).toBe(1);
    await as(db, user(admin), () => db.query(`insert into translation_overrides (locale, key, value) values ('fr', 'cart.bag', 'Mon sac')`));
    expect((await as(db, anon, () => db.query(`select value from translation_overrides`))).rows).toEqual([{ value: "Mon sac" }]);
    const upd = await as(db, user(admin), () => db.query(`update currencies set markup_bps = 200 where code = 'USD' returning code`));
    expect(upd.rowCount).toBe(1);
  });

  it("customers save their own preferences only, and can't touch roles", async () => {
    await as(db, user(alice), () => db.query(`update profiles set preferred_locale = 'fr', preferred_country = 'GB', preferred_currency = 'GBP' where id = $1`, [alice]));
    const mine = (await db.query(`select preferred_locale, preferred_country, preferred_currency from profiles where id = $1`, [alice])).rows[0];
    expect(mine).toEqual({ preferred_locale: "fr", preferred_country: "GB", preferred_currency: "GBP" });
    const other = await as(db, user(alice), () => db.query(`update profiles set preferred_locale = 'de' where id = $1 returning id`, [admin]));
    expect(other.rowCount).toBe(0);
    await expect(as(db, user(alice), () => db.query(`update profiles set preferred_locale = 'french' where id = $1`, [alice]))).rejects.toThrow();
    const roles = (await db.query(`select count(*)::int as n from user_roles where user_id = $1`, [alice])).rows[0].n;
    expect(roles).toBe(0);
  });

  it("orders keep the display snapshot separate from the NGN total", async () => {
    const { rows } = await db.query(
      `insert into orders (email, phone, customer_name, shipping_address, shipping_method_name, currency, subtotal, discount_total, shipping_fee, tax_total, total,
                           status, payment_status, idempotency_key, display_currency, display_rate, display_total, locale)
       values ('a@example.com', '+2348000000000', 'A', '{}'::jsonb, 'Standard', 'NGN', 7800000, 0, 250000, 0, 8050000, 'pending_payment', 'unpaid', 'intl-1', 'USD', 0.00065, 52.33, 'en')
       returning total, display_total`,
    );
    expect(rows[0]).toEqual({ total: 8050000, display_total: "52.33" });
    await expect(db.query(`update orders set display_rate = 0 where idempotency_key = 'intl-1'`)).rejects.toThrow();
  });
});
