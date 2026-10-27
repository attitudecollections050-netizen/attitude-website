// Spins up a throwaway database on TEST_DATABASE_URL, applies the Supabase
// stub + all migrations + demo seed, and offers helpers to act as roles.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(import.meta.dirname, "../..");
export const TEST_DB_URL = process.env.TEST_DATABASE_URL;

export async function createTestDatabase(name: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const admin = new Client({ connectionString: TEST_DB_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(TEST_DB_URL!);
  url.pathname = `/${name}`;
  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  await c.query(readFileSync(path.join(ROOT, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(ROOT, "supabase/migrations");
  for (const f of readdirSync(dir).sort()) await c.query(readFileSync(path.join(dir, f), "utf8"));
  await c.query(readFileSync(path.join(ROOT, "supabase/seed.sql"), "utf8"));
  await c.end();
  return {
    url: url.toString(),
    drop: async () => {
      const a = new Client({ connectionString: TEST_DB_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export type Actor = { role: "anon" | "authenticated" | "service_role"; userId?: string };

/** Runs `fn` inside a transaction as the given Supabase role (RLS applies). */
export async function as<T>(db: Client, actor: Actor, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${actor.role}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [actor.userId ?? ""]);
    const out = await fn();
    await db.query("commit");
    return out;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

export async function createUser(db: Client, email: string): Promise<string> {
  const { rows } = await db.query(`insert into auth.users (email) values ($1) returning id`, [email]);
  return rows[0].id;
}
