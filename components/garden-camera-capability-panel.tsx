"use client";

import { useState } from "react";
import { Check, Lightbulb, Mic, RefreshCw, Siren, SlidersHorizontal } from "lucide-react";

type Action = "lighting" | "ptz" | "talk" | "siren";
type Manifest = { source: string; capabilities: Record<string, boolean>; details?: Record<string, { states?: string[]; axes?: string[] }> };

export function GardenCameraCapabilityPanel({ cameraId }: { cameraId: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [direction, setDirection] = useState("left");
  const [text, setText] = useState("");
  async function discover() {
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/camera-streams/${cameraId}/capabilities`, { method: "POST" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setManifest(body.data.manifest); setMessage(body.data.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "גילוי היכולות נכשל"); }
    finally { setBusy(false); }
  }
  async function act(action: Action) {
    if (!manifest?.capabilities[action === "talk" ? "twoWayAudio" : action]) return;
    if (action === "talk" && !text.trim()) { setMessage("יש לכתוב הודעה להשמעה."); return; }
    const payload = action === "lighting" ? { enabled: true } : action === "ptz" ? { direction, duration_ms: 500 } : action === "siren" ? { duration_ms: 3000 } : { text: text.trim() };
    if (!window.confirm("לאשר את פעולת המצלמה?")) return;
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/camera-streams/${cameraId}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ camera_stream_id: cameraId, action, payload, confirmed: true, request_id: crypto.randomUUID(), requested_at: new Date().toISOString() }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setMessage(body.data.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "הפעולה נכשלה"); }
    finally { setBusy(false); }
  }
  return <div className="garden-camera-capability-panel" aria-label="יכולות ושליטת מצלמה">
    <div className="garden-camera-capability-head"><strong>יכולות ושליטה</strong><button type="button" onClick={() => void discover()} disabled={busy}><RefreshCw size={15} /> {manifest ? "רענון" : "גילוי יכולות"}</button></div>
    {manifest ? <><div className="garden-camera-capability-list">{[["ptz", "PTZ", SlidersHorizontal], ["twoWayAudio", "דיבור", Mic], ["siren", "סירנה", Siren], ["lighting", "תאורה", Lightbulb]].map(([key, label, Icon]: any) => manifest.capabilities[String(key)] ? <span key={String(key)}><Icon size={14} /> {String(label)} <Check size={13} /></span> : null)}</div><div className="garden-camera-capability-actions"><select aria-label="כיוון PTZ" value={direction} onChange={(event) => setDirection(event.target.value)}><option value="left">שמאלה</option><option value="right">ימינה</option><option value="up">למעלה</option><option value="down">למטה</option><option value="zoom_in">קירוב</option><option value="zoom_out">הרחקה</option></select><input aria-label="הודעה להשמעה" placeholder="הודעה להשמעה" value={text} onChange={(event) => setText(event.target.value)} /><button type="button" disabled={busy || !manifest.capabilities.lighting} onClick={() => void act("lighting")}><Lightbulb size={15} /> תאורה</button><button type="button" disabled={busy || !manifest.capabilities.ptz} onClick={() => void act("ptz")}><SlidersHorizontal size={15} /> PTZ</button><button type="button" disabled={busy || !manifest.capabilities.twoWayAudio} onClick={() => void act("talk")}><Mic size={15} /> דבר</button><button type="button" disabled={busy || !manifest.capabilities.siren} onClick={() => void act("siren")}><Siren size={15} /> סירנה</button></div></> : <small>גלה את היכולות כדי להציג פעולות זמינות למצלמה הזו.</small>}
    {message ? <small role="status">{message}</small> : null}
  </div>;
}
