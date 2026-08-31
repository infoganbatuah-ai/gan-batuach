"use client";

import { useState } from "react";
import { Check, Lightbulb, LoaderCircle, Mic, Radar, RefreshCw, Siren, SlidersHorizontal, Volume2 } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type Manifest = { cameraZoneName: string; discoveredAt: string; source: string; capabilities: { ptz: boolean; twoWayAudio: boolean; siren: boolean; lighting: boolean } };
type Action = "ptz" | "talk" | "siren" | "lighting";

const labels: Array<[keyof Manifest["capabilities"], string, typeof Radar]> = [
  ["ptz", "PTZ — סיבוב וזום", SlidersHorizontal],
  ["twoWayAudio", "שמע דו־כיווני", Volume2],
  ["siren", "סירנה", Siren],
  ["lighting", "תאורה / זרקור", Lightbulb]
];

async function requestJson(path: string, body: unknown) {
  const token = readObserverAccessToken();
  const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "הפעולה נכשלה");
  return payload.data;
}

export function ObserverCapabilityPanel({ cameraSourceId }: { cameraSourceId: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function discover() {
    setBusy(true); setError(""); setMessage("");
    try { const data = await requestJson("/api/digital-observer/camera-capabilities", { camera_source_id: cameraSourceId }); setManifest(data.manifest); setMessage("המיפוי הושלם בהצלחה."); }
    catch (e) { setError(e instanceof Error ? e.message : "לא ניתן למפות את היכולות"); }
    finally { setBusy(false); }
  }
  async function act(action: Action) {
    const confirmed = action === "talk" || action === "siren" ? window.confirm("הפעולה יכולה להשפיע בסביבה הפיזית. לאשר שליחה ל-Gateway?") : false;
    if ((action === "talk" || action === "siren") && !confirmed) return;
    setBusy(true); setError(""); setMessage("");
    try { const data = await requestJson("/api/digital-observer/camera-actions", { camera_source_id: cameraSourceId, action, confirmed }); setMessage(data.message); }
    catch (e) { setError(e instanceof Error ? e.message : "לא ניתן לבצע את הפעולה"); }
    finally { setBusy(false); }
  }
  return <section className="do-panel do-capability-panel" aria-label="יכולות מצלמה ופעולות תצפיתן">
    <div className="do-section-head"><div><h2><Radar /> יכולות המצלמה</h2><p>גילוי דינמי לפי הדיווח מהמצלמה וה־Gateway.</p></div><button className="do-button secondary" type="button" onClick={() => void discover()} disabled={busy}><RefreshCw className={busy ? "do-spin" : ""} /> {manifest ? "רענון מיפוי" : "גילוי יכולות"}</button></div>
    {!manifest ? <div className="do-capability-empty"><Mic /><span><strong>טרם בוצע מיפוי</strong><small>לחצו על גילוי יכולות כדי לדעת אילו פעולות זמינות באמת.</small></span></div> : <>
      <div className="do-capability-grid">{labels.map(([key, label, Icon]) => <div className={`do-capability-item ${manifest.capabilities[key] ? "available" : "unavailable"}`} key={key}><Icon /><span><strong>{label}</strong><small>{manifest.capabilities[key] ? "זמין" : "לא דווח / לא זמין"}</small></span>{manifest.capabilities[key] ? <Check /> : null}</div>)}</div>
      <div className="do-capability-actions"><button type="button" disabled={!manifest.capabilities.lighting || busy} onClick={() => void act("lighting")}><Lightbulb /> תאורה</button><button type="button" disabled={!manifest.capabilities.ptz || busy} onClick={() => void act("ptz")}><SlidersHorizontal /> PTZ</button><button type="button" disabled={!manifest.capabilities.twoWayAudio || busy} onClick={() => void act("talk")}><Mic /> דבר</button><button type="button" disabled={!manifest.capabilities.siren || busy} onClick={() => void act("siren")}><Siren /> סירנה</button></div>
      <small className="do-capability-source">מקור המיפוי: {manifest.source} · אזור: {manifest.cameraZoneName} · פעולה פיזית דורשת evidence מאומת מה־Gateway</small>
    </>}
    {busy ? <div className="do-action-result loading"><LoaderCircle className="do-spin" /> בודק ומעביר את הבקשה...</div> : null}{message ? <div className="do-action-result success"><Check /> {message}</div> : null}{error ? <div className="do-action-result error">{error}</div> : null}
  </section>;
}
