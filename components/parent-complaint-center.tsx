"use client";

import { useState, useTransition } from "react";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";

export function ParentComplaintCenter({ gardenId, parentId, rows }: { gardenId: string; parentId?: string; rows: any[] }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  async function submit(formData: FormData) {
    setMessage("");
    const payload = { garden_id: gardenId, parent_id: parentId || undefined, subject: String(formData.get("subject")), description: String(formData.get("description")), severity: String(formData.get("severity")), urgent: Boolean(formData.get("urgent")), category: String(formData.get("category") || "general") };
    startTransition(async () => {
      const response = await fetch("/api/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "הפנייה נשלחה ותועדה. האדמין/פקח יראו אותה במרכז הדיווחים." : "לא ניתן לשלוח פנייה כרגע.");
    });
  }
  return <section className="grid cols-2 dashboard-panels"><CollapsibleActionPanel title="פנייה חדשה" description="הפניות הקודמות מוצגות בצד. פתחו טופס רק כשצריך לשלוח פנייה חדשה." buttonLabel="יצירת פנייה חדשה" defaultOpen={rows.length === 0}>{({ close }) => <form className="card form wizard-form" action={async (formData) => { await submit(formData); close(); }}><h2>פנייה חדשה</h2>{message ? <div className={message.includes("נשלחה") ? "success-banner" : "error-banner"}>{message}</div> : null}<div className="form-grid"><label>קטגוריה<select name="category"><option value="safety">בטיחות</option><option value="violence">אלימות</option><option value="staff">צוות</option><option value="camera">מצלמות</option><option value="medical">רפואה</option><option value="pickup">איסוף</option><option value="privacy">פרטיות</option><option value="general">כללי</option></select></label><label>חומרה<select name="severity"><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="critical">קריטית</option></select></label><label className="wide">נושא<input name="subject" required /></label><label className="wide">תיאור<textarea name="description" rows={5} required /></label><label><input type="checkbox" name="urgent" /> דחוף</label></div><div className="profile-actions"><button className="button primary" disabled={isPending}>שליחת פנייה</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div></form>}</CollapsibleActionPanel><article className="card action-panel"><h2>פניות קודמות</h2>{rows.length === 0 ? <div className="empty-state"><strong>אין פניות קודמות</strong><span>כל פנייה תישמר עם סטטוס טיפול וזמני תגובה.</span></div> : rows.map((row) => <div className="list-item" key={row.id}><div><strong>{row.subject}</strong><span>{row.severity} · {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}</span></div><span className="pill">{row.status}</span></div>)}</article></section>;
}
