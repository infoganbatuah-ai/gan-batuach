import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const actor = "00000000-0000-4000-8000-000000000001";
const pack = "00000000-0000-4000-8000-000000000002";
const source = readFileSync(new URL("./atomic.sql", import.meta.url), "utf8");
const tables = ["observer_sites", "observer_site_memberships", "observer_site_onboarding_drafts",
  "observer_monitoring_schedules", "observer_site_subscriptions", "digital_observer_entitlement_grants",
  "digital_observer_financial_audit"];
const patch = { name: "QA Home", site_type: "home", address: "Synthetic address", city: "QA", street: "Fixture",
  building_number: "1", floor_kind: "ground", floor_number: 0, country_code: "IL",
  address_verification_status: "unverified", business_handles_children: false, vision_privacy_mode: "standard_consent",
  camera_limit: 1, monitoring_hours: { mode: "event_only" }, ai_features: {}, metadata: { site_template: "home", branch_count: 1 } };

function statement(file, prefix) {
  const sql = readFileSync(new URL("../../supabase/migrations/" + file + ".sql", import.meta.url), "utf8");
  const start = sql.indexOf(prefix);
  assert.notEqual(start, -1, prefix);
  return sql.slice(start, sql.indexOf(";", start) + 1);
}

async function fixture(t) {
  const db = new PGlite({ extensions: { pgcrypto } });
  t.after(() => db.close());
  // Only the referenced schema slice is loaded. Session identity is a fixture.
  await db.exec(`create schema extensions; create extension pgcrypto with schema extensions;
    create schema auth; create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key, active boolean);
    create table gardens(id uuid primary key);
    create table digital_observer_plan_versions(id uuid primary key);
    create table digital_observer_payment_events(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select '${actor}'::uuid$$;
    create function digital_observer_current_session_active() returns boolean language sql stable as $$select true$$;`);
  const packages = "20260603005000_observer_monitoring_packages";
  const billing = "20261019010000_digital_observer_push40_commercial_billing";
  const journey = "20260603006000_observer_site_owner_journey";
  const standalone = "20260612017700_digital_observer_standalone_billing_packages_site_owner_journey";
  const create = (file, name) => statement(file, "create table if not exists public." + name + " (");
  const alter = (file, table, column) => statement(file, "alter table public." + table + "\n  add column if not exists " + column + " ");
  await db.exec([
    statement(packages, "create type public.observer_monitoring_mode"),
    statement(packages, "create type public.observer_site_subscription_status"),
    create("20260603003000_digital_observer_multisite_foundation", tables[0]),
    alter("20260821000300_digital_observer_location_learning_runtime", tables[0], "city"),
    create(packages, "observer_monitoring_packages"), alter(billing, "observer_monitoring_packages", "catalog_version"),
    create("20260820020000_digital_observer_auth_trial_separation", "digital_observer_accounts"),
    create(journey, tables[1]), create(journey, tables[2]), create(packages, tables[4]),
    alter(standalone, tables[4], "subscription_status"), alter(billing, tables[4], "commercial_state"),
    create(standalone, tables[3]), create(billing, tables[5]), create(billing, tables[6])
  ].join("\n"));
  await db.query("insert into profiles values ($1,true)", [actor]);
  await db.query("insert into digital_observer_accounts(profile_id) values ($1)", [actor]);
  await db.query("insert into observer_monitoring_packages(id,name,package_type,included_entitlements) values ($1,'QA','home',$2)",
    [pack, { sites: 1, cameras: 1 }]);
  await assert.rejects(db.exec(source), /REVIEW ONLY/);
  await db.exec(source.split("-- BEGIN CANDIDATE\n")[1]);
  return db;
}
async function save(db, site = null, packageId = pack, name = patch.name) {
  const { rows } = await db.query("select save_observer_onboarding_atomic($1,$2,$3,'event_only','[]') as saved",
    [site, packageId, {...patch, name}]);
  return rows[0].saved;
}
async function snapshot(db) {
  return Promise.all(tables.map(async table => (await db.query(`select * from ${table} order by id`)).rows));
}

