import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const script = new URL("./qualify-observer-qa-callback-postgres.mjs", import.meta.url);
const source = readFileSync(script, "utf8");

test("qualification defaults off and self-check never launches Docker", () => {
  const defaultOutput = execFileSync(process.execPath, [script.pathname], {
    encoding: "utf8", env: { ...process.env, PUSH44_LOCAL_PG_QUALIFY: "NO" }
  });
  assert.match(defaultOutput, /NOT RUN/);
  const selfCheck = execFileSync(process.execPath, [script.pathname, "--self-check"], {
    encoding: "utf8", env: { ...process.env, PUSH44_LOCAL_PG_QUALIFY: "NO" }
  });
  assert.match(selfCheck, /PASS: offline harness contract self-check; database NOT RUN/);
});

test("harness targets cached gbi image with no network, explicit role checks and own-container cleanup", () => {
  assert.match(source, /const context = "colima-gbi"/);
  assert.match(source, /const image = "postgres:17\.11-alpine"/);
  assert.match(source, /docker\(\["image", "inspect", image/);
  assert.match(source, /"--network", "none"/);
  assert.match(source, /"--tmpfs", "\/var\/lib\/postgresql\/data/);
  assert.match(source, /create role anon login; create role authenticated login; create role service_role login bypassrls/);
  assert.match(source, /has_function_privilege\('anon'/);
  assert.match(source, /has_table_privilege\('authenticated'/);
  assert.match(source, /set role \$\{role\}; select \$\{functionCall\}/);
  assert.match(source, /permission denied for function/);
  assert.match(source, /consume\("verify", "c"\.repeat\(64\)\)/);
  assert.match(source, /const expiredState = "d"\.repeat\(64\)/);
  assert.match(source, /select pg_sleep\(2\)/);
  assert.match(source, /Promise\.all\(\[psqlAsync\(container, consume\(\)\), psqlAsync\(container, consume\(\)\)\]\)/);
  assert.match(source, /if \(startAttempted\)/);
  assert.match(source, /docker\(\["rm", "-f", container\]\)/);
  assert.doesNotMatch(source, /docker\(\["pull"/);
});
