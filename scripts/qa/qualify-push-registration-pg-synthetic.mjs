// Isolated PostgreSQL qualification for the guarded, review-only Push candidate.
// No host port, mounts, external network, real accounts, or canonical database.
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";

const container = "digital-observer-pgqa-20261026";
const database = `pgqa_push_binding_${Date.now()}`;
const source = readFileSync("review-only/push-registration-binding/forward.sql", "utf8");
const guard = "do $$ begin raise exception 'REVIEW_ONLY_PUSH_BINDING_MUST_NOT_RUN'; end $$;";
if (!source.includes(guard) || source.split(guard).length !== 2 || !source.includes("-- REVIEW ONLY / NOT A MIGRATION")) {
  throw new Error("Guarded source changed; refusing candidate extraction");
}
const candidate = source.replace(guard, "-- Guard removed only in the disposable synthetic database.");
const preflightSection = source.split("-- Blocking preflight:")[1]?.split("-- The predicate is deliberately Observer-only.")[0];
const preflight = preflightSection?.slice(preflightSection.indexOf("do $$"));
if (!preflightSection?.includes("do $$") || !preflight?.includes("PUSH_BINDING_ACTIVE_INSTALLATION_CONFLICT")
  || !preflight.includes("PUSH_BINDING_LEGACY_ROWS_REQUIRE_OWNER_REVIEW")) {
  throw new Error("Candidate preflight markers changed; refusing synthetic test");
}

function docker(args, input, timeout = 30_000) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout, maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  return result;
}

function psql(sql, db = database, timeout = 30_000) {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", db], sql, timeout);
}

function mustPass(name, sql) {
  const result = psql(sql);
  if (result.status !== 0) throw new Error(`${name}: ${result.stderr.trim()}`);
  console.log(`PASS ${name}`);
  return result.stdout.trim();
}

function mustFail(name, sql, expected) {
  const result = psql(sql);
  if (result.status === 0 || !result.stderr.includes(expected)) {
    throw new Error(`${name}: expected ${expected}; got status=${result.status}, stderr=${result.stderr.trim()}`);
  }
  console.log(`PASS ${name} (denied)`);
}

const user = {
  owner: "11111111-1111-4111-8111-111111111111",
  other: "22222222-2222-4222-8222-222222222222",
  admin: "33333333-3333-4333-8333-333333333333",
  parent: "44444444-4444-4444-8444-444444444444"
};
const session = {
  owner: "aaaaaaaa-1111-4111-8111-111111111111",
  other: "aaaaaaaa-2222-4222-8222-222222222222",
  admin: "aaaaaaaa-3333-4333-8333-333333333333",
  parent: "aaaaaaaa-4444-4444-8444-444444444444",
  expired: "aaaaaaaa-5555-4555-8555-555555555555"
};
const site = {
  owner: "bbbbbbbb-1111-4111-8111-111111111111",
  other: "bbbbbbbb-2222-4222-8222-222222222222"
};

function context(role, uid, sid, statement) {
  return `begin;
set role ${role};
select set_config('request.jwt.claim.role', '${role}', false);
select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
select set_config('request.jwt.claim.session_id', '${sid ?? ""}', false);
${statement}
commit;`;
}

function actor(who, statement, role = "authenticated", sid = session[who]) {
  return context(role, user[who], sid, statement);
}

function token(profile, device, providerToken, boundSite, sourceName = "digital_observer_native") {
  const metadata = JSON.stringify({ source: sourceName, observer_site_id: boundSite });
  return `insert into public.push_device_tokens
    (profile_id,role,platform,device_token,device_id,metadata)
    values ('${user[profile]}','${profile === "admin" ? "admin" : "parent"}',
      'ios','${providerToken}','${device}','${metadata}'::jsonb);`;
}

function count(where) {
  const result = psql(`select count(*) from public.push_device_tokens where ${where};`);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return Number(result.stdout.trim());
}

function assertCount(name, where, expected) {
  const actual = count(where);
  if (actual !== expected) throw new Error(`${name}: expected ${expected} rows; got ${actual}`);
  console.log(`PASS ${name}`);
}

function asyncPsql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database]);
    const deadline = setTimeout(() => child.kill("SIGKILL"), 15_000);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(deadline); reject(error); });
    child.on("close", (status) => { clearTimeout(deadline); resolve({ status, stdout, stderr }); });
    child.stdin.end(sql);
  });
}

