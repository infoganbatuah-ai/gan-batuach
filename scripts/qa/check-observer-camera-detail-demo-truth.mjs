import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as cameraLiveStatus from "../../lib/domain/digital-observer/camera-live-status.ts";
import * as cameraEmptyState from "../../lib/ui/observer-camera-empty-state.ts";

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
const site = { id: "site-a", site_type: "home" };
const otherSite = { id: "site-b", site_type: "home" };

async function render(cameras, params = {}, sites = [site]) {
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
    "@/lib/domain/digital-observer/camera-live-status": cameraLiveStatus,
    "@/lib/ui/observer-camera-empty-state": cameraEmptyState,
    "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative: () => null },
    "@/lib/domain/digital-observer/runtime": {
      formatObserverDate: () => "DATE", loadObserverRuntime: async () => ({ sites, cameras, cameraHealthReadAt: Date.now(), signals: [], watchRequests: [], runtimeMigrationApplied: true }),
      observerEventLabel: String, observerModeForSite: () => "home", observerSignalMatchesCamera: () => false,
      selectObserverSite: (options, _cameras, requested) => options.find(({ id }) => id === requested) ?? options[0]
    }
  };
  const exports = {};
  script.runInNewContext({ exports, URLSearchParams, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`);
    return modules[name];
  } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports.default({ searchParams: Promise.resolve(params) });
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
    const tree = await render([camera("demo", { source_mode: "demo", connector_type: "demo", status, health_status: status })], { camera: "demo" });
    const detail = selectedDetail(tree);
    assert.equal(text(detail.status), "הדמיה · ללא שידור חי");
    assert.match(detail.status.props.className, /warn/);
    assert.match(text(detail.summary), /מצבהדמיה/);
    assert.equal(nodes(detail.section, (node) => node.props.body?.action === "remove_demo_bundle").length, 1);
    assert.doesNotMatch(text(detail.summary), /מצבמחוברת/);
    assert.match(detail.conversation.props.initialPrompt, /מקור הדמיה בלבד/);
    assert.equal(nodes(detail.section, (node) => node.type === "ObserverLivePlayer").length, 0);
  });
}
function camera(id, overrides = {}) {
  return {
    id,
    observer_site_id: "site-a",
    source_mode: "live",
    connector_type: "gateway",
    display_name: id,
    status: "connected",
    health_status: "healthy",
    gateway_stream_id: "internal-stream-reference",
    ...overrides,
  };
}

const timeAgo = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
function runtimeCamera(source) {
  const projected = cameraLiveStatus.digitalObserverCameraHealthProjection(source);
  return { ...source, status: projected.status, health_status: projected.healthStatus };
}
const tiles = (tree) => nodes(tree, (node) => node.props.className === "do-camera-live-tile");
const players = (tree) => nodes(tree, (node) => node.type === "ObserverLivePlayer");

const stale = Array.from({ length: 11 }, (_, index) => camera(`CH${index + 1}`, {
  last_health_check_at: timeAgo(120),
  updated_at: timeAgo(0),
  location_label: index === 0 ? "כניסה" : "בית",
}));
const warehouse = [
  ...stale,
  camera("empty", { metadata: { channel_assignment: "CHANNEL_EMPTY" } }),
  camera("detached", { metadata: { physical_camera_attached: false } }),
  camera("demo", { source_mode: "demo", last_health_check_at: timeAgo(0) }),
  camera("foreign", { observer_site_id: "site-b", last_health_check_at: timeAgo(0) }),
];

test("all 11 stale assigned cameras appear by default, zero active, all 11 offline", async () => {
  const all = await render(warehouse);
  assert.equal(tiles(all).length, 11);
  assert.equal(players(all).length, 0);
  assert.match(text(all), /11 משויכות · 0 זמינות לצפייה חיה · 11 ללא שידור זמין/);
  for (const tile of tiles(all)) assert.match(text(tile), /לא זמינה כרגע/);
  assert.doesNotMatch(text(all), /empty|detached|demo|foreign/);

  const active = await render(warehouse, { status: "active" });
  assert.equal(tiles(active).length, 0);
  assert.equal(players(active).length, 0);

  const offline = await render(warehouse, { status: "offline" });
  assert.equal(tiles(offline).length, 11);
  assert.equal(players(offline).length, 0);
});

test("filtered camera deep links preserve site and filters and never mount playback for a stale camera", async () => {
  const params = { status: "offline", q: "כניסה", location: "כניסה" };
  const list = await render(warehouse, params);
  assert.equal(tiles(list).length, 1);
  const link = nodes(list, (node) => node.props.className === "do-camera-live-open")[0];
  const selection = Object.fromEntries(new URL(link.props.href, "https://qa.invalid").searchParams);
  assert.deepEqual(selection, { site: site.id, ...params, camera: "CH1" });
  const detail = selectedDetail(await render(warehouse, selection));
  assert.equal(text(detail.status), "לא זמינה כרגע");
  assert.equal(players(detail.section).length, 0);
  assert.equal(nodes(detail.section, (node) => node.type === "ObserverCameraControls").length, 0);
  assert.equal(nodes(detail.summary, (node) => node.type === "time")[0].props.dateTime, stale[0].last_health_check_at);
  assert.match(text(detail.summary), /דרך חיבורGateway/);
  assert.doesNotMatch(JSON.stringify(detail.section), /internal-stream-reference/);
  const back = nodes(detail.section, (node) => node.props.className === "do-link do-camera-back")[0];
  assert.deepEqual(Object.fromEntries(new URL(back.props.href, "https://qa.invalid").searchParams), { site: site.id, ...params });
});

test("only fresh online sources with a reference get compact playback or detail playback controls", async () => {
  const sample = [
    camera("ready", { last_seen_at: timeAgo(5) }),
    camera("no-reference", { last_seen_at: timeAgo(1), gateway_stream_id: " " }),
    runtimeCamera(camera("recovering", { last_seen_at: timeAgo(60) })),
  ];
  const list = await render(sample);
  assert.equal(tiles(list).length, 3);
  assert.equal(players(list).length, 1);
  assert.equal(players(list)[0].props.cameraSourceId, "ready");
  assert.equal(players(list)[0].props.compact, true);
  assert.match(text(list), /החיבור מתאושש/);

  const detail = selectedDetail(await render(sample, { camera: "ready" }));
  assert.equal(text(detail.status), "זמינה לצפייה חיה");
  assert.equal(players(detail.section).length, 1);
  assert.equal(players(detail.section)[0].props.large, true);

  const unavailable = selectedDetail(await render(sample, { camera: "no-reference" }));
  assert.equal(text(unavailable.status), "לא זמינה כרגע");
  assert.equal(players(unavailable.section).length, 0);
  assert.doesNotMatch(text(unavailable.summary), /בדיקה אחרונה/);
});

test("an explicit site never selects a camera from a different site; a site-less authorized link resolves", async () => {
  const scoped = await render(warehouse, { site: site.id, camera: "foreign" }, [site, otherSite]);
  assert.equal(players(scoped).length, 0);
  assert.equal(tiles(scoped).length, 11);

  const direct = await render(warehouse, { camera: "foreign" }, [site, otherSite]);
  assert.equal(players(selectedDetail(direct).section)[0].props.observerSiteId, otherSite.id);
});
