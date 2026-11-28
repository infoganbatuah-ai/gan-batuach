import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import { createElement } from "react";
import jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as cameraStatus from "../../lib/domain/digital-observer/camera-live-status.ts";

const page = new URL("../../app/digital-observer/dashboard/page.tsx", import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(page, "utf8"), {
  fileName: page.pathname,
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
});
const compiledDashboard = new vm.Script(outputText, { filename: page.pathname });
const fixedTime = Date.parse("2026-11-26T18:00:00Z");
const minutesAgo = (minutes) => new Date(fixedTime - minutes * 60_000).toISOString();
const home = { id: "home", name: "בדיקת הבית", site_type: "home", monitoring_enabled: true };
const business = { id: "business", name: "בדיקת העסק", site_type: "business", monitoring_enabled: true };
const streamReference = "synthetic-private-stream-reference";
const iconNames = ["Activity", "AlertTriangle", "ArrowLeft", "Bell", "Building2", "Camera",
  "CameraOff", "CheckCircle2", "LayoutGrid", "List", "MapPin", "Moon", "Plus", "Radar", "ShieldCheck"];
const icons = Object.fromEntries(iconNames.map((name) => [name, (props) => createElement("svg", props)]));

function camera(id, site, overrides = {}) {
  return {
    id,
    observer_site_id: site.id,
    source_mode: "live",
    status: "connected",
    health_status: "healthy",
    last_seen_at: minutesAgo(150),
    updated_at: minutesAgo(0),
    display_name: id,
    preview_scene: "home-living",
    gateway_stream_id: streamReference,
    ...overrides,
  };
}

function staleSite(site) {
  return [
    camera("Demo", site, { source_mode: "demo", last_seen_at: minutesAgo(0) }),
    camera("Empty", site, { last_seen_at: minutesAgo(0), metadata: { channel_assignment: "CHANNEL_EMPTY" } }),
    camera("Detached", site, { last_seen_at: minutesAgo(0), metadata: { physical_camera_attached: false } }),
    ...Array.from({ length: 11 }, (_, index) => camera(`Camera ${index + 1}`, site)),
  ];
}

// Real server-rendered page and status helper with synthetic data. Only imports
// necessary to render are supplied. There is no application server or playback.
async function renderDashboard(cameras, site, { now = fixedTime, sites = [home, business] } = {}) {
  let readings = 0;
  class DashboardClock extends Date {
    static now() {
      readings += 1;
      return now;
    }
  }
  const modules = {
    "react/jsx-runtime": jsxRuntime,
    "next/link": (props) => createElement("a", props),
    "next/image": ({ priority, ...props }) => createElement("img", { ...props, loading: priority ? "eager" : "lazy" }),
    "lucide-react": icons,
    "@/components/digital-observer/observer-app-shell": {
      ObserverAppShell: ({ children, statusLabel, mode }) => createElement("div", {
        dir: "rtl", className: `do-shell do-mode-${mode}`, "data-camera-status": statusLabel,
      }, createElement("aside", { className: "do-sidebar" }),
      createElement("div", { className: "do-workspace" }, createElement("main", { className: "do-content" }, children))),
    },
    "@/components/digital-observer/observer-journal-refresh": { ObserverJournalRefresh: () => null },
    "@/components/digital-observer/observer-camera-presence": { ObserverCameraPresence: () => null },
    "@/components/digital-observer/observer-live-player": {
      ObserverLivePlayer: ({ cameraSourceId, observerSiteId }) => createElement("video", {
        className: "do-live-player compact", "data-source": cameraSourceId, "data-site": observerSiteId,
      }),
    },
    "@/lib/domain/digital-observer/access": {
      requireDigitalObserverUser: async () => ({ profile: { id: "qa-owner" } }),
    },
    "@/lib/domain/digital-observer/camera-live-status": cameraStatus,
    "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative: () => null },
    "@/lib/domain/digital-observer/runtime": {
      loadObserverRuntime: async () => ({ cameras, sites, signals: [], schedules: [], runtimeMigrationApplied: true }),
      selectObserverSite: (availableSites, _cameras, requested) =>
        availableSites.find(({ id }) => id === requested) ?? availableSites[0] ?? null,
      observerModeForSite: (selected) => selected?.site_type ?? "business",
      observerStatusLabel: String,
    },
  };
  const exports = {};
  compiledDashboard.runInNewContext({
    Date: DashboardClock,
    URLSearchParams,
    exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `unexpected import in closed dashboard harness: ${name}`);
      return modules[name];
    },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const tree = await exports.default({ searchParams: Promise.resolve({ site: site?.id }) });
  assert.equal(readings, 1, "one server clock reading for all camera states and playback decisions");
  return renderToStaticMarkup(tree);
}