const fixture = `
begin;
create schema auth;
create type public.app_role as enum ('admin','inspector','manager','staff','parent');
create table public.profiles (id uuid primary key, role public.app_role not null, active boolean not null default true);
create table public.observer_sites (
  id uuid primary key, site_type text not null, garden_id uuid,
  owner_profile_id uuid references public.profiles(id), active boolean not null default true);
create table public.observer_site_memberships (
  observer_site_id uuid not null references public.observer_sites(id),
  profile_id uuid not null references public.profiles(id),
  member_role text not null, active boolean not null default true,
  unique(observer_site_id, profile_id));
create table auth.sessions (id uuid primary key, user_id uuid not null, not_after timestamptz);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role',true),'') $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select jsonb_build_object('session_id', current_setting('request.jwt.claim.session_id',true)) $$;
create function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active = true $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin' $$;
create function public.digital_observer_current_session_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s
    where s.id = case
      when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (auth.jwt()->>'session_id')::uuid else null end
    and s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > pg_catalog.statement_timestamp())
  ) $$;
create table public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  role text not null, platform text not null,
  device_token text not null unique, device_id text,
  app_version text, is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  token_hash text, disabled_reason text, revoked_at timestamptz,
  provider text not null default 'mock', last_error text,
  constraint push_device_tokens_platform_check check (platform in ('web','android','ios'))
);
alter table public.push_device_tokens enable row level security;
create policy "push tokens own read" on public.push_device_tokens for select
  using (public.is_admin() or profile_id = auth.uid());
create policy "push tokens own insert" on public.push_device_tokens for insert
  with check (public.is_admin() or profile_id = auth.uid());
create policy "push tokens own update" on public.push_device_tokens for update
  using (public.is_admin() or profile_id = auth.uid())
  with check (public.is_admin() or profile_id = auth.uid());
grant usage on schema public, auth to authenticated, anon, service_role;
grant execute on function auth.uid(), auth.role(), auth.jwt() to authenticated, anon, service_role;
grant execute on function public.current_role(), public.is_admin(), public.digital_observer_current_session_active()
  to authenticated, service_role;
grant select, insert, update, delete on public.push_device_tokens to authenticated, service_role;
insert into public.profiles(id,role) values
  ('${user.owner}','parent'),('${user.other}','parent'),
  ('${user.admin}','admin'),('${user.parent}','parent');
insert into public.observer_sites(id,site_type,owner_profile_id) values
  ('${site.owner}','home','${user.owner}'),
  ('${site.other}','home','${user.other}');
insert into public.observer_site_memberships(observer_site_id,profile_id,member_role) values
  ('${site.owner}','${user.other}','operator');
insert into auth.sessions(id,user_id,not_after) values
  ('${session.owner}','${user.owner}',now()+interval '1 day'),
  ('${session.other}','${user.other}',now()+interval '1 day'),
  ('${session.admin}','${user.admin}',now()+interval '1 day'),
  ('${session.parent}','${user.parent}',now()+interval '1 day'),
  ('${session.expired}','${user.owner}',now()-interval '1 day');
commit;`;

const isolation = docker(["inspect", "--format", "{{.Config.Image}}|{{.State.Running}}|{{.HostConfig.NetworkMode}}|{{json .Mounts}}|{{json .HostConfig.PortBindings}}", container]);
if (isolation.status !== 0 || isolation.stdout.trim() !== "public.ecr.aws/supabase/postgres:17.6.1.167|true|none|[]|{}") {
  throw new Error("Synthetic container isolation preflight failed");
}
console.log("PASS exact container isolation (network none, no mounts or ports)");
const created = psql(`create database ${database} template template0;`, "postgres");
if (created.status !== 0) throw new Error(`Unable to create disposable database: ${created.stderr.trim()}`);
console.log(`PASS disposable synthetic database created: ${database}`);
process.on("exit", () => {
  const cleanup = psql(`drop database ${database};`, "postgres");
  if (cleanup.status === 0) console.log(`PASS disposable synthetic database removed: ${database}`);
  else {
    console.error(`BLOCKED disposable database cleanup: ${cleanup.stderr.trim()}`);
    process.exitCode = 1;
  }
});
mustPass("source-grounded fixture", fixture);
mustFail("legacy duplicate preflight", `begin;
  ${token("owner", "legacy-duplicate", "synthetic-legacy-a", site.owner)}
  ${token("owner", "legacy-duplicate", "synthetic-legacy-b", site.owner)}
  ${preflight}
  commit;`, "PUSH_BINDING_ACTIVE_INSTALLATION_CONFLICT");
