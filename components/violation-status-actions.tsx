"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const labels: Record<string, string> = { open: "פתוח", in_progress: "בטיפול", waiting_approval: "ממתין לאישור", done: "נסגר", overdue: "באיחור", rejected: "נדחה" };
export function ViolationStatusActions({ id, initialStatus, role = "inspector" }: { id: string; initialStatus: string; role?: "inspector" | "garden" }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function update(action: string) {
    setBusy(true); setMessage(null);
    try {
      const evidencePaths: string[] = [];
      if (file && (action === "progress" || action === "submit")) {
        const form = new FormData(); form.set("file", file);
        const upload = await fetch(`/api/violations/${id}/evidence`, { method: "POST", body: form });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error || "שמירת הראיה נכשלה");
        evidencePaths.push(uploaded.data.path);
      }
      const response = await fetch(`/api/violations/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note: note || undefined, evidencePaths }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לעדכן את הליקוי");
      setStatus(body.data.status); setNote(""); setFile(null); setMessage("הפעולה נשמרה"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "לא ניתן לעדכן את הליקוי"); }
    finally { setBusy(false); }
  }
  return <div className="profile-actions violation-actions">
    <span className={status === "done" ? "pill good" : status === "rejected" ? "pill bad" : "pill warn"}>{labels[status] ?? status}</span>
    {role === "garden" && status !== "done" && <>
      <input aria-label="תיאור הטיפול" value={note} onChange={(event) => setNote(event.target.value)} placeholder="תיאור הטיפול" maxLength={2000} />
      <input aria-label="ראיית תיקון" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      {status === "open" && <button className="button secondary tiny" disabled={busy} type="button" onClick={() => update("acknowledge")}>אישור קבלה</button>}
      {["open", "in_progress", "rejected", "overdue"].includes(status) && <button className="button secondary tiny" disabled={busy} type="button" onClick={() => update("progress")}>שמירת התקדמות</button>}
      {["in_progress", "rejected", "overdue"].includes(status) && <button className="button primary tiny" disabled={busy || !note.trim()} type="button" onClick={() => update("submit")}>שליחה לבדיקת פקח</button>}
    </>}
    {role === "inspector" && <>
      {status === "waiting_approval" && <button className="button primary tiny" disabled={busy} type="button" onClick={() => update("accept")}>אישור וסגירה</button>}
      {status === "waiting_approval" && <button className="button danger tiny" disabled={busy || !note.trim()} type="button" onClick={() => update("reject")}>דחיית תיקון</button>}
      {status === "done" && <button className="button secondary tiny" disabled={busy || !note.trim()} type="button" onClick={() => update("reopen")}>פתיחה מחדש</button>}
      {(status === "waiting_approval" || status === "done") && <input aria-label="הערת פקח" value={note} onChange={(event) => setNote(event.target.value)} placeholder="סיבה לדחייה או לפתיחה מחדש" maxLength={2000} />}
    </>}
    {message && <small className={message.includes("נשמרה") ? "payment-action-message" : "error-text"}>{message}</small>}
  </div>;
}
