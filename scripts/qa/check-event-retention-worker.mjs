import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const now = Date.now(), siteId = randomUUID();
const before = hours => new Date(now - hours * 3_600_000).toISOString();
const record = (name, patch = {}) => ({ id: name, observer_site_id: siteId, clip_status: "available", captured_at: before(49), retention_hours: 48,
  delete_after: before(1), storage_bucket: "digital-observer-event-media", storage_path: `${siteId}/${name}/clip.mp4`,
  snapshot_storage_path: `${siteId}/${name}/thumbnail.jpg`, metadata: { event_summary: "synthetic retained journal context" }, ...patch });
let rows = [], scans = [], removed = [], updates = [], scanFailure = false, adminCalls = 0;
const env = { NODE_ENV: "test", CRON_SECRET: "synthetic-cron-secret" };
const admin = {
  from(table) {
    assert.equal(table, "digital_observer_event_clips", "Never alter sources, sites, consent or journal signals");
    const query = { filters: [], patch: null, select: null, due: null, limit: null, ordering: [] };
    const result = () => {
      if (!query.patch) { scans.push(query); return { data: rows, error: scanFailure ? {} : null }; }
      updates.push(query);
      const match = rows.find(row => query.filters.every(([key, value]) => row[key] === value));
      return { data: match && match.id !== "changed" ? { id: match.id } : null, error: null };
    };
    const chain = {
      select: value => { query.select = value; return chain; },
      in: () => chain, or: value => { query.due = value; return chain; },
      order: (key, options) => { query.ordering.push([key, options]); return chain; },
      limit: value => { query.limit = value; return chain; },
      eq: (key, value) => { query.filters.push([key, value]); return chain; },
      is: (key, value) => { query.filters.push([key, value]); return chain; },
      update: value => { query.patch = value; return chain; },
      maybeSingle: async () => result(), then: callback => Promise.resolve(result()).then(callback)
    }; return chain;
  },
  storage: { from(bucket) { return { remove: async paths => {
    removed.push({ bucket, paths });
    if (paths.some(path => path.includes("/throws/"))) throw new Error("synthetic network failure");
    return { error: paths.some(path => path.includes("/storage-failed/")) ? {} : null };
  } }; } }
};
const modules = {
  "next/server": { NextResponse: Response },
  "@/lib/supabase/admin": { createAdminClient: () => { adminCalls++; return admin; }, isAdminClientConfigured: () => true }
};
const route = {};
runInNewContext(ts.transpileModule(readFileSync("app/api/cron/digital-observer-event-media-retention/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: route, process: { env }, Date: class extends Date { static now() { return now; } },
  require: name => { assert.ok(name in modules, name); return modules[name]; }
});
const request = authorization => new Request("https://synthetic.invalid/retention", { headers: authorization ? { authorization } : {} });
assert.equal((await route.GET(request())).status, 401); assert.equal(adminCalls, 0);
delete env.CRON_SECRET;
assert.equal((await route.GET(request())).status, 401, "Even development cannot delete with missing scheduler credentials");
env.CRON_SECRET = "synthetic-cron-secret";
rows = [
  record("safe"), record("foreign-bucket", { storage_bucket: "unrelated-private-bucket" }),
  record("foreign-site", { storage_path: `${randomUUID()}/clip.mp4` }),
  record("traversal", { storage_path: `${siteId}/../clip.mp4` }),
  record("hard-cap", { delete_after: before(-72) }),
  record("six-hours", { captured_at: before(7), retention_hours: 6, delete_after: before(-72) }),
  record("future", { captured_at: before(1), delete_after: before(-10) }),
  record("invalid", { captured_at: null, delete_after: null }),
  record("storage-failed"), record("throws"), record("changed"),
  record("no-files", { storage_bucket: null, storage_path: null, snapshot_storage_path: null })
];
const response = await route.GET(request("Bearer synthetic-cron-secret"));
const report = await response.json();
assert.equal(response.status, 200);
assert.deepEqual(report, { processed: 12, purged: 4, retryable_failures: 3, invalid_paths: 3, scan_limit_reached: false });
assert.equal(removed.every(item => item.bucket === "digital-observer-event-media" && item.paths.every(path => path.startsWith(`${siteId}/`) && !path.includes(".."))), true);
assert.equal(removed.some(item => item.paths.some(path => /foreign-|\/future\/|\/invalid\//.test(path))), false);
assert.match(scans[0].due, /retention_hours.eq.6/);
assert.ok(scans[0].due.includes(before(48)), "Query must include the hard cap even if delete_after is delayed");
assert.equal(scans[0].limit, 100);
assert.ok(updates.every(query => query.filters.some(([key, value]) => key === "observer_site_id" && value === siteId)));
assert.ok(updates.every(query => query.filters.some(([key]) => key === "storage_path")));
assert.ok(updates.every(query => query.patch.metadata.event_summary === "synthetic retained journal context"));
scanFailure = true; const priorRemovals = removed.length;
assert.equal((await route.GET(request("Bearer synthetic-cron-secret"))).status, 500);
assert.equal(removed.length, priorRemovals);
console.log("Retention worker authentication, tenant/path guard, hard expiry, retry isolation and metadata race checks PASS (synthetic; no deletion)");
