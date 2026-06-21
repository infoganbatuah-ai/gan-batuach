"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FileUp, Save } from "lucide-react";
import { uploadFiles } from "@/lib/client-upload";

type DocumentRow = {
  id: string;
  name?: string | null;
  document_type?: string | null;
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  file_url?: string | null;
};

export function GardenDocumentUploadPanel({
  gardenId,
  documents,
  defaultOpen = false
}: {
  gardenId: string;
  documents: DocumentRow[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState(documents);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    setMessage("");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("יש לבחור קובץ להעלאה.");
      return;
    }

    let uploaded: string[] = [];
    try {
      uploaded = await uploadFiles([file], "documents", "garden-documents");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "העלאת המסמך נכשלה.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden_id: gardenId,
          name: String(formData.get("name") || file.name || "מסמך גן"),
          document_type: String(formData.get("document_type") || "garden_document"),
          expires_at: String(formData.get("expires_at") || "") || undefined,
          file_url: uploaded[0]
        })
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) {
        setRows((current) => [body.data, ...current]);
        setMessage("המסמך הועלה ונשלח לבדיקה.");
        form.reset();
      } else {
        setMessage(body?.error || "לא ניתן לשמור את המסמך כרגע.");
      }
    });
  }

  return (
    <section className="ganenet-module-panel garden-inline-action-panel" id="document-upload">
      <div className="ganenet-module-title-card">
        <h2><FileUp size={24} /> העלאת מסמך לגן</h2>
        <p>העלאת PDF, תמונה או מסמך Word. הקישור שנוצר קצר-טווח ומוגן לפי ההרשאות הקיימות.</p>
        <button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "סגירת העלאה" : "פתיחת העלאה"}
        </button>
      </div>

      {message ? <div className={message.includes("הועלה") ? "success-banner" : "error-banner"}>{message}</div> : null}

      {open ? (
        <form className="ganenet-form-grid" onSubmit={submit}>
          <label>שם המסמך<input name="name" required placeholder="לדוגמה: אישור בטיחות שנתי" /></label>
          <label>סוג מסמך<select name="document_type" defaultValue="garden_document"><option value="garden_document">מסמך גן כללי</option><option value="safety_certificate">אישור בטיחות</option><option value="health_certificate">אישור תברואה</option><option value="insurance">ביטוח</option><option value="camera_approval">אישור מצלמות</option><option value="regulatory">מסמך רגולטורי</option></select></label>
          <label>תוקף עד<input name="expires_at" type="date" /></label>
          <label className="wide">קובץ<input name="file" type="file" accept="image/*,.pdf,.doc,.docx" required /></label>
          <button className="button primary wide" disabled={isPending} type="submit"><Save size={18} /> {isPending ? "מעלה..." : "שמירת מסמך"}</button>
        </form>
      ) : null}

      {rows.length ? (
        <div className="ganenet-module-list">
          {rows.slice(0, 4).map((row) => (
            <article className="ganenet-module-row" key={row.id}>
              <span className="ganenet-module-avatar purple"><FileUp size={24} /></span>
              <div>
                <b>{row.name ?? "מסמך גן"}</b>
                <small>{row.document_type ?? "מסמך"} · {row.expires_at ? `תוקף עד ${new Date(row.expires_at).toLocaleDateString("he-IL")}` : "ללא תאריך תוקף"}</small>
              </div>
              <em>{row.status ?? "pending_review"}</em>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
