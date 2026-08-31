import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { cameraReportsLocalEventInsights } from "../../lib/domain/digital-observer/edge-ai-policy.ts";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("app/digital-observer/rules/page.tsx");
const gate = page.match(/const edgeInferenceActive = ([\s\S]*?);\n  const biometricSetupEnabled/);
assert.ok(gate, "Test must execute the readiness expression actually used by the page");
const now = Date.now();
const site = { monitoring_enabled: true, metadata: { observer_monitoring_consent: true } };
const contract = {
  version: 1, issued_at: new Date(now - 1000).toISOString(),
  gateway: { connected: true }, runtime: { available: true },
  hardware: { acceleration_available: true }, capability_test: { passed: true },
  models: { loaded: true, approved_inventory: [{ capability: "object_detection", loaded: true, self_test_passed: true }] },
  capabilities: { object_detection: true }
};
const camera = { metadata: { edge_capability_contract: contract, edge_policy: { monitoring_consent_verified: true, object_detection_enabled: true } } };
const gateScript = ts.transpileModule(`(${gate[1]})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const reports = (currentSite = site, cameras = [camera]) => runInNewContext(gateScript, {
  site: currentSite, activeCameras: cameras, cameraReportsLocalEventInsights,
  Date: { now: () => now, parse: Date.parse }
});
assert.equal(reports(), true);
assert.equal(reports(null), false);
assert.equal(reports({ ...site, monitoring_enabled: false }), false);
assert.equal(reports({ ...site, metadata: {} }), false);
assert.equal(reports(site, []), false);
for (const patch of [
  { issued_at: undefined }, { issued_at: "invalid" },
  { issued_at: new Date(now + 1).toISOString() },
  { issued_at: new Date(now - 20 * 60 * 1000 - 1).toISOString() },
  { gateway: { connected: false } }, { runtime: { available: false } },
  { hardware: { acceleration_available: false } }, { capability_test: { passed: false } },
  { models: { loaded: false } }, { models: { loaded: true, approved_inventory: [] } },
  { models: { loaded: true, approved_inventory: [{ capability: "object_detection", loaded: true, self_test_passed: false }] } }
]) {
  assert.equal(reports(site, [{ metadata: { ...camera.metadata, edge_capability_contract: { ...contract, ...patch } } }]), false);
}
assert.equal(reports(site, [{ metadata: { ...camera.metadata, edge_policy: { monitoring_consent_verified: false } } }]), false);
for (const label of ["למידה פעילה", "AI Edge מאומת פעיל", "כרגע נמדדות", "נאספים ממנו מדדי פעילות"]) assert.ok(!page.includes(label), label);
assert.match(page, /הנחיה שמורה/);
assert.match(page, /אין דיווח שמור למקור הזה; מצב הניתוח טרם אומת/);

const nativeRequire = createRequire(import.meta.url);
const exports = {};
runInNewContext(ts.transpileModule(read("components/digital-observer/observer-intelligence-experience.tsx"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText, {
  exports,
  require: (name) => {
    if (name === "next/navigation") return { useRouter: () => ({ refresh() {} }) };
    if (name === "next/link") return { default: (props) => React.createElement("a", props) };
    if (name === "@/lib/domain/digital-observer/client-session") return { readObserverAccessToken: () => { throw new Error("No session access in rendering test"); } };
    assert.ok(["react", "react/jsx-runtime", "lucide-react"].includes(name), name);
    return nativeRequire(name);
  }
});
for (const active of [true, false]) {
  const html = renderToStaticMarkup(React.createElement(exports.ObserverConversationPanel, {
    siteId: "synthetic", ruleSummary: { title: "Stored instruction", active }
  }));
  assert.match(html, /הנחיה שמורה/);
  assert.doesNotMatch(html, /do-badge good/);
}
console.log("PASS: stored instructions stay neutral; current consent, fresh capability, runtime, model and hardware gates fail closed");