for (const site of [home, business]) {
  test(`${site.id} totals and camera previews stay offline when all eleven assigned reports are stale`, async () => {
    const html = await renderDashboard([
      ...staleSite(site),
      camera("Fresh other site", site === home ? business : home, { last_seen_at: minutesAgo(1) }),
    ], site);
    assert.match(html, /11 משויכות · 0 זמינות לצפייה חיה · 0 מתאוששות · 11 ללא שידור זמין/);
    assert.match(html, /data-camera-status="0 זמינות לצפייה חיה"/);
    assert.equal((html.match(/class="do-dashboard-camera-card"/g) ?? []).length, site === home ? 4 : 5);
    assert.match(html, new RegExp(`href="/digital-observer/cameras\\?site=${site.id}&amp;camera=Camera\\+1"`));
    assert.match(html, new RegExp(`href="/digital-observer/cameras\\?site=${site.id}"`));
    assert.match(html, /aria-label="Camera 1 · אין שידור זמין"/);
    assert.doesNotMatch(html, /הכול תקין|דיווחו על חיבור|ניטור אמיתי פעיל|<video|\bscene-|Demo|Empty|Detached|Fresh other site/);
    if (site === business) assert.match(html, /זמינות המקורות דורשת בדיקה/);
  });
}

test("one fresh source plays, recovery and demo stay labeled, and a missing stream reference is offline", async () => {
  const recovery = camera("Recovering", business, {
    status: "recovering", health_status: "degraded", last_seen_at: minutesAgo(60),
    metadata: {
      operational_health_state: "RECOVERING", reported_status: "connected", reported_health_status: "healthy",
    },
  });
  const cameras = [
    camera("Fresh", business, { last_seen_at: minutesAgo(1), metadata: { canonical_stream_reference: streamReference } }),
    camera("No stream", business, { last_seen_at: minutesAgo(1), gateway_stream_id: " " }),
    recovery,
    camera("Demo", business, { source_mode: "demo", last_seen_at: minutesAgo(1) }),
  ];
  const html = await renderDashboard(cameras, business);
  assert.match(html, /3 משויכות · 1 זמינות לצפייה חיה · 1 מתאוששות · 1 ללא שידור זמין/);
  assert.equal((html.match(/<video/g) ?? []).length, 1);
  assert.match(html, /data-source="Fresh" data-site="business"/);
  assert.match(html, /aria-label="Recovering · החיבור מתאושש"/);
  assert.match(html, /aria-label="No stream · אין שידור זמין"/);
  assert.match(html, /aria-label="Demo · הדמיה בלבד"/);
  assert.ok(!html.includes(streamReference));
  assert.doesNotMatch(html, /\bscene-/);

  const later = await renderDashboard(cameras, business, { now: fixedTime + 31 * 60_000 });
  assert.match(later, /3 משויכות · 1 זמינות לצפייה חיה · 0 מתאוששות · 2 ללא שידור זמין/);
  assert.match(later, /aria-label="Recovering · אין שידור זמין"/);
});
