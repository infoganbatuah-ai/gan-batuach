import { readFile } from "node:fs/promises";

const files = {
  registration: "app/digital-observer/register/page.tsx",
  auth: "app/digital-observer/auth-actions.ts",
  privacy: "app/digital-observer/privacy/page.tsx",
  settings: "app/digital-observer/settings/page.tsx",
  runtime: "lib/domain/digital-observer/runtime.ts",
  dashboard: "app/digital-observer/dashboard/page.tsx",
  cameraWizard: "components/digital-observer/observer-action-forms.tsx"
};

const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, "utf8")])
));

const checks = [
  ["terms remain required", /name="terms_consent" type="checkbox" required/.test(source.registration)],
  ["model improvement is optional in the form", /name="model_improvement_consent" type="checkbox"(?! required)/.test(source.registration)],
  ["server rejects only missing terms", /if \(!termsConsent\) redirect\("\/digital-observer\/register\?error=terms_required"\)/.test(source.auth)],
  ["optional consent is stored as selected", /model_improvement_consent: modelImprovementConsent/.test(source.auth)],
  ["privacy requests are product scoped", /product: "digital_observer"/.test(source.privacy)],
  ["privacy requests are linked to an observer site", /observer_site_id: observerSiteId/.test(source.privacy)],
  ["settings link to the observer privacy center", /href="\/digital-observer\/privacy"/.test(source.settings)],
  ["no raw video model-training opt-in is added", !/raw_video.*training.*true/i.test(source.registration + source.auth + source.privacy)],
  ["dashboard selects only an already accessible site", /selectObserverSite\(runtime\.sites, runtime\.cameras, params\?\.site\)/.test(source.dashboard)],
  ["default site prefers an existing mapped camera source", /cameraCountBySite/.test(source.runtime)],
  ["DVR wizard directs credentials only to the local gateway", /אין להזין כאן כתובת או סיסמת DVR/.test(source.cameraWizard)]
];

const failed = checks.filter(([, passed]) => !passed).map(([name]) => name);
for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exitCode = 1;
