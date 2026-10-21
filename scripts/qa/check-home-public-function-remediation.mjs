import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Synthetic signatures and representative nested call. This does not connect
// to Supabase or prove that every deployed caller has been inventoried.
const db = new PGlite();
let checks = 0;
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create role service_role nologin; create role supabase_admin nologin;
    create type public.app_role as enum ('admin');
    create function public.assign_child_to_classroom(uuid,uuid,uuid) returns integer
      language sql volatile security definer as $$ select 1 $$;
    create function public.assign_staff_to_classroom(uuid,uuid,uuid,text) returns integer
      language sql volatile security definer as $$ select 1 $$;
    create function public.escalate_task(uuid,text,uuid) returns integer
      language sql volatile security definer as $$ select 1 $$;
    create function public.notify_role(uuid,public.app_role,text,text,text,uuid) returns integer
      language sql volatile security definer as $$ select 1 $$;
    create function public.process_monthly_inspection_reminders(timestamptz) returns integer
      language plpgsql volatile security definer set search_path=pg_catalog as $$
      begin return public.notify_role(null,'admin',null,null,null,null); end $$;
    grant execute on all functions in schema public to anon,authenticated,service_role;`);
  const sql = readFileSync("DIGITAL_OBSERVER_HOME_PUBLIC_FUNCTION_REMEDIATION_PROPOSAL_20261021.sql", "utf8");
  await db.exec(sql);
  const signatures = ["assign_child_to_classroom(uuid,uuid,uuid)",
    "assign_staff_to_classroom(uuid,uuid,uuid,text)", "escalate_task(uuid,text,uuid)",
    "notify_role(uuid,app_role,text,text,text,uuid)",
    "process_monthly_inspection_reminders(timestamp with time zone)"];
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`set role ${role}`);
    for (const [i, signature] of signatures.entries()) {
      const allowed = (await db.query("select has_function_privilege(current_user,$1,'EXECUTE') allowed", [`public.${signature}`])).rows[0].allowed;
      const expected = role === "anon" ? false : role === "authenticated" ? i < 3 : i !== 3;
      assert.equal(allowed, expected, `${role} ${signature}`); checks++;
    }
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.equal((await db.query("select public.process_monthly_inspection_reminders(now()) n")).rows[0].n, 1); checks++;
  await db.exec("reset role");
  await db.exec("set role anon");
  await assert.rejects(db.query("select public.notify_role(null,'admin',null,null,null,null)"), /permission denied/); checks++;
  await db.exec("reset role");
  // Future-only grants: implicit PUBLIC and schema grants must BOTH be removed.
  await db.exec(`alter default privileges for role postgres revoke execute on functions from public;
    alter default privileges for role postgres in schema public revoke execute on functions from anon,authenticated,service_role;
    create function public.synthetic_future_privileged() returns integer
      language sql volatile security definer as $$ select 1 $$;`);
  await db.exec("set role anon");
  assert.equal((await db.query("select has_function_privilege(current_user,'public.synthetic_future_privileged()','EXECUTE') allowed")).rows[0].allowed, false); checks++;
  await db.exec("reset role");
  assert.equal((await db.query("select public.synthetic_future_privileged() n")).rows[0].n, 1); checks++;
} finally { await db.close(); }
console.log(`home public function remediation: ${checks}/${checks} isolated checks PASS`);
