"use client";

import { useState, useTransition } from "react";
import { FileUp } from "lucide-react";
import { uploadManagementDocument } from "@/lib/client-upload";

type DocumentRow = {
  id: string;
  name?: string | null;
  document_type?: string | null;
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  file_url?: string | null;
};

export function StaffDocumentUpload({ gardenId, staffId, documents }: { gardenId?: string | null; staffId?: string | null; documents: DocumentRow[] }) {
  const [rows, setRows] = useState(documents);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function submit(formData: FormData) {
    setMessage("");
    if (!gardenId || !staffId) {
      setMessage("לא נמצא שיוך צוות וגן להעלאת מסמך.");
      return;
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setMessage("יש לבחור קובץ להעלאה.");
      return;
    }
    let created: DocumentRow;
    try {
      created = await uploadManagementDocument(file, {
        garden_id: gardenId, owner_id: staffId,
        name: String(formData.get("name") || file.name || "מסמך צוות"),
        document_type: String(formData.get("document_type") || "staff_document"),
        expires_at: String(formData.get("expires_at") || "")
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "העלאת המסמך נכשלה.");
      return;
    }

    startTransition(() => {
      setRows((current) => [created, ...current]);
      setMessage("המסמך הועלה ונשלח לבדיקה.");
    });
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      <form className="card form wizard-form" action={submit}>
        <div className="section-heading">
          <h2><FileUp size={20} /> העלאת מסמך</h2>
          <p>העלו PDF או תמונה. המסמך ימתין לבדיקה, ופתיחתו תבדוק הרשאה מחדש.</p>
        </div>
        {message ? <div className={message.includes("הועלה") ? "success-banner" : "error-banner"}>{message}</div> : null}
        <div className="form-grid">
          <label>שם המסמך<input name="name" required placeholder="לדוגמה: תעודת עזרה ראשונה" /></label>
          <label>סוג מסמך<select name="document_type"><option value="first_aid">עזרה ראשונה</option><option value="police_clearance">תעודת יושר</option><option value="background_check">בדיקת רקע</option><option value="training">הכשרה</option><option value="staff_document">מסמך צוות אחר</option></select></label>
          <label>תוקף עד<input name="expires_at" type="date" /></label>
          <label className="wide">קובץ<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required /></label>
        </div>
        <button className="button primary large" disabled={isPending}>{isPending ? "שומר..." : "העלאת מסמך"}</button>
      </form>

      <article className="card action-panel">
        <div className="section-heading"><h2>המסמכים שלי</h2><p>סטטוס בדיקה ותוקף מסמכים.</p></div>
        {rows.length === 0 ? <div className="empty-state"><strong>אין מסמכים להצגה</strong><span>העלו מסמך ראשון כדי שהמנהלת תוכל לבדוק ולאשר אותו.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={row.status === "approved" || row.status === "valid" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status ?? "pending"}</span><h3>{row.name ?? "מסמך צוות"}</h3><p>{row.document_type ?? "מסמך"}</p><small>{row.expires_at ? `תוקף עד ${new Date(row.expires_at).toLocaleDateString("he-IL")}` : row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}</small></div><small className="gateway-setup-state">הקובץ נשמר במערכת ויוצג רק דרך הרשאה מאובטחת.</small></article>)}</div>}
      </article>
    </section>
  );
}
