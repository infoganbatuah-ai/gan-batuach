"use client";

import { useState, type FormEvent } from "react";

type Lead = Record<string, any> | null;
type Garden = { id: string; name: string; city?: string | null };
type Inspector = { id: string; full_name?: string | null };
type Credentials = { username: string; email: string; temporary_password: string };

type Result = { title: string; credentials?: Credentials; owner?: Credentials | null } | null;

function formValue(form: HTMLFormElement, key: string) { return String(new FormData(form).get(key) ?? "").trim(); }
function formValues(form: HTMLFormElement, key: string) { return new FormData(form).getAll(key).map((item) => String(item).trim()).filter(Boolean); }
async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) {
    const field = body.details?.field;
    const friendly =
      field === "manager_email" ? "המייל של מנהלת הגן כבר קיים" :
      field === "owner_email" ? "המייל של בעל הגן כבר קיים" :
      field === "inspector_email" ? "המייל של המפקח כבר קיים" :
      body.error || "הפעולה נכשלה";
    const error = new Error(friendly) as Error & { field?: string };
    error.field = field;
    throw error;
  }
  return body.data;
}
function Copy({ credentials }: { credentials: Credentials }) {
  const text = "Username: " + credentials.username + "\nPassword: " + credentials.temporary_password;
  return <button className="button secondary" type="button" onClick={() => navigator.clipboard?.writeText(text)}>העתקת פרטים</button>;
}
function ResultBox({ result }: { result: Result }) {
  if (!result) return null;
  return <div className="success-screen"><strong>{result.title}</strong>{result.credentials ? <div className="credential-box" dir="ltr"><span>Username: {result.credentials.username}</span><span>Password: {result.credentials.temporary_password}</span><Copy credentials={result.credentials} /></div> : null}{result.owner ? <div className="credential-box" dir="ltr"><span>Owner: {result.owner.username}</span><span>Password: {result.owner.temporary_password}</span><Copy credentials={result.owner} /></div> : null}<small>פרטי הכניסה מוצגים פעם אחת בלבד.</small></div>;
}

export function KindergartenCreationWizard({ lead, inspectors }: { lead?: Lead; inspectors: Inspector[] }) {
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setResult(null);
    const form = event.currentTarget;
    try {
      const data = await postJson("/api/admin/create-garden-manager", {
        source_lead_id: lead?.id,
        garden: {
          name: formValue(form, "name"), city: formValue(form, "city"), address: formValue(form, "address"), framework_type: formValue(form, "mixed_age") === "yes" ? "mixed" : "custom",
          ages: formValues(form, "age_groups"), children_capacity: Number(formValue(form, "capacity") || 0), current_children_count: Number(formValue(form, "current_children_count") || 0), staff_count: Number(formValue(form, "staff_count") || 0),
          owner_name: formValue(form, "owner_name"), phone: formValue(form, "owner_phone"), email: formValue(form, "manager_email") || formValue(form, "owner_email") || undefined,
          inspector_id: formValue(form, "assigned_inspector") || undefined, ownership_type: formValue(form, "owner_email") ? "separate_owner" : "teacher_only", owner_role_label: formValue(form, "owner_email") ? "בעלים נפרד" : "מנהלת/גננת", public_profile_enabled: formValue(form, "public_profile_enabled") === "yes", notes: formValue(form, "notes")
        },
        manager: { full_name: formValue(form, "manager_name"), email: formValue(form, "manager_email") || undefined, phone: formValue(form, "manager_phone") },
        owner: formValue(form, "owner_email") ? { full_name: formValue(form, "owner_name"), email: formValue(form, "owner_email"), phone: formValue(form, "owner_phone") } : undefined
      });
      setResult({ title: "הגן נוצר בהצלחה", credentials: data.credentials.manager, owner: data.credentials.owner });
    } catch (err) { setError(err instanceof Error ? err.message : "יצירת גן נכשלה"); }
  }
  return <form className="card form wizard-form" onSubmit={submit}><ResultBox result={result} />{error ? <div className="error-banner">{error}</div> : null}<h2>הוספת גן ילדים</h2><p>השלימו את כל שדות החובה. רק לאחר אישור סופי ייווצרו משתמשי Auth ופרטי כניסה.</p><div className="form-grid"><label>שם גן *<input name="name" required defaultValue={lead?.garden_name ?? ""} /></label><label>תמונה<input name="image" placeholder="URL לתמונה" /></label><label>עיר *<input name="city" required defaultValue={lead?.city ?? ""} /></label><label className="wide">כתובת מלאה *<input name="address" required defaultValue={lead?.address ?? ""} /></label><label>GPS lat<input name="gps_lat" /></label><label>GPS lng<input name="gps_lng" /></label><label>שם בעלים *<input name="owner_name" required defaultValue={lead?.owner_name ?? ""} /></label><label>טלפון בעלים<input name="owner_phone" defaultValue={lead?.phone ?? ""} /></label><label>אימייל בעלים<input name="owner_email" type="email" /></label><label>שם מנהלת/גננת *<input name="manager_name" required defaultValue={lead?.manager_name ?? lead?.owner_name ?? ""} /></label><label>טלפון מנהלת<input name="manager_phone" defaultValue={lead?.phone ?? ""} /></label><label>אימייל מנהלת<input name="manager_email" type="email" defaultValue={lead?.email ?? ""} /></label><label>גילאים<input name="age_groups" defaultValue={Array.isArray(lead?.age_groups) ? lead.age_groups.join(", ") : ""} /></label><label>קבוצה מעורבת<select name="mixed_age"><option value="yes">כן</option><option value="no">לא</option></select></label><label>טווח גיל מותאם<input name="custom_age_range" /></label><label>קיבולת<input name="capacity" type="number" defaultValue={lead?.capacity ?? lead?.children_count ?? 0} /></label><label>ילדים כיום<input name="current_children_count" type="number" defaultValue={lead?.children_count ?? 0} /></label><label>מספר צוות<input name="staff_count" type="number" defaultValue={lead?.staff_count ?? 0} /></label><label>פקח משויך<select name="assigned_inspector"><option value="">ללא שיוך</option>{inspectors.map((inspector) => <option key={inspector.id} value={inspector.id}>{inspector.full_name ?? inspector.id}</option>)}</select></label><label>מצלמות קיימות<select name="camera_system"><option value="no">לא</option><option value="yes">כן</option></select></label><label>פרופיל ציבורי<select name="public_profile_enabled"><option value="yes">כן</option><option value="no">לא</option></select></label><label className="wide">הערות<textarea name="notes" rows={3} defaultValue={lead?.notes ?? ""} /></label></div><button className="button primary large">יצירת גן ומשתמשים</button></form>;
}

