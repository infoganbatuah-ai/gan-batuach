"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";

type Context = { gardenId: string; childId: string | null; label: string };

function parentStatus(status?: string | null) {
  const labels: Record<string, string> = {
    new: "התקבלה", assigned: "נמסרה לטיפול", in_progress: "בבדיקה",
    waiting_garden: "ממתינה לגן", waiting_reporter: "נדרש מידע נוסף",
    escalated: "הועברה לטיפול מוגבר", resolved: "טופלה", closed: "נסגרה", reopened: "נפתחה מחדש"
  };
  return labels[status ?? "new"] ?? "בבדיקה";
}

export function ParentComplaintCenter({ contexts, rows }: { contexts: Context[]; rows: any[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  function respond(id: string) {
    const note = window.prompt("איזה מידע נוסף תרצו למסור?");
    if (!note?.trim()) return;
    startTransition(async () => {
      const response = await fetch(`/api/complaints/${id}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reporter_reply", publicNote: note.trim() })
      });
      const body = await response.json().catch(() => ({}));
      setMessage(response.ok ? "המידע הנוסף נשמר." : body.error || "לא ניתן לשלוח את המידע כרגע.");
      if (response.ok) router.refresh();
    });
  }
  async function submit(formData: FormData) {
    setMessage("");
    const selected = contexts[Number(formData.get("context"))];
    if (!selected) { setMessage("אין שיוך פעיל לילד ולגן לצורך הגשת תלונה."); return; }
    const payload = {
      garden_id: selected.gardenId, child_id: selected.childId ?? undefined,
      subject: String(formData.get("subject")), description: String(formData.get("description")),
      severity: String(formData.get("severity")), urgent: Boolean(formData.get("urgent")),
      category: String(formData.get("category") || "general")
    };
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
    const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    let requestKey = crypto.randomUUID();
    try {
      const pending = JSON.parse(sessionStorage.getItem("gb:m25:pending-complaint") ?? "null") as { fingerprint?: string; key?: string } | null;
      if (pending?.fingerprint === fingerprint && pending.key) requestKey = pending.key;
      else sessionStorage.setItem("gb:m25:pending-complaint", JSON.stringify({ fingerprint, key: requestKey }));
    } catch { /* A private-mode storage failure does not bypass server-side authorization. */ }
    startTransition(async () => {
      const response = await fetch("/api/parent/complaints", {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        try { sessionStorage.removeItem("gb:m25:pending-complaint"); } catch { /* Optional retry preference. */ }
        setMessage("התלונה נשלחה ותועדה."); router.refresh();
      }
      else setMessage(body.error || "לא ניתן לשלוח תלונה כרגע.");
    });
  }
  return <section className="grid cols-2 dashboard-panels">
    <CollapsibleActionPanel title="תלונה חדשה" description="תלונה רשמית מתועדת בנפרד מהודעות רגילות." buttonLabel="יצירת תלונה" defaultOpen={rows.length === 0}>
      {({ close }) => <form className="parent-section-card wizard-form" action={async (formData) => { await submit(formData); close(); }}>
        <h2>תלונה חדשה</h2>
        {message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}
        <div className="form-grid">
          <label className="wide">ילד וגן<select name="context" required>{contexts.map((context, index) => <option key={`${context.childId}-${context.gardenId}`} value={index}>{context.label}</option>)}</select></label>
          <label>קטגוריה<select name="category"><option value="safety">בטיחות</option><option value="violence">אלימות</option><option value="staff">צוות</option><option value="camera">מצלמות</option><option value="medical">רפואה</option><option value="pickup">איסוף</option><option value="privacy">פרטיות</option><option value="general">כללי</option></select></label>
          <label>דחיפות מדווחת<select name="severity"><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="critical">קריטית</option></select></label>
          <label className="wide">נושא<input name="subject" required minLength={2} maxLength={200} /></label>
          <label className="wide">תיאור<textarea name="description" rows={5} required minLength={5} maxLength={10000} /></label>
          <label><input type="checkbox" name="urgent" /> דחוף</label>
        </div>
        <div className="profile-actions"><button className="button primary" disabled={isPending || contexts.length === 0}>שליחת תלונה</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
      </form>}
    </CollapsibleActionPanel>
    <article className="parent-section-card"><h2>תלונות קודמות</h2>
      {rows.length === 0 ? <div className="parent-empty-state"><strong>אין תלונות קודמות</strong><span>כל תלונה תישמר עם סטטוס טיפול.</span></div>
        : rows.map((row) => <div className="list-item" key={row.id}><div><strong>{row.subject}</strong><span>{row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}</span>{row.resolution_public ? <span>{row.resolution_public}</span> : null}</div><span className="pill">{parentStatus(row.status)}</span>{row.status === "waiting_reporter" ? <button type="button" className="button secondary" disabled={isPending} onClick={() => respond(row.id)}>מסירת מידע נוסף</button> : null}</div>)}
    </article>
  </section>;
}
