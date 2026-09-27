"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, FileCheck2, FileUp, ShieldCheck, XCircle } from "lucide-react";
import { recruitmentDocumentState } from "@/lib/domain/recruitment-display";

type CandidateDocument = { id: string; status: string; uploaded_at: string };

export function StaffCandidateDocumentUpload() {
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/staff/candidate-documents", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((body) => setDocuments(body?.data ?? []))
      .catch(() => setMessage("לא ניתן לטעון את מסמכי המועמדות כעת."));
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const form = event.currentTarget;
    const response = await fetch("/api/staff/candidate-documents", { method: "POST", body: new FormData(form) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(body.error ?? "העלאת המסמך נכשלה."); return; }
    setMessage("המסמך הועלה באופן פרטי. הוא טרם אומת.");
    window.location.reload();
  }

  return <section className="ux08-documents-card" aria-label="מסמכים ותעודות למועמדות">
    <header><span><FileCheck2 /></span><div><small>מסמכים ותעודות</small><h2>ההסמכות שלך</h2><p>המסמכים פרטיים ומשמשים לבדיקת המועמדות. העלאה אינה אימות.</p></div></header>
    <form className="ux08-upload-zone" onSubmit={upload}><FileUp /><div><strong>העלאת תעודה או הסמכה</strong><small>PDF או תמונה · עד 12MB</small></div><input aria-label="בחירת מסמך הסמכה" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required /><button className="button primary" type="submit" disabled={busy}>{busy ? "מעלה..." : "בחירה והעלאה"}</button></form>
    <div className="ux08-document-list">{documents.map((document) => {
      const state = recruitmentDocumentState(document.status);
      const Icon = document.status === "verified" ? CheckCircle2 : document.status === "rejected" ? XCircle : Clock3;
      return <a href={`/api/staff/candidate-documents/${document.id}/file`} target="_blank" rel="noreferrer" key={document.id}><span className={`tone-${state.tone}`}><Icon /></span><div><strong>מסמך הסמכה</strong><small>הועלה {new Date(document.uploaded_at).toLocaleDateString("he-IL")}</small></div><em className={`tone-${state.tone}`}>{state.label}</em></a>;
    })}{documents.length === 0 ? <div className="ux08-documents-empty"><ShieldCheck /><strong>עוד לא הועלה מסמך</strong><span>העלו תעודה אחת לפחות כדי להשלים את שער המועמדות.</span></div> : null}</div>
    {message ? <p className={message.includes("הועלה") ? "ux08-form-message success" : "ux08-form-message danger"} role="status">{message}</p> : null}
  </section>;
}
