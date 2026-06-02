"use client";
import { useState } from "react";
import { CheckCircle2, ClipboardPlus, EyeOff } from "lucide-react";

export function AiEventActions({ eventId }: { eventId?: string }) {
  const [status, setStatus] = useState("ממתין לטיפול");
  async function persist(action: string) {
    if (!eventId) { setStatus("בחרו אירוע AI לפני ביצוע פעולה."); return; }
    const response = await fetch(`/api/ai-events/${eventId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const body = await response.json();
    setStatus(response.ok ? "הפעולה נשמרה במסד הנתונים." : body.error || "הפעולה נכשלה");
  }
  return <div><div className="actions"><button className="button primary" type="button" disabled={!eventId} onClick={() => persist("create_task")}><ClipboardPlus size={16} /> יצירת משימה</button><button className="button" type="button" disabled={!eventId} onClick={() => persist("handled")}><CheckCircle2 size={16} /> טופל</button><button className="button" type="button" disabled={!eventId} onClick={() => persist("false_positive")}><EyeOff size={16} /> זיהוי שגוי</button></div><div className="success-screen compact-success"><strong>{status}</strong><small>ניהול אירוע נשמר במסד הנתונים; זיהוי Live דורש Gateway.</small></div></div>;
}
