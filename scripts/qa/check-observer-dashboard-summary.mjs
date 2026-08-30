import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("lib/domain/digital-observer/dashboard-summary.ts", "utf8");
const dashboard = readFileSync("app/digital-observer/dashboard/page.tsx", "utf8");
const cameras = readFileSync("app/digital-observer/cameras/page.tsx", "utf8");

for (const required of ["parking", "entry_exit", "warehouse", "pool", "anomalies", "insights", "24 * 60 * 60 * 1000"]) {
  assert.ok(source.includes(required), `missing evidence-backed summary behavior: ${required}`);
}
assert.ok(dashboard.includes("buildObserverDashboardSummaries"), "dashboard must use dynamic camera-context summaries");
assert.ok(dashboard.includes("activeSiteCameras"), "dashboard must separate live and disconnected cameras");
assert.ok(cameras.includes('params?.status === "offline"'), "camera browser must expose disconnected sources explicitly");
assert.ok(cameras.includes("defaultVisibleCameras"), "camera browser must hide disconnected sources by default");
console.log("Observer dashboard summary and offline isolation QA PASS");
