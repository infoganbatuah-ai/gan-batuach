import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Isolated synthetic catalog only; never run against Production.
const db = new PGlite();
let checks = 0;
try {
  await db.exec(`create role anon nologin;
    create role authenticated nologin;
    create table public.synthetic_effects (id integer);
    create function public.synthetic_unsafe_notify() returns void
      language plpgsql volatile security definer set search_path=pg_catalog as $$
      begin insert into public.synthetic_effects values (1); end $$;`);
  await db.exec(readFileSync("supabase/migrations/20261021010000_home_legacy_compare_reader_preparation.sql", "utf8"));
  assert.equal((await db.query("select count(*)::int n from pg_roles where rolname='home_legacy_compare_reader'")).rows[0].n, 0); checks++;
  assert.equal((await db.query("select count(*)::int n from pg_namespace where nspname='private_home_legacy_compare'")).rows[0].n, 0); checks++;
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.synthetic_effects"), /permission denied/); checks++;
  assert.equal((await db.query("select has_function_privilege(current_user,'public.synthetic_unsafe_notify()','EXECUTE') allowed")).rows[0].allowed, true); checks++;
  await db.query("select public.synthetic_unsafe_notify()");
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int n from public.synthetic_effects")).rows[0].n, 1); checks++;
  await db.exec("revoke execute on function public.synthetic_unsafe_notify() from public");
  await db.exec("set role anon");
  assert.equal((await db.query("select has_function_privilege(current_user,'public.synthetic_unsafe_notify()','EXECUTE') allowed")).rows[0].allowed, false); checks++;
  await assert.rejects(db.query("select public.synthetic_unsafe_notify()"), /permission denied/); checks++;
  await db.exec("reset role");
  await db.exec("grant execute on function public.synthetic_unsafe_notify() to public");
  await db.exec("set role anon");
  assert.equal((await db.query("select has_function_privilege(current_user,'public.synthetic_unsafe_notify()','EXECUTE') allowed")).rows[0].allowed, true); checks++;
} finally { await db.close(); }
console.log(`home legacy public-execute synthetic clone: ${checks}/${checks} PASS`);
