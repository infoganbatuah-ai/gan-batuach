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

test("harness targets cached Kingston image with no network, explicit role checks and own-container cleanup", () => {
  assert.match(source, /const dockerHost = "unix:\/\/\/Volumes\/DIGITAL_OBSERVER\/Development\/gan-batuach\/colima\/gbi\/docker\.sock"/);
  assert.match(source, /const image = "public\.ecr\.aws\/supabase\/postgres:17\.6\.1\.167"/);
  assert.doesNotMatch(source, /--context|\.colima\/gbi\/docker\.sock/);
  assert.match(source, /docker\(\["image", "inspect", image/);
  assert.match(source, /"--network", "none"/);
  assert.match(source, /"--tmpfs", "\/var\/lib\/postgresql\/data/);
  assert.match(source, /if not exists \(select 1 from pg_roles where rolname = 'anon'\) then create role anon login/);
  assert.match(source, /POSTGRES_USER=supabase_admin/);
  assert.match(source, /psql\(container, "select 1;"\)/);
  assert.match(source, /has_function_privilege\('anon'/);
  assert.match(source, /has_table_privilege\('authenticated'/);
  assert.match(source, /set role \$\{role\}; select \$\{functionCall\}/);
  assert.match(source, /permission denied for function/);
  assert.match(source, /consume\("verify", "c"\.repeat\(64\)\)/);
  assert.match(source, /const expiredState = "d"\.repeat\(64\)/);
  assert.match(source, /select pg_sleep\(6\)/);
  assert.match(source, /Promise\.all\(\[psqlAsync\(container, consume\(\)\), psqlAsync\(container, consume\(\)\)\]\)/);
  assert.match(source, /if \(startAttempted\)/);
  assert.match(source, /docker\(\["rm", "-f", container\]\)/);
  assert.doesNotMatch(source, /docker\(\["pull"/);
});