test("create validates package first; PostgreSQL rolls back every stage including trial and final audit", async t => {
  const db = await fixture(t);
  const empty = await snapshot(db);
  await assert.rejects(save(db, null, null), /TRIAL_PACKAGE_UNAVAILABLE/);
  await db.query("update observer_monitoring_packages set active=false where id=$1", [pack]);
  await assert.rejects(save(db), /TRIAL_PACKAGE_UNAVAILABLE/);
  assert.deepEqual(await snapshot(db), empty);
  await db.query("update observer_monitoring_packages set active=true where id=$1", [pack]);
  // NOT VALID permits seed rows; PostgreSQL still enforces the constraint on every new row.
  for (const table of tables.slice(1)) {
    await db.exec(`alter table ${table} add constraint qa_reject_write check (false) not valid`);
    await assert.rejects(save(db), /qa_reject_write/);
    assert.deepEqual(await snapshot(db), empty, table);
    await db.exec(`alter table ${table} drop constraint qa_reject_write`);
  }
  const saved = await save(db);
  assert.equal(saved.site.name, patch.name);
  assert.equal(saved.trial.subscription_status, "trial");
  const first = await snapshot(db);
  assert.deepEqual(first.map(rows => rows.length), [1,1,1,1,1,10,1]);
  await assert.rejects(save(db), /SITE_ENTITLEMENT_DENIED/);
  assert.deepEqual(await snapshot(db), first);
});

test("existing-site failures restore prior values; an owner edit preserves the original trial and grants", async t => {
  const db = await fixture(t);
  const {site, trial} = await save(db);
  const before = await snapshot(db);
  await assert.rejects(save(db, site.id, null, "Bad edit"), /TRIAL_PACKAGE_UNAVAILABLE/);
  await db.exec("alter table observer_monitoring_schedules add constraint qa_reject_write check (false) not valid");
  await assert.rejects(save(db, site.id, pack, "Bad edit"), /qa_reject_write/);
  assert.deepEqual(await snapshot(db), before);
  await db.exec("alter table observer_monitoring_schedules drop constraint qa_reject_write");
  const edited = await save(db, site.id, pack, "Edited");
  assert.equal(edited.site.name, "Edited");
  assert.equal(edited.trial.id, trial.id);
  assert.equal(edited.trial.trial_end, trial.trial_end);
  assert.equal((await snapshot(db))[2].length, 1);
  assert.deepEqual((await snapshot(db)).slice(4), before.slice(4));
});

test("ineligible trial update, foreign ownership, expired session and missing EXECUTE all fail closed", async t => {
  const db = await fixture(t);
  const {site} = await save(db);
  await db.query("update observer_site_subscriptions set commercial_state='cancelled' where observer_site_id=$1", [site.id]);
  const cancelled = await snapshot(db);
  await assert.rejects(save(db, site.id, pack, "Denied edit"), /TRIAL_NOT_ELIGIBLE/);
  assert.deepEqual(await snapshot(db), cancelled);
  await db.query("update observer_sites set owner_profile_id=null where id=$1", [site.id]);
  const unowned = await snapshot(db);
  await assert.rejects(save(db, site.id), {code: "42501"});
  assert.deepEqual(await snapshot(db), unowned);
  await db.exec("create or replace function digital_observer_current_session_active() returns boolean language sql stable as $$select false$$");
  await assert.rejects(save(db), {code: "42501"});
  assert.deepEqual(await snapshot(db), unowned);
  for (const role of ["anon","authenticated","service_role"]) {
    const {rows} = await db.query("select has_function_privilege($1, 'public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)', 'EXECUTE') as allowed", [role]);
    assert.equal(rows[0].allowed, false);
  }
});
