import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("scripts/qa/reconcile-push38-homeqa-monitoring-consent.mjs", "utf8");
assert.match(source, /\.from\("observer_sites"\)/);
assert.match(source, /monitoring_enabled !== true/);
assert.match(source, /observer_monitoring_consent !== true/);
assert.match(source, /com\.supabase\.cli\.project/);
assert.match(source, /push38t-loopback/);
assert.match(source, /PRODUCT_OWNER_CONSENT_READ_ONLY/);
assert.match(source, /product_writes: 0/);
assert.doesNotMatch(source, /\.update\([^]*product\./);
assert.doesNotMatch(source, /camera_sources.*update/);
console.log("PUSH38_HOME_QA_MONITORING_CONSENT_QA_PASS");
