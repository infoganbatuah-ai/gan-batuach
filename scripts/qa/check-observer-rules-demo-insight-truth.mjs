import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Execute the actual page module in an isolated VM with synthetic runtime data.
// No database, browser, provider, device, media, or network is contacted.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/digital-observer/rules/page.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  assert.equal(BigInt(raw) & 0x40000000n, 0n, "SF_DATALESS source refused");
}
const ts = createRequire(resolve(root, "package.json"))("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
});
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
const script = new vm.Script(output.outputText, { filename: file });
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const icons = Object.fromEntries(["Activity", "Bell", "BrainCircuit", "Camera", "CheckCircle2", "Clock3", "MapPin", "PhoneCall", "Radar", "ShieldCheck", "Sparkles", "TriangleAlert"].map((name) => [name, name]));
function nodes(value, predicate) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, predicate));
  if (!value || typeof value !== "object") return [];
  return [...(predicate(value) ? [value] : []), ...nodes(value.props?.children, predicate)];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object") return text(value.props?.children);
  return value === null || value === undefined || typeof value === "boolean" ? "" : String(value);
}
async function render({ cameras, signals = [], withLearning = true }) {
  const site = { id: "site-a", site_type: "home", learning_target_days: 30 };
  const runtime = {
    sites: [site], cameras, signals, watchRequests: [],
    baselines: withLearning ? [{ id: "baseline", observer_site_id: site.id, baseline_type: "normal_camera_activity", baseline_value: {} }] : [],
    learningProfiles: withLearning ? [{ observer_site_id: site.id, learning_status: "active" }] : [],
    locationLearningMigrationApplied: true
  };
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/image": { __esModule: true, default: "Image" },
    "next/link": { __esModule: true, default: "Link" },
    "lucide-react": icons,
    "@/components/digital-observer/observer-intelligence-experience": { ObserverConversationPanel: "ObserverConversationPanel" },
    "@/components/digital-observer/observer-app-shell": { ObserverAppShell: "ObserverAppShell" },
    "@/components/digital-observer/observer-camera-media": { ObserverCameraMedia: "ObserverCameraMedia" },
    "@/components/digital-observer/natural-language-watch-rule-builder": { NaturalLanguageWatchRuleBuilder: "NaturalLanguageWatchRuleBuilder" },
    "@/lib/domain/digital-observer/access": { requireDigitalObserverUser: async () => ({ profile: { id: "owner" } }) },
    "@/lib/domain/digital-observer/edge-ai-policy": {
      cameraReportsLocalEventInsights: () => false,
      digitalObserverEdgeAiPolicy: { activeCapabilities: [], unavailableCapabilities: [], retention: { frames: "", clips: "", insights: "" }, consent: { monitoring: "", biometrics: "" } }
    },
    "@/lib/domain/digital-observer/service-readiness": { getDigitalObserverServiceReadiness: () => ({ ai: { configured: false }, address: { configured: false } }) },
    "@/lib/domain/digital-observer/learning-coverage": {
      learningCameraCoverage: () => ({ sampledCameraCount: 0, expectedCameraCount: 0, perCamera: [] }),
      learningMetricMeaning: () => ({ measurable: false, label: "", explanation: "" })
    },
    "@/lib/domain/digital-observer/runtime": {
      formatObserverDate: () => "DATE", loadObserverRuntime: async () => runtime, observerEventLabel: () => "EVENT",
      observerModeForSite: () => "home", observerSignalMatchesCamera: (signal, id) => signal.camera_id === id,
      observerStatusLabel: String, selectObserverSite: () => site
    }
  };
  const exports = {};
  script.runInNewContext({ exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`);
    return modules[name];
  } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports.default();
}
function insightArticles(tree) {
  const section = nodes(tree, (node) => node.type === "section" && node.props.className === "do-observer-camera-insights")[0];
  assert.ok(section);
  return { section, articles: nodes(section, (node) => node.type === "article") };
}
for (const status of ["connected", "healthy", "online", "active"]) {
  test(`demo ${status} cannot claim active real-camera learning`, async () => {
    const tree = await render({ cameras: [{ id: "demo", observer_site_id: "site-a", source_mode: "demo", status, display_name: "Demo" }] });
    const { section, articles } = insightArticles(tree);
    assert.equal(articles.length, 1);
    assert.match(text(articles[0]), /הדמיה/);
    assert.match(text(articles[0]), /לא נאספים ממנו מדדי פעילות ממצלמה אמיתית/);
    assert.doesNotMatch(text(articles[0]), /המקור מחובר ונאספים/);
    assert.doesNotMatch(text(section), /למידה פעילה/);
    assert.match(text(tree), /תרחישי הדמיה בלבד/);
    assert.doesNotMatch(text(tree), /AI מקומי \/ Gateway פעיל/);
  });
}
test("mixed demo and real source preserves real activity without promoting demo", async () => {
  const tree = await render({ cameras: [
    { id: "demo", observer_site_id: "site-a", source_mode: "demo", status: "connected", display_name: "Demo" },
    { id: "real", observer_site_id: "site-a", source_mode: "live", status: "connected", display_name: "Real" }
  ] });
  const { articles } = insightArticles(tree);
  assert.equal(articles.length, 2);
  assert.match(text(articles[0]), /הדמיה/);
  assert.doesNotMatch(text(articles[0]), /המקור מחובר ונאספים/);
  assert.match(text(articles[1]), /המקור מחובר ונאספים/);
  assert.match(text(articles[1]), /פעילה/);
});
test("real stored demo event remains visible without claiming live capture", async () => {
  const tree = await render({
    cameras: [{ id: "demo", observer_site_id: "site-a", source_mode: "demo", status: "connected", display_name: "Demo" }],
    signals: [{ id: "event", observer_site_id: "site-a", camera_id: "demo", signal_type: "motion", created_at: "2026-01-01T00:00:00Z" }]
  });
  const { articles } = insightArticles(tree);
  assert.match(text(articles[0]), /העדכון האחרון: EVENT \(DATE\)/);
  assert.match(text(articles[0]), /הדמיה/);
  assert.doesNotMatch(text(articles[0]), /המקור מחובר ונאספים/);
});
