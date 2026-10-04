"use client";

import { useState, type FormEvent } from "react";
import { BriefcaseBusiness, CalendarDays, Check, MapPin, PauseCircle, Save, Sparkles, UsersRound } from "lucide-react";
import { recruitmentBlockerLabel } from "@/lib/domain/recruitment-display";

type Candidate = { city?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; availability?: { days?: string[]; notes?: string } | null; preferred_age_groups?: string[] | null; employment_preference?: string | null; professional_summary?: string | null; matching_paused?: boolean };
const qualifications = [["early_childhood", "חינוך לגיל הרך"], ["teacher_certificate", "תעודת הוראה"], ["caregiver_training", "הכשרת מטפלות"], ["first_aid", "עזרה ראשונה"]] as const;
const knownQualifications = new Set(qualifications.map(([value]) => value));
const weekdays = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳"];

export function StaffCandidateProfileForm({ candidate, completeness }: { candidate?: Candidate | null; completeness?: { percentage?: number; blockers?: string[]; status?: string } | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const list = (name: string) => data.getAll(name).flatMap((value) => String(value).split(",")).map((value) => value.trim()).filter(Boolean);
    const response = await fetch("/api/staff/candidate-profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: data.get("city"), professional_role: data.get("professional_role"), qualification_keys: list("qualification_keys"), availability: { days: list("availability_days"), notes: String(data.get("availability_notes") ?? "") || undefined }, preferred_age_groups: list("preferred_age_groups"), employment_preference: String(data.get("employment_preference") ?? "") || undefined, professional_summary: String(data.get("professional_summary") ?? "") || undefined, matching_paused: data.get("matching_paused") === "on" }) });
    const body = await response.json().catch(() => ({})); setBusy(false); setMessage(response.ok ? "הפרופיל המקצועי נשמר. ההתאמות עודכנו." : body.error ?? "השמירה נכשלה.");
    if (response.ok) window.location.reload();
  }
  return <form className="ux08-profile-form" onSubmit={submit}>
    <header><span><Sparkles /></span><div><small>פרופיל מקצועי</small><h2>הכישורים וההעדפות שלך</h2><p>המידע משמש לגיוס בלבד ואינו פותח גישה לגן.</p></div></header>
    {completeness?.blockers?.length ? <div className="ux08-form-alert"><strong>כדי להשלים את הפרופיל:</strong>{completeness.blockers.map((item) => <span key={item}>{recruitmentBlockerLabel(item)}</span>)}</div> : <div className="ux08-form-ready"><Check /> הפרופיל המקצועי מוכן להגשה</div>}
    <div className="ux08-form-grid">
      <label><span><MapPin /> עיר</span><input name="city" required defaultValue={candidate?.city ?? ""} placeholder="למשל: תל אביב" /></label>
      <label><span><BriefcaseBusiness /> תפקיד מבוקש</span><select name="professional_role" required defaultValue={candidate?.professional_role ?? ""}><option value="">בחירת תפקיד</option><option value="גננת">גננת</option><option value="סייעת">סייעת</option><option value="מטפלת">מטפלת</option><option value="מנהלת כיתה">מנהלת כיתה</option></select></label>
      <label><span><UsersRound /> היקף משרה</span><select name="employment_preference" defaultValue={candidate?.employment_preference ?? ""}><option value="">ללא העדפה</option><option value="משרה מלאה">משרה מלאה</option><option value="משרה חלקית">משרה חלקית</option><option value="גמיש">גמיש</option></select></label>
      <label><span><UsersRound /> קבוצות גיל מועדפות</span><input name="preferred_age_groups" defaultValue={(candidate?.preferred_age_groups ?? []).join(", ")} placeholder="פעוטות, בוגרים" /></label>
    </div>
    <fieldset className="ux08-choice-field"><legend>הסמכות והכשרות</legend><div>{qualifications.map(([value, label]) => <label key={value}><input type="checkbox" name="qualification_keys" value={value} defaultChecked={(candidate?.qualification_keys ?? []).includes(value)} /><span><Check /> {label}</span></label>)}</div>{(candidate?.qualification_keys ?? []).filter((value) => !knownQualifications.has(value as never)).map((value) => <input key={value} type="hidden" name="qualification_keys" value={value} />)}</fieldset>
    <fieldset className="ux08-choice-field"><legend><CalendarDays /> ימי זמינות</legend><div>{weekdays.map((day) => <label key={day}><input type="checkbox" name="availability_days" value={day} defaultChecked={(candidate?.availability?.days ?? []).includes(day)} /><span>{day}</span></label>)}</div></fieldset>
    <label className="ux08-wide-field">ניסיון ותקציר מקצועי<textarea name="professional_summary" defaultValue={candidate?.professional_summary ?? ""} rows={4} placeholder="ספרו בקצרה על הניסיון, הגישה החינוכית והחוזקות המקצועיות שלכם" /></label>
    <label className="ux08-wide-field">הערות לזמינות<textarea name="availability_notes" defaultValue={candidate?.availability?.notes ?? ""} rows={2} placeholder="שעות מועדפות או מידע שימושי למנהלת" /></label>
    <label className="ux08-pause-toggle"><input type="checkbox" name="matching_paused" defaultChecked={candidate?.matching_paused} /><PauseCircle /><span><b>השהיית התאמות</b><small>הפרופיל נשמר, אך לא יוצגו התאמות חדשות</small></span></label>
    <button className="button primary large" disabled={busy} type="submit"><Save /> {busy ? "שומרת..." : "שמירת הפרופיל המקצועי"}</button>
    {message ? <p role="status" className={message.includes("נשמר") ? "ux08-form-message success" : "ux08-form-message danger"}>{message}</p> : null}
  </form>;
}
