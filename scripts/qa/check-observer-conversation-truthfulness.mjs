import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../../app/api/digital-observer/conversation/route.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../components/digital-observer/observer-intelligence-experience.tsx", import.meta.url), "utf8");

for (const required of [
  "לא נמצא עדיין אירוע מאומת",
  "מצב החיבור הנוכחי",
  "איני מסיק מה קרה בעבר",
  "awaiting_edge_capability",
  "מנוע Edge עדיין לא דיווח",
  "הוספת מצלמות › DVR/NVR",
  "source_label"
]) {
  if (!route.includes(required)) throw new Error(`Conversation truthfulness guard missing: ${required}`);
}
if (route.includes("אחרי חיבור Gateway ו-AI Shadow")) throw new Error("Conversation must not claim Gateway is pending when it is already connected");
if (!panel.includes("AI מקומי מאומת") || !panel.includes("data.source_label")) throw new Error("Conversation UI must show an accurate answer source");

console.log("Observer conversation truthfulness regression checks passed.");
