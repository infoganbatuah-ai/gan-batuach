import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";

const source = readFileSync("app/api/cron/digital-observer-event-media-retention/route.ts", "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const epoch = Date.parse("2026-09-03T10:00:00.000Z");
const siteId = randomUUID();
const makeClip = (index, overrides = {}) => ({
  id: String(index).padStart(8, "0"), observer_site_id: siteId,
  clip_status: "available", downloadable: true,
  storage_bucket: "digital-observer-event-media",
  storage_path: `${siteId}/${index}/clip.mp4`,
  snapshot_storage_path: `${siteId}/${index}/thumbnail.jpg`,
  delete_after: new Date(epoch - 1000).toISOString(),
  metadata: { event_summary: "Synthetic event description", review_status: "confirmed" },
  ...overrides
});

function fixture(input, options = {}) {
  const rows = structuredClone(input), removals = [], scans = [];
  const failures = new Map(options.failures ?? []);
  let clock = epoch, adminCalls = 0;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
  class Query {
    filters = [];
    select() { return this; }
    in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
    not(key, operator, value) { assert.equal(operator, "is"); assert.equal(value, null); this.filters.push(row => row[key] != null); return this; }
    lte(key, value) { this.filters.push(row => row[key] <= value); return this; }
    gt(key, value) { this.cursor = value; this.filters.push(row => row[key] > value); return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); return this; }
    order(key, options) { assert.equal(key, "id"); assert.equal(options.ascending, true); this.sorted = true; return this; }
    limit(size) { this.size = size; return this; }
    update(patch) { this.patch = patch; return this; }
    then(resolve, reject) { return this.run().then(resolve, reject); }
    async run() {
      let matched = rows.filter(row => this.filters.every(predicate => predicate(row)));
      if (this.sorted) matched.sort((a, b) => a.id.localeCompare(b.id));
      if (this.size) matched = matched.slice(0, this.size);
      if (this.patch) {
        if (matched.some(row => failures.get(row.id) === "update_throw")) throw new Error("fixture update failure");
        if (matched.some(row => failures.get(row.id) === "update_error")) return { data: null, error: {} };
        matched.forEach(row => Object.assign(row, this.patch));
      } else {
        scans.push({ cursor: this.cursor, count: matched.length });
        if (options.scanFailureAt === scans.length) throw new Error("fixture scan failure");
      }
      return { data: matched, error: null };
    }
  }
  const admin = {
    from(table) { assert.equal(table, "digital_observer_event_clips"); return new Query(); },
    storage: { from(bucket) {
      assert.equal(bucket, "digital-observer-event-media");
      return { async remove(paths) {
        removals.push([...paths]);
        clock += options.removeDuration ?? 0;
        const row = rows.find(row => paths.includes(row.storage_path));
        if (failures.get(row?.id) === "remove_throw") throw new Error("fixture storage failure");
        return { error: failures.get(row?.id) === "remove_error" ? {} : null };
      } };
    } }
  };
  const env = { NODE_ENV: "production", CRON_SECRET: randomUUID() };
  const module = { exports: {} };
  const require = name => {
    if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    if (name === "@/lib/supabase/admin") return {
      createAdminClient: () => { adminCalls += 1; return admin; },
      isAdminClientConfigured: () => options.configured !== false
    };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function("require", "module", "exports", "process", "Date", code)(require, module, module.exports, { env }, Clock);
  const invoke = (authorized = true) => module.exports.GET(new Request("https://test.invalid/retention", {
    headers: authorized ? { authorization: `Bearer ${env.CRON_SECRET}` } : {}
  }));
  return { rows, removals, scans, failures, env, invoke, adminCalls: () => adminCalls };
}

const auth = fixture([makeClip(1)]);
assert.equal((await auth.invoke(false)).status, 401);
delete auth.env.CRON_SECRET;
assert.equal((await auth.invoke()).status, 401, "Production never runs without a configured cron secret");
assert.equal(auth.adminCalls(), 0);
assert.equal((await fixture([], { configured: false }).invoke()).status, 503);

const backlog = fixture([
  ...Array.from({ length: 205 }, (_, index) => makeClip(index)),
  makeClip(205, { delete_after: new Date(epoch + 60000).toISOString() }),
  makeClip(206, { delete_after: null }),
  makeClip(207, { clip_status: "expired" })
]);
const drained = await (await backlog.invoke()).json();
assert.deepEqual(drained, { processed: 205, purged: 205, retryable_failures: 0, has_more: false });
assert.equal(backlog.removals.length, 205, "Keyset pagination does not skip rows after updates");
assert.equal(new Set(backlog.removals.flat()).size, 410);
assert.equal(backlog.rows[205].clip_status, "available", "Future media remains untouched");
assert.equal(backlog.rows[206].clip_status, "available", "Unscheduled media remains untouched");
assert.equal(backlog.rows[0].metadata.event_summary, "Synthetic event description");
assert.equal(backlog.rows[0].metadata.review_status, "confirmed");
assert.equal(backlog.rows[0].storage_path, null);
assert.equal(backlog.rows[0].downloadable, false);

const isolated = fixture(Array.from({ length: 205 }, (_, index) => makeClip(index)), {
  failures: [["00000000", "remove_error"], ["00000001", "remove_throw"], ["00000002", "update_throw"], ["00000003", "update_error"]]
});
const partial = await (await isolated.invoke()).json();
assert.deepEqual(partial, { processed: 205, purged: 201, retryable_failures: 4, has_more: true });
assert.equal(isolated.rows[204].clip_status, "expired", "Early failures never stop later pages");
for (const row of isolated.rows.slice(0, 4)) assert.equal(row.clip_status, "available");
isolated.failures.clear();
assert.deepEqual(await (await isolated.invoke()).json(), { processed: 4, purged: 4, retryable_failures: 0, has_more: false });

const scope = fixture([
  makeClip(0, { storage_path: `${randomUUID()}/clip.mp4` }),
  makeClip(1, { storage_bucket: "unrelated-private-bucket" }),
  makeClip(2, { observer_site_id: null }), makeClip(3)
]);
assert.deepEqual(await (await scope.invoke()).json(), { processed: 4, purged: 1, retryable_failures: 3, has_more: true });
assert.equal(scope.removals.length, 1, "Malformed storage ownership is not deleted or falsely marked expired");

const bounded = fixture(Array.from({ length: 1002 }, (_, index) => makeClip(index)));
assert.deepEqual(await (await bounded.invoke()).json(), { processed: 1000, purged: 1000, retryable_failures: 0, has_more: true });
assert.deepEqual(await (await bounded.invoke()).json(), { processed: 2, purged: 2, retryable_failures: 0, has_more: false });
const timed = fixture([makeClip(0), makeClip(1), makeClip(2)], { removeDuration: 11000 });
assert.deepEqual(await (await timed.invoke()).json(), { processed: 2, purged: 2, retryable_failures: 0, has_more: true });

const initialScanFailure = fixture([makeClip(0)], { scanFailureAt: 1 });
assert.equal((await initialScanFailure.invoke()).status, 500);
assert.equal(initialScanFailure.removals.length, 0);
const laterScanFailure = fixture(Array.from({ length: 205 }, (_, index) => makeClip(index)), { scanFailureAt: 2 });
const interrupted = await laterScanFailure.invoke();
assert.equal(interrupted.status, 500);
assert.equal((await interrupted.json()).purged, 100, "A scan failure reports already completed work without claiming full cleanup");
console.log("Retention worker QA passed: auth, 205-row backlog, keyset paging, failure isolation/retry, storage scope, work limits and truthful partial results. Synthetic storage only.");
