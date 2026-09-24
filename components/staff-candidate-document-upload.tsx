"use client";

import { useEffect, useState, type FormEvent } from "react";

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

  return <section className="card form" aria-label="מסמך הסמכה למועמדות">
    <h2>מסמך הסמכה למועמדות</h2>
    <p>העלאת מסמך פותחת את שלב המועמדות; היא אינה מאמתת הסמכה או מעניקה גישה לגן.</p>
    <form onSubmit={upload}>
      <label>קובץ הסמכה פרטי (PDF או תמונה, עד 12MB)
        <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required />
      </label>
      <button className="button primary" type="submit" disabled={busy}>{busy ? "מעלה..." : "העלאת מסמך"}</button>
    </form>
    {documents.length ? <ul>{documents.map((document) => <li key={document.id}>
      <a href={`/api/staff/candidate-documents/${document.id}/file`} target="_blank" rel="noreferrer">מסמך הסמכה</a>
      {" · "}{document.status === "verified" ? "אומת" : document.status === "rejected" ? "נדחה" : "הועלה, ממתין לבדיקה"}
    </li>)}</ul> : <p>טרם הועלה מסמך הסמכה.</p>}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