assertCount("legacy duplicate preflight rollback", "device_id='legacy-duplicate'", 0);
mustFail("malformed legacy Site preflight", `begin;
  ${token("owner", "legacy-malformed", "synthetic-legacy-malformed", "not-a-site")}
  ${preflight}
  commit;`, "PUSH_BINDING_LEGACY_ROWS_REQUIRE_OWNER_REVIEW");
assertCount("malformed legacy preflight rollback", "device_id='legacy-malformed'", 0);
mustPass("guard-free candidate installed only in disposable database", candidate);
mustPass("candidate trigger and index catalog", `do $$ begin
  if to_regclass('public.push_tokens_observer_active_installation_uq') is null
    or not exists(select 1 from pg_trigger where tgname='observer_push_binding_guard' and not tgisinternal) then
    raise exception 'CANDIDATE_OBJECT_MISSING';
  end if;
end $$;`);

mustPass("owner insert", actor("owner", token("owner", "owner-device", "synthetic-owner-token", site.owner)));
mustPass("owner replay liveness", actor("owner", `update public.push_device_tokens set app_version='2', last_seen_at=now(), updated_at=now()
  where device_token='synthetic-owner-token';`));
mustFail("same installation different token", actor("owner", token("owner", "owner-device", "synthetic-second-token", site.owner)), "duplicate key value");
assertCount("one active owner installation", "profile_id='" + user.owner + "' and device_id='owner-device' and is_active", 1);
mustFail("wrong Site", actor("owner", token("owner", "wrong-site", "synthetic-wrong-site", site.other)), "OBSERVER_PUSH_SITE_DENIED");
mustFail("invalid Observer source", actor("owner", token("owner", "wrong-source", "synthetic-wrong-source", site.owner, "invalid_observer_source")), "OBSERVER_PUSH_BINDING_INVALID");
mustFail("global admin without Site", actor("admin", token("admin", "admin-device", "synthetic-admin-token", site.owner)), "OBSERVER_PUSH_SITE_DENIED");
mustFail("parent without Site", actor("parent", token("parent", "parent-device", "synthetic-parent-observer", site.owner)), "OBSERVER_PUSH_SITE_DENIED");
mustFail("cross-profile insert", actor("other", token("owner", "cross-profile", "synthetic-cross-profile", site.owner)), "OBSERVER_PUSH_INSERT_DENIED");
mustFail("global admin cannot transfer owner row", actor("admin", `update public.push_device_tokens
  set profile_id='${user.admin}' where device_token='synthetic-owner-token';`), "OBSERVER_PUSH_OWNER_DENIED");
mustPass("other user cannot update hidden owner row", actor("other", `update public.push_device_tokens
  set app_version='foreign' where device_token='synthetic-owner-token';`));
assertCount("cross-profile update left binding unchanged", "device_token='synthetic-owner-token' and app_version='2'", 1);
mustFail("binding mutation", actor("owner", `update public.push_device_tokens set metadata=jsonb_set(metadata,'{observer_site_id}','\"${site.other}\"')
  where device_token='synthetic-owner-token';`), "OBSERVER_PUSH_REPLAY_BINDING_DENIED");
mustPass("authenticated Observer delete has no RLS-visible target", actor("owner", `delete from public.push_device_tokens where device_token='synthetic-owner-token';`));
assertCount("authenticated delete did not remove Observer row", "device_token='synthetic-owner-token'", 1);
mustFail("service role Observer delete", context("service_role", null, null,
  "delete from public.push_device_tokens where device_token='synthetic-owner-token';"), "OBSERVER_PUSH_DELETE_DENIED");
mustFail("expired session", actor("owner", token("owner", "expired-device", "synthetic-expired-token", site.owner), "authenticated", session.expired), "OBSERVER_PUSH_SESSION_DENIED");
mustPass("membership insert", actor("other", token("other", "member-device", "synthetic-member-token", site.owner)));
mustPass("membership revoked in synthetic fixture", `update public.observer_site_memberships set active=false
  where observer_site_id='${site.owner}' and profile_id='${user.other}';`);
mustPass("owner read-back remains visible after Site loss", actor("other", `do $$ begin
  if (select count(*) from public.push_device_tokens where device_token='synthetic-member-token' and is_active) <> 1 then
    raise exception 'OWNER_READBACK_HIDDEN';
  end if;
end $$;`));
mustFail("registration after Site loss", actor("other", token("other", "lost-site-device", "synthetic-lost-site", site.owner)), "OBSERVER_PUSH_SITE_DENIED");
mustPass("own revoke after Site loss", actor("other", `update public.push_device_tokens set is_active=false,
    disabled_reason='unregistered_by_user', revoked_at=now(), updated_at=now()
    where device_token='synthetic-member-token';`));
