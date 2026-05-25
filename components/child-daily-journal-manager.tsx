"use client";

import { useMemo, useState, useTransition } from "react";
import { Camera, CheckCircle2, Moon, Smile, Utensils } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { uploadFiles } from "@/lib/client-upload";

type Child = { id: string; full_name: string; photo_url?: string | null; allergies?: string | null; regular_medications?: string | null };
type Journal = Record<string, any>;

export function ChildDailyJournalManager({ gardenId, children, journals }: { gardenId: string; children: Child[]; journals: Journal[] }) {
  const [selectedChildId, setSelectedChildId] = useState(children[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const latestByChild = useMemo(() => new Map(journals.map((journal) => [journal.child_id, journal])), [journals]);
  const selectedChild = children.find((child) => child.id === selectedChildId);

  async function submit(formData: FormData) {
    setMessage("");
    let uploadedPhotos: string[] = [];
    try {
      uploadedPhotos = await uploadFiles(formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0), "child-photos", "daily-journal");
    } catch (error) {
      console.error("Daily journal photo upload failed", error);
      setMessage("לא ניתן להעלות תמונות כרגע. היומן לא נשמר כדי למנוע שליחה חלקית להורים.");
      return;
    }
    const payload = {
      garden_id: gardenId,
      child_id: String(formData.get("child_id")),
      meals: [
        { title: "בוקר", note: String(formData.get("breakfast") ?? "") },
        { title: "צהריים", note: String(formData.get("lunch") ?? "") }
      ].filter((meal) => meal.note),
      sleep_summary: String(formData.get("sleep_summary") ?? ""),
      sleep_minutes: Number(formData.get("sleep_minutes") || 0),
      mood: String(formData.get("mood") ?? ""),
      bathroom: String(formData.get("bathroom") ?? ""),
      medicine: String(formData.get("medicine") ?? ""),
      incidents: String(formData.get("incidents") ?? ""),
      notes_to_parents: String(formData.get("notes_to_parents") ?? ""),
      photo_urls: uploadedPhotos,
      staff_signature: String(formData.get("staff_signature") ?? "")
    };
    startTransition(async () => {
      const response = await fetch("/api/child-daily-journals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(response.ok ? "היומן נשמר ונשלחה התראה להורה." : "לא ניתן לשמור כרגע. בדקו את השדות ונסו שוב.");
    });
  }

  return (
    <section className="grid cols-2 dashboard-panels">
      <article className="card action-panel">
        <div className="section-heading"><h2>ילדים להיום</h2><p>בחרו ילד, מלאו עדכון יומי קצר וברור ושלחו להורים.</p></div>
        {children.length === 0 ? <div className="empty-state"><strong>אין ילדים פעילים</strong><span>לאחר אישור רישום ילדים, הם יופיעו כאן ליומן יומי.</span></div> : <div className="child-card-list">{children.map((child) => {
          const latest = latestByChild.get(child.id);
          return <button className={selectedChildId === child.id ? "child-card active" : "child-card"} key={child.id} type="button" onClick={() => setSelectedChildId(child.id)}>
            <Avatar name={child.full_name} src={child.photo_url} />
            <span><strong>{child.full_name}</strong><small>{latest ? `עודכן: ${latest.mood ?? "יומן נשמר"}` : "טרם עודכן היום"}</small></span>
            {child.allergies ? <b className="pill bad">אלרגיה</b> : null}
          </button>;
        })}</div>}
      </article>

      <form action={submit} className="card form wizard-form premium-form">
        <div className="section-heading"><h2>עדכון יומי להורה</h2><p>כתבו קצר, חיובי ומדויק. הורה רואה רק את ילדו.</p></div>
        {message ? <div className={message.includes("נשמר") ? "success-banner" : "error-banner"}>{message}</div> : null}
        <input type="hidden" name="child_id" value={selectedChildId} />
        <div className="selected-child-strip"><Avatar name={selectedChild?.full_name} src={selectedChild?.photo_url} /><strong>{selectedChild?.full_name ?? "בחרו ילד"}</strong></div>
        <div className="form-grid">
          <label><Utensils size={16} /> ארוחת בוקר<input name="breakfast" placeholder="אכל/ה יפה / מעט / לא רצה" /></label>
          <label><Utensils size={16} /> ארוחת צהריים<input name="lunch" placeholder="לדוגמה: פסטה וירקות" /></label>
          <label><Moon size={16} /> שינה<input name="sleep_summary" placeholder="ישן/ה רגוע" /></label>
          <label>דקות שינה<input name="sleep_minutes" type="number" min="0" /></label>
          <label><Smile size={16} /> מצב רוח<select name="mood"><option>רגוע/ה</option><option>שמח/ה</option><option>עייף/ה</option><option>רגיש/ה</option><option>צריך תשומת לב</option></select></label>
          <label>שירותים / החתלה<input name="bathroom" placeholder="תקין / נדרש מעקב" /></label>
          <label>תרופה שניתנה<input name="medicine" placeholder="רק אם יש אישור הורה" /></label>
          <label>אירועים חריגים<input name="incidents" placeholder="ללא / פירוט קצר" /></label>
          <label className="wide">הערה להורים<textarea name="notes_to_parents" rows={4} placeholder="משהו טוב מהיום, בקשה למחר או עדכון חשוב" /></label>
          <label className="wide"><Camera size={16} /> תמונות יומיות<input name="photos" type="file" accept="image/*" multiple /></label>
          <label className="wide">חתימת איש צוות<input name="staff_signature" placeholder="שם מלא של איש/ת הצוות" required /></label>
        </div>
        <button className="button primary large" disabled={isPending || !selectedChildId}>{isPending ? "שומר..." : <><CheckCircle2 size={18} /> שמירת עדכון יומי</>}</button>
      </form>
    </section>
  );
}
