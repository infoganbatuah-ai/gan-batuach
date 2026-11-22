import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../../supabase/migrations/20261116224059_push44_atomic_notification_preferences.sql", import.meta.url), "utf8");
const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create role authenticated;
    create role anon;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.profiles (id uuid primary key, role text not null, active boolean not null default true);
    create table public.communication_preferences (
      id uuid primary key default gen_random_uuid(), profile_id uuid not null unique references public.profiles(id),
      receive_sms boolean not null default false, receive_whatsapp boolean not null default false,
      receive_email boolean not null default true, receive_push boolean not null default true,
      critical_push_allowed boolean not null default true, emergency_messages_allowed boolean not null default true,
      preferred_language text not null default 'he', parent_daily_digest_enabled boolean not null default true,
      parent_ai_summary_enabled boolean not null default true, parent_category_channels jsonb not null default '{}'::jsonb,
      notification_category_channels jsonb not null default '{}'::jsonb,
      quiet_hours_start time, quiet_hours_end time, quiet_hours_timezone text not null default 'Asia/Jerusalem',
      updated_at timestamptz not null default now()
    );
    create table public.push_category_preferences (
      id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id),
      category text not null, enabled boolean not null default true, role text,
      updated_at timestamptz not null default now(), unique(profile_id,category)
    );
    insert into public.profiles(id,role) values ('${userA}','parent'),('${userB}','parent');
  `);
  await db.exec(migration);
  const call = async (patch, categories, user = userA) => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return db.query("select (public.save_communication_preferences_atomic($1::jsonb,$2::jsonb)).profile_id", [
      JSON.stringify(patch), categories === null ? null : JSON.stringify(categories)
    ]);
  };
  const state = async () => ({
    preferences: (await db.query("select profile_id, receive_push from public.communication_preferences order by profile_id")).rows,
    categories: (await db.query("select profile_id, category, enabled from public.push_category_preferences order by profile_id, category")).rows
  });
  return { db, call, state };
}

test("both preference tables change in one successful local transaction", async () => {
  const f = await fixture();
  try {
    await f.call({ receive_push: false }, { important: false });
    const state = await f.state();
    assert.deepEqual(state.preferences, [{ profile_id: userA, receive_push: false }]);
    assert.deepEqual(state.categories, [{ profile_id: userA, category: "important", enabled: false }]);
  } finally { await f.db.close(); }
});

test("a first-table failure changes neither table", async () => {
  const f = await fixture();
  try {
    await f.call({ receive_push: true }, { important: true });
    const before = await f.state();
    await f.db.exec("create function reject_preference_write() returns trigger language plpgsql as $$ begin raise exception 'forced first write failure'; end $$; create trigger fail_preference before update on public.communication_preferences for each row execute function reject_preference_write();");
    await assert.rejects(f.call({ receive_push: false }, { important: false }), /forced first write failure/);
    assert.deepEqual(await f.state(), before);
  } finally { await f.db.close(); }
});

test("a second-table failure rolls back the first write", async () => {
  const f = await fixture();
  try {
    await f.call({ receive_push: true }, { important: true });
    const before = await f.state();
    await f.db.exec("create function reject_category_write() returns trigger language plpgsql as $$ begin raise exception 'forced second write failure'; end $$; create trigger fail_category before update on public.push_category_preferences for each row execute function reject_category_write();");
    await assert.rejects(f.call({ receive_push: false }, { important: false }), /forced second write failure/);
    assert.deepEqual(await f.state(), before);
  } finally { await f.db.close(); }
});

test("caller cannot choose another profile and unsupported category is rejected", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.call({ profile_id: userB, receive_push: false }, { important: false }), /unsupported preference key/);
    await assert.rejects(f.call({ receive_push: false }, { other: false }), /invalid push category preference/);
    await f.call({ receive_push: false }, { important: false }, userB);
    const state = await f.state();
    assert.deepEqual(state.preferences, [{ profile_id: userB, receive_push: false }]);
    assert.deepEqual(state.categories, [{ profile_id: userB, category: "important", enabled: false }]);
  } finally { await f.db.close(); }
});

test("authenticated invoker is limited to its own rows; anon cannot execute", async () => {
  const f = await fixture();
  try {
    await f.db.exec(`
      grant usage on schema auth to authenticated;
      grant select on public.profiles to authenticated;
      grant select, insert, update on public.communication_preferences, public.push_category_preferences to authenticated;
      alter table public.profiles enable row level security;
      alter table public.communication_preferences enable row level security;
      alter table public.push_category_preferences enable row level security;
      create policy own_profile on public.profiles for select to authenticated using (id = auth.uid());
      create policy own_preferences on public.communication_preferences for all to authenticated
        using (profile_id = auth.uid()) with check (profile_id = auth.uid());
      create policy own_categories on public.push_category_preferences for all to authenticated
        using (profile_id = auth.uid()) with check (profile_id = auth.uid());
    `);
    await f.db.query("select set_config('request.jwt.claim.sub', $1, false)", [userA]);
    await f.db.exec("set role anon");
    await assert.rejects(f.db.query("select public.save_communication_preferences_atomic('{}'::jsonb, null)"), /permission denied/);
    await f.db.exec("reset role");
    await f.db.exec("set role authenticated");
    await f.db.query("select public.save_communication_preferences_atomic('{\"receive_push\":false}'::jsonb, '{\"important\":false}'::jsonb)");
    const own = await f.db.query("select profile_id from public.communication_preferences");
    assert.deepEqual(own.rows, [{ profile_id: userA }]);
    await f.db.exec("reset role");
    const state = await f.state();
    assert.equal(state.preferences.length, 1);
    assert.equal(state.preferences[0].profile_id, userA);
  } finally { await f.db.close(); }
});