export function InspectorCreationWizard({ lead, gardens }: { lead?: Lead; gardens: Garden[] }) {
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setResult(null);
    const form = event.currentTarget;
    try {
      const data = await postJson("/api/admin/create-inspector", { source_lead_id: lead?.id, full_name: formValue(form, "full_name"), phone: formValue(form, "phone"), email: formValue(form, "email") || undefined, service_cities: formValue(form, "service_cities").split(",").map((x) => x.trim()).filter(Boolean), certification_notes: [formValue(form, "certifications"), formValue(form, "experience"), formValue(form, "notes")].filter(Boolean).join("\n"), garden_ids: formValues(form, "garden_ids") });
      setResult({ title: "הפקח נוצר בהצלחה", credentials: data.credentials });
    } catch (err) { setError(err instanceof Error ? err.message : "יצירת פקח נכשלה"); }
  }
  return <form className="card form wizard-form" onSubmit={submit}><ResultBox result={result} />{error ? <div className="error-banner">{error}</div> : null}<h2>הוספת מפקח</h2><p>יצירת משתמש פקח, פרופיל, שיוך ערים וגנים אופציונלי.</p><div className="form-grid"><label>שם מלא *<input name="full_name" required defaultValue={lead?.parent_name ?? ""} /></label><label>טלפון<input name="phone" defaultValue={lead?.phone ?? ""} /></label><label>אימייל<input name="email" type="email" defaultValue={lead?.email ?? ""} /></label><label className="wide">עיר/אזורים *<input name="service_cities" required defaultValue={lead?.city ?? ""} placeholder="תל אביב, רמת גן" /></label><label className="wide">הסמכות<textarea name="certifications" rows={3} defaultValue={lead?.certifications ?? ""} /></label><label className="wide">ניסיון<textarea name="experience" rows={3} defaultValue={lead?.experience ?? ""} /></label><label className="wide">גנים משויכים<select name="garden_ids" multiple>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name} · {garden.city}</option>)}</select></label><label className="wide">הערות<textarea name="notes" rows={3} defaultValue={lead?.notes ?? ""} /></label></div><button className="button primary large">יצירת פקח</button></form>;
}
