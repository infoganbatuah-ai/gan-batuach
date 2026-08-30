import { readFileSync } from "node:fs";

const runtime = readFileSync(new URL("../../lib/domain/digital-observer/runtime.ts", import.meta.url), "utf8");
const pages = [
  "../../app/digital-observer/dashboard/page.tsx", "../../app/digital-observer/cameras/page.tsx", "../../app/digital-observer/cameras/add/page.tsx", "../../app/digital-observer/alerts/page.tsx", "../../app/digital-observer/rules/page.tsx", "../../app/digital-observer/recordings/page.tsx", "../../app/digital-observer/people/page.tsx", "../../app/digital-observer/settings/page.tsx", "../../app/digital-observer/billing/page.tsx", "../../app/digital-observer/sites/page.tsx"
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
for (const required of ["export function selectObserverSite", "if (requested) return requested", "cameraCountBySite", "countDifference"]) {
  if (!runtime.includes(required)) throw new Error(`Missing camera-aware site selection safeguard: ${required}`);
}
if (pages.some((page) => !page.includes("selectObserverSite("))) throw new Error("A Digital Observer page still falls back to an arbitrary site");
console.log("Digital Observer camera-aware site selection PASS");
