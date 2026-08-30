import { readFileSync } from "node:fs";

const rules = readFileSync(new URL("../../app/digital-observer/rules/page.tsx", import.meta.url), "utf8");
for (const required of [
  'import { ObserverLivePlayer }',
  'digitalObserverCameraHasLiveGateway',
  'cameras.map((camera, index)',
  'ObserverLivePlayer compact',
  'observerSiteId={site.id}',
  'cameraSourceId={camera.id}',
  'LIVE מסומן רק לאחר שהנגן מקבל מדיה'
]) {
  if (!rules.includes(required)) throw new Error(`Rules live-source regression guard missing: ${required}`);
}
if (rules.includes('cameras.slice(0, 4).map')) throw new Error("Rules must not hide DVR channels after four sources");
console.log("Observer rules live-source regression checks passed.");
