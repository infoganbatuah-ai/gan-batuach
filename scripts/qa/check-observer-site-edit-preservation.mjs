import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/digital-observer/onboarding/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/digital-observer/onboarding/page.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("../../components/digital-observer/observer-action-forms.tsx", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../lib/domain/digital-observer/runtime.ts", import.meta.url), "utf8");

for (const required of [
  "if (payload.observer_site_id)",
  '.eq("id", payload.observer_site_id)',
  "monitoring_enabled: allowedSite.monitoring_enabled",
  "metadata: { ...existingMetadata, ...onboardingMetadata }",
  "if (!payload.create_new_site)",
  "activated_observer_site_id",
  "if (!payload.observer_site_id)"
]) {
  if (!route.includes(required)) throw new Error(`Missing site edit preservation guard: ${required}`);
}

if (route.includes('from("digital_observer_camera_sources"') || route.includes('from("camera_streams"') || route.includes('from("digital_observer_signals"')) {
  throw new Error("Site address edit route must not mutate camera sources or events");
}
for (const required of ["existingSite={existingSite}", "createRequested={createRequested || !existingSite}", "create_new_site: !existingSite && createRequested && newSiteConfirmed", "אני מאשר/ת יצירת אתר חדש ונפרד"]) {
  if (!(page + form).includes(required)) throw new Error(`Missing explicit edit/create UI guard: ${required}`);
}
for (const required of ["cameraCountBySite", "countDifference", "requestedSiteId ? sites.find"]) {
  if (!runtime.includes(required)) throw new Error(`Dashboard site selection does not prefer the accessible site with cameras: ${required}`);
}

console.log("Observer site edit preservation regression checks passed.");