mustFail("reactivation", actor("other", `update public.push_device_tokens set is_active=true where device_token='synthetic-member-token';`), "OBSERVER_PUSH_REACTIVATION_DENIED");
mustPass("service role provider-invalid disable", context("service_role", null, null, `update public.push_device_tokens
  set is_active=false, disabled_reason='provider_invalid_token', revoked_at=now(), updated_at=now()
  where device_token='synthetic-owner-token';`));
assertCount("provider-invalid disable did not transfer owner row",
  `device_token='synthetic-owner-token' and profile_id='${user.owner}' and not is_active and disabled_reason='provider_invalid_token'`, 1);
mustFail("service role cannot register", context("service_role", null, null,
  token("owner", "service-device", "synthetic-service-token", site.owner)), "OBSERVER_PUSH_SESSION_DENIED");
mustPass("shared Management generic insert", actor("parent", `insert into public.push_device_tokens
  (profile_id,role,platform,device_token,device_id,metadata)
  values ('${user.parent}','parent','ios','synthetic-management-token','management-device',
    '{"source":"gan_batuach"}'::jsonb);`));
mustPass("shared Management generic refresh", actor("parent", `update public.push_device_tokens
  set app_version='2' where device_token='synthetic-management-token';`));
mustPass("shared Management provider-invalid disable", context("service_role", null, null, `update public.push_device_tokens
  set is_active=false, disabled_reason='provider_invalid_token', revoked_at=now()
  where device_token='synthetic-management-token';`));
assertCount("Management token remained in Management domain",
  `device_token='synthetic-management-token' and profile_id='${user.parent}' and not is_active
   and metadata->>'source'='gan_batuach'`, 1);

const raceA = actor("owner", `${token("owner", "race-device", "synthetic-race-a", site.owner)} select pg_sleep(1);`);
const raceB = actor("owner", token("owner", "race-device", "synthetic-race-b", site.owner));
const first = asyncPsql(raceA);
await new Promise((resolve) => setTimeout(resolve, 150));
const second = asyncPsql(raceB);
const outcomes = await Promise.all([first, second]);
if (outcomes.filter((x) => x.status === 0).length !== 1
  || outcomes.filter((x) => x.status !== 0 && x.stderr.includes("duplicate key value")).length !== 1) {
  throw new Error(`Concurrent installation race did not yield one winner: ${JSON.stringify(outcomes)}`);
}
assertCount("concurrent installation race: exactly one committed owner",
  `profile_id='${user.owner}' and device_id='race-device' and is_active`, 1);

const tokenRaceA = actor("owner", `${token("owner", "same-token-a", "synthetic-global-race", site.owner)} select pg_sleep(1);`);
const tokenRaceB = actor("other", token("other", "same-token-b", "synthetic-global-race", site.other));
const tokenOutcomes = await Promise.all([asyncPsql(tokenRaceA), asyncPsql(tokenRaceB)]);
if (tokenOutcomes.filter((x) => x.status === 0).length !== 1
  || tokenOutcomes.filter((x) => x.status !== 0 && x.stderr.includes("duplicate key value")).length !== 1) {
  throw new Error(`Global token race did not yield one winner: ${JSON.stringify(tokenOutcomes)}`);
}
assertCount("global token uniqueness: exactly one committed token",
  "device_token='synthetic-global-race'", 1);
mustPass("revoke synthetic Auth session", `delete from auth.sessions where id='${session.owner}';`);
mustFail("revoked session rejects new token", actor("owner", token("owner", "revoked-device", "synthetic-revoked", site.owner)), "OBSERVER_PUSH_SESSION_DENIED");

const beforeRollback = count("true");
mustPass("transactional rollback preserves synthetic rows", `begin;
  drop trigger observer_push_binding_guard on public.push_device_tokens;
  drop function public.guard_observer_push_token_binding();
  drop index public.push_tokens_observer_active_installation_uq;
  do $$ begin if (select count(*) from public.push_device_tokens) <> ${beforeRollback} then
    raise exception 'ROLLBACK_ROW_LOSS'; end if; end $$;
  rollback;`);
assertCount("rollback row count unchanged", "true", beforeRollback);
mustPass("rollback restores candidate objects", `do $$ begin
  if to_regclass('public.push_tokens_observer_active_installation_uq') is null
    or not exists(select 1 from pg_trigger where tgname='observer_push_binding_guard' and not tgisinternal) then
    raise exception 'ROLLBACK_OBJECT_MISSING';
  end if;
end $$;`);
console.log("RESULT: isolated PostgreSQL fixture qualification complete; Data API/live Supabase not proven");
