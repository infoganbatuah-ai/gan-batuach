import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../../lib/domain/digital-observer/runtime.ts", import.meta.url), "utf8");
const pages = [
  "../../app/digital-observer/dashboard/page.tsx", "../../app/digital-observer/cameras/page.tsx", "../../app/digital-observer/cameras/add/page.tsx", "../../app/digital-observer/alerts/page.tsx", "../../app/digital-observer/rules/page.tsx", "../../app/digital-observer/recordings/page.tsx", "../../app/digital-observer/people/page.tsx", "../../app/digital-observer/settings/page.tsx", "../../app/digital-observer/billing/page.tsx", "../../app/digital-observer/sites/page.tsx"
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
for (const required of ["export function selectObserverSite", "if (requested) return requested", "cameraCountBySite", "countDifference"]) {
  if (!runtime.includes(required)) throw new Error(`Missing camera-aware site selection safeguard: ${required}`);
}
if (pages.some((page) => !page.includes("selectObserverSite("))) throw new Error("A Digital Observer page still falls back to an arbitrary site");
for (const name of ["people", "settings", "rules"]) {
  const page = readFileSync(new URL(`../../app/digital-observer/${name}/page.tsx`, import.meta.url), "utf8");
  if (!page.includes("selectObserverSite(runtime.sites, runtime.cameras, params?.site)")) throw new Error(`${name} ignores the authorized chat site link`);
  if (!page.includes("selectedSite?.id !== params.site ? null")) throw new Error(`${name} silently falls back to another site for an unknown site link`);
}
console.log("Digital Observer camera-aware site selection PASS");
