import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../../app/digital-observer/cameras/add/page.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} });
const site = "11111111-1111-4111-8111-111111111111";
const otherSite = "33333333-3333-4333-8333-333333333333";
const intent = "22222222-2222-4222-8222-222222222222";
const handoffPath = `/digital-observer/cameras/add?site=${site}&install_intent=${intent}`;
const compile = (path) => ts.transpileModule(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const loginSource = compile("app/digital-observer/login/page.tsx");
const connector = { exports: {} };
runInNewContext(compile("lib/domain/digital-observer/connector-installation.ts"), {
  ...connector, URLSearchParams, require(name) {
    if (name === "zod") return { z };
    assert.equal(name, "./connectivity-registry");
    return { connectivityFamilyIds: ["unknown"] };
  }
}, { timeout: 1000 });

async function activeLoginReturn(next) {
  const exports = {};
  let destination;
  const returned = new Error("redirect");
  const modules = {
    "next/navigation": { redirect(path) { destination = path; throw returned; } },
    "@/lib/domain/digital-observer/connector-installation": connector.exports,
    "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: async () => ({ profile: { id: "synthetic" } }) }
  };
  runInNewContext(loginSource, { exports, URLSearchParams, require: (name) => modules[name] ?? {} }, { timeout: 1000 });
  await assert.rejects(exports.default({ searchParams: Promise.resolve({ next }) }), (error) => error === returned);
  return destination;
}

async function render(params, selected = site) {
  const exports = {};
  const observations = {};
  const jsx = (type, props) => {
    if (type === "wizard") observations.wizard = props;
    return { type, props };
  };
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { default: "link" },
    "@/components/digital-observer/universal-camera-onboarding": { UniversalCameraOnboarding: "wizard" },
    "@/components/digital-observer/observer-action-forms": { ObserverCameraWizard: "advanced" },
    "@/components/digital-observer/observer-app-shell": { ObserverAppShell: "shell" },
    "@/components/digital-observer/gateway-enrollment-panel": { GatewayEnrollmentPanel: "enrollment" },
    "@/components/digital-observer/camera-onboarding-status": { CameraOnboardingStatus: "status" },
    "@/lib/domain/digital-observer/access": { async requireDigitalObserverUser(path) {
      observations.login = path;
      return { profile: {}, user: { id: "synthetic" } };
    } },
    "@/lib/domain/digital-observer/admin-access": { hasCurrentObserverAdmin: () => false },
    "@/lib/domain/digital-observer/runtime": {
      loadObserverRuntime: async () => ({ sites: [{ id: selected }], cameras: [] }),
      selectObserverSite: (sites) => sites[0],
      observerModeForSite: () => "home"
    }
  };
  runInNewContext(outputText, { exports, URLSearchParams, require(name) {
    assert.ok(Object.hasOwn(modules, name), name);
    return modules[name];
  } }, { timeout: 1000 });
  await exports.default({ searchParams: Promise.resolve(params) });
  const login = new URL(observations.login, "https://qa.invalid");
  assert.equal(login.pathname, "/digital-observer/login");
  return { next: login.searchParams.get("next"), wizard: observations.wizard };
}

test("login retains only the site and intent in a valid handoff return", async () => {
  const result = await render({ site, install_intent: intent, secret: "synthetic", next: "https://other.invalid" });
  assert.equal(result.next, `/digital-observer/cameras/add?site=${site}&install_intent=${intent}`);
  assert.equal(result.wizard.initialSiteId, site);
  assert.equal(result.wizard.initialIntent, intent);
});

test("a fallback site never receives another site's resumed handoff", async () => {
  const result = await render({ site: otherSite, install_intent: intent });
  assert.equal(result.wizard.initialSiteId, site);
  assert.equal(result.wizard.initialIntent, undefined);
});

test("a malformed site or a missing site never propagates an intent", async () => {
  for (const badSite of ["https://other.invalid", undefined]) {
    const result = await render({ site: badSite, install_intent: intent });
    assert.equal(result.next, "/digital-observer/cameras/add");
    assert.equal(result.wizard.initialIntent, undefined);
  }
});

test("an active session returns from login to the scoped handoff and the correct wizard site", async () => {
  const initial = await render({ site, install_intent: intent });
  const destination = await activeLoginReturn(initial.next);
  assert.equal(destination, handoffPath);
  const reopened = await render(Object.fromEntries(new URL(destination, "https://qa.invalid").searchParams));
  assert.equal(reopened.wizard.initialSiteId, site);
  assert.equal(reopened.wizard.initialIntent, intent);
});

test("active login cannot resume an external URL or ambiguous handoff references", async () => {
  for (const invalid of [
    `https://other.invalid${handoffPath}`,
    `${handoffPath}&site=${otherSite}`,
    `${handoffPath}&next=https://other.invalid`,
    "/digital-observer/cameras/add?site=invalid&install_intent=invalid"
  ]) {
    assert.equal(await activeLoginReturn(invalid), "/digital-observer/dashboard");
  }
});
