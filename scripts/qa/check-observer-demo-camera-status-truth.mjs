import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual-component closed VM tests: no database, provider, device, or network.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const requireFromRepo = createRequire(resolve(root, "package.json"));
const ts = requireFromRepo("typescript");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const icons = Object.fromEntries(["Camera", "CameraOff", "CircleDot", "ShieldCheck", "Bell", "Clock3", "MapPin", "Plus", "Radar", "Settings2"].map((name) => [name, name]));

function residentSource(relative) {
  const file = resolve(root, relative);
  assert.ok(statSync(file).isFile());
  if (process.platform === "darwin") {
    const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
    assert.match(raw, /^\d+$/);
    assert.equal(BigInt(raw) & 0x40000000n, 0n, `SF_DATALESS source refused: ${relative}`);
  }
  return readFileSync(file, "utf8");
}

function load(relative, modules) {
  const output = ts.transpileModule(residentSource(relative), {
    fileName: relative,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
  });
  const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
  const exports = {};
  new vm.Script(output.outputText, { filename: relative }).runInNewContext({
    exports,
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `unapproved module: ${name}`);
      return modules[name];
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports;
}

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

const media = load("components/digital-observer/observer-camera-media.tsx", {
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "lucide-react": icons
}).ObserverCameraMedia;

for (const status of ["connected", "healthy", "online", "active", "offline", "readiness"]) {
  test(`demo ${status} remains visibly synthetic`, () => {
    const tree = media({ name: "Synthetic QA", mode: "home", status, sourceMode: "demo" });
    assert.match(tree.props.className, /is-demo/);
    const badge = nodes(tree, (item) => item.props?.className?.includes?.("do-camera-status"))[0];
    assert.ok(badge);
    assert.doesNotMatch(badge.props.className, /active/);
    assert.equal(text(badge), "הדמיה");
    assert.match(text(tree), /תרחיש הדגמה בלבד · לא שידור חי/);
    assert.doesNotMatch(text(tree), /מקור מחובר/);
  });
}

for (const [status, label] of [["connected", "מקור מחובר"], ["healthy", "מקור מחובר"], ["online", "מקור מחובר"], ["active", "מקור מחובר"], ["offline", "Offline"], ["readiness", "מצב בדיקה"]]) {
  test(`non-demo ${status} keeps its status`, () => {
    const tree = media({ name: "Real QA label", mode: "business", status, sourceMode: "live" });
    const badge = nodes(tree, (item) => item.props?.className?.includes?.("do-camera-status"))[0];
    assert.equal(text(badge), label);
    assert.doesNotMatch(text(tree), /תרחיש הדגמה/);
  });
}

test("site detail passes source mode and excludes connected demo from real count", async () => {
  const site = { id: "site-a", name: "Site A", site_type: "home", monitoring_enabled: false };
  const cameras = [
    { id: "demo", observer_site_id: site.id, display_name: "Demo", source_mode: "demo", status: "connected" },
    { id: "real", observer_site_id: site.id, display_name: "Real", source_mode: "live", status: "connected" }
  ];
  const page = load("app/digital-observer/sites/[id]/page.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { __esModule: true, default: "Link" },
    "next/navigation": { notFound: () => { throw Error("unexpected notFound"); } },
    "lucide-react": icons,
    "@/components/digital-observer/observer-app-shell": { ObserverAppShell: "ObserverAppShell" },
    "@/components/digital-observer/observer-camera-media": { ObserverCameraMedia: media },
    "@/lib/domain/digital-observer/access": { requireDigitalObserverUser: async () => ({ profile: { id: "owner" } }) },
    "@/lib/domain/display-label": { cleanSyntheticLabel: (value) => value },
    "@/lib/domain/digital-observer/runtime": {
      formatObserverDate: () => "date", loadObserverRuntime: async () => ({ sites: [site], cameras, signals: [], schedules: [], subscriptions: [], packages: [] }),
      observerEventLabel: String, observerModeForSite: () => "home", observerStatusLabel: String
    }
  }).default;
  const tree = await page({ params: Promise.resolve({ id: site.id }) });
  const mediaNodes = nodes(tree, (item) => item.type === media);
  assert.equal(mediaNodes.length, 2);
  assert.equal(mediaNodes[0].props.sourceMode, "demo");
  assert.equal(mediaNodes[1].props.sourceMode, "live");
  assert.equal(text(media(mediaNodes[0].props)).includes("הדמיה"), true);
  const connectedCount = nodes(tree, (item) => item.type === "small" && text(item) === "1 מחוברות בפועל");
  assert.equal(connectedCount.length, 1);
});
