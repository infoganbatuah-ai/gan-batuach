import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// The real page is evaluated with closed, synthetic modules. No camera or API runs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/digital-observer/cameras/page.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  assert.equal(BigInt(raw) & 0x40000000n, 0n, "SF_DATALESS source refused");
}
const ts = createRequire(resolve(root, "package.json"))("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
const script = new vm.Script(output.outputText, { filename: file });
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const icons = Object.fromEntries(["ArrowRight", "Bell", "Camera", "CameraOff", "CircleDot", "Grid2X2", "Image", "List", "LockKeyhole", "Maximize2", "Mic", "Plus", "Search", "ServerCog", "Settings2", "Share2", "ShieldCheck", "Video", "Volume2", "Wifi"].map((name) => [name, name]));
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
async function render(camera) {
  const site = { id: "site-a", site_type: "home" };
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { __esModule: true, default: "Link" },
    "lucide-react": icons,
    "@/components/digital-observer/observer-action-forms": { ObserverCameraInlineRename: "ObserverCameraInlineRename", ObserverCameraNameForm: "ObserverCameraNameForm", ObserverQuickAction: "ObserverQuickAction" },
    "@/components/digital-observer/observer-app-shell": { ObserverAppShell: "ObserverAppShell" },
    "@/components/digital-observer/observer-camera-media": { ObserverCameraMedia: "ObserverCameraMedia" },
    "@/components/digital-observer/observer-camera-presence": { ObserverCameraPresence: "ObserverCameraPresence" },
    "@/components/digital-observer/observer-live-player": { ObserverLivePlayer: "ObserverLivePlayer" },
    "@/components/digital-observer/observer-camera-controls": { ObserverCameraControls: "ObserverCameraControls" },
    "@/components/digital-observer/guard-diagnostics-panel": { GuardDiagnosticsPanel: "GuardDiagnosticsPanel" },
    "@/components/digital-observer/observer-intelligence-experience": { ObserverConversationPanel: "ObserverConversationPanel" },
    "@/lib/domain/digital-observer/access": { requireDigitalObserverUser: async () => ({ profile: { id: "owner" } }) },
    "@/lib/domain/digital-observer/camera-live-status": {
      digitalObserverCameraIsAssigned: () => true,
      digitalObserverCameraHasLiveStream: (item) => item.source_mode !== "demo" && item.status === "connected"
    },
    "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative: () => null },
    "@/lib/domain/digital-observer/runtime": {
      formatObserverDate: () => "DATE", loadObserverRuntime: async () => ({ sites: [site], cameras: [camera], signals: [], watchRequests: [], runtimeMigrationApplied: true }),
      observerEventLabel: String, observerModeForSite: () => "home", observerSignalMatchesCamera: () => false,
      observerStatusLabel: (value) => value === "connected" ? "מחוברת" : value === "offline" ? "מנותקת" : value === "readiness" ? "ממתינה" : String(value ?? "לא ידוע"),
      selectObserverSite: () => site
    }
  };
  const exports = {};
  script.runInNewContext({ exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`);
    return modules[name];
  } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports.default({ searchParams: Promise.resolve({ camera: camera.id, site: site.id }) });
}
function selectedDetail(tree) {
  const section = nodes(tree, (node) => node.type === "section" && node.props.className === "do-camera-detail-view")[0];
  assert.ok(section);
  const header = nodes(section, (node) => node.type === "div" && node.props.className === "do-camera-detail-head")[0];
  const status = nodes(header, (node) => node.type === "span" && node.props.className?.includes("do-status-dot"))[0];
  const summary = nodes(section, (node) => node.type === "div" && node.props.className === "do-summary-list")[0];
  const conversation = nodes(section, (node) => node.type === "ObserverConversationPanel")[0];
  assert.ok(status && summary && conversation);
  return { section, status, summary, conversation };
}
for (const status of ["connected", "healthy", "online", "active", "offline", "readiness"]) {
  test(`selected demo ${status} is not labeled as a live connection`, async () => {
    const tree = await render({ id: "demo", observer_site_id: "site-a", source_mode: "demo", connector_type: "demo", status, health_status: status, display_name: "Demo" });
    const detail = selectedDetail(tree);
    assert.equal(text(detail.status), "הדמיה · ללא שידור חי");
    assert.match(detail.status.props.className, /warn/);
    assert.match(text(detail.summary), /מצבהדמיה/);
    assert.match(text(detail.summary), /בריאותלא חל על מקור הדמיה/);
    assert.doesNotMatch(text(detail.summary), /מצבמחוברת/);
    assert.match(detail.conversation.props.initialPrompt, /מקור הדמיה בלבד/);
    assert.equal(nodes(detail.section, (node) => node.type === "ObserverLivePlayer").length, 0);
  });
}
for (const [status, label] of [["connected", "מחוברת"], ["offline", "מנותקת"], ["readiness", "ממתינה"]]) {
  test(`non-demo ${status} retains the canonical status`, async () => {
    const tree = await render({ id: "real", observer_site_id: "site-a", source_mode: "live", connector_type: "gateway", status, display_name: "Real" });
    const detail = selectedDetail(tree);
    assert.equal(text(detail.status), label);
    assert.match(text(detail.summary), new RegExp(`מצב${label}`));
    assert.doesNotMatch(detail.conversation.props.initialPrompt, /מקור הדמיה/);
    assert.equal(nodes(detail.section, (node) => node.type === "ObserverLivePlayer").length, status === "connected" ? 1 : 0);
  });
}
