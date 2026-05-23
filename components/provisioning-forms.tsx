"use client";

import { useState, type FormEvent } from "react";

type Credentials = { username: string; email: string; temporary_password: string };
type ResultState = { title: string; message: string; credentials?: Credentials };
type PendingChild = { id: string; full_name: string; status: string; created_at?: string };
type PendingLead = { id: string; parent_name?: string; phone?: string; email?: string; child_name?: string; child_age?: string; status?: string };
type PendingStaff = { id: string; full_name: string; role_title?: string; background_check_status?: string; police_clearance_status?: string; approved_to_work?: boolean };

function jsonFromForm(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "הפעולה נכשלה");
  return body.data;
}

function CredentialSuccess({ result }: { result: ResultState | null }) {
  if (!result) return null;
  return (
    <div className="success-screen">
      <strong>{result.title}</strong>
      <p>{result.message}</p>
      {result.credentials ? (
        <div className="credential-box" dir="ltr">
          <span>Username: {result.credentials.username}</span>
          <span>Password: {result.credentials.temporary_password}</span>
        </div>
      ) : null}
      <small>פרטי הכניסה מוצגים כאן פעם אחת בלבד. הסיסמה אינה נשמרת בטבלאות המערכת.</small>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  return error ? <div className="error-banner">{error}</div> : null;
}

export function AdminProvisioningPanel() {
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitGardenManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = jsonFromForm(event.currentTarget);
      const response = await postJson("/api/admin/create-garden-manager", {
        garden: {
          name: String(data.garden_name), city: String(data.city), address: String(data.address || ""),
          framework_type: String(data.framework_type || "mixed"), children_capacity: Number(data.children_capacity || 0),
          owner_name: String(data.owner_name), phone: String(data.garden_phone || ""), email: String(data.garden_email)
        },
        manager: { full_name: String(data.manager_full_name), email: String(data.manager_email), phone: String(data.manager_phone || "") }
      });
      setResult({ title: "הגן ומנהלת הגן נוצרו", message: "נוצרו משתמש Supabase Auth, פרופיל מנהלת ורשומת גן פעילה.", credentials: response.credentials });
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    } finally { setBusy(false); }
  }

  async function submitInspector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = jsonFromForm(event.currentTarget);
      const response = await postJson("/api/admin/create-inspector", {
        full_name: String(data.full_name), email: String(data.email), phone: String(data.phone || ""),
        service_cities: String(data.service_cities).split(",").map((city) => city.trim()).filter(Boolean),
        certification_notes: String(data.certification_notes || "")
      });
      setResult({ title: "הפקח נוצר בהצלחה", message: "נוצרו משתמש Supabase Auth, פרופיל פקח ושיוך ערים.", credentials: response.credentials });
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    } finally { setBusy(false); }
  }

  return (
    <div className="onboarding-console">
      <CredentialSuccess result={result} />
      <ErrorBox error={error} />
      <section className="grid cols-2 dashboard-panels">
        <form className="card form wizard-form" onSubmit={submitGardenManager}>
          <h2>פתיחת גן ומנהלת</h2><p>המערכת יוצרת גן פעיל, משתמש Auth למנהלת, פרופיל עם הרשאת מנהלת ולוג ביקורת.</p>
          <div className="form-grid"><label>שם הגן<input name="garden_name" required /></label><label>עיר<input name="city" required /></label><label>כתובת<input name="address" /></label><label>סוג מסגרת<select name="framework_type"><option value="mixed">מעורב</option><option value="birth_to_3">לידה עד 3</option><option value="3_to_6">3 עד 6</option></select></label><label>קיבולת ילדים<input name="children_capacity" type="number" min="0" /></label><label>שם בעלים<input name="owner_name" required /></label><label>טלפון גן<input name="garden_phone" /></label><label>מייל גן<input name="garden_email" type="email" required /></label><label>שם מנהלת<input name="manager_full_name" required /></label><label>טלפון מנהלת<input name="manager_phone" /></label><label className="wide">מייל מנהלת<input name="manager_email" type="email" required /></label></div>
          <button className="button primary large" disabled={busy}>יצירת גן ומשתמש מנהלת</button>
        </form>
        <form className="card form wizard-form" onSubmit={submitInspector}>
          <h2>יצירת פקח</h2><p>הפקח נוצר ב־Auth וב־profiles, ומקבל רשימת ערים לפיקוח.</p>
          <div className="form-grid"><label>שם מלא<input name="full_name" required /></label><label>מייל<input name="email" type="email" required /></label><label>טלפון<input name="phone" /></label><label className="wide">ערים באחריות<input name="service_cities" required placeholder="תל אביב, רמת גן, חולון" /></label><label className="wide">הערות הסמכה<textarea name="certification_notes" rows={3} /></label></div>
          <button className="button primary large" disabled={busy}>יצירת משתמש פקח</button>
        </form>
      </section>
    </div>
  );
}

export function GardenProvisioningPanel({ pendingChildren, parentLeads, pendingStaff }: { pendingChildren: PendingChild[]; parentLeads: PendingLead[]; pendingStaff: PendingStaff[] }) {
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const data = jsonFromForm(event.currentTarget);
      const response = await postJson("/api/garden/create-parent", { full_name: String(data.full_name), email: String(data.email), phone: String(data.phone || ""), identity_number: String(data.identity_number || ""), address: String(data.address || ""), lead_id: String(data.lead_id || "") || undefined });
      setResult({ title: "הורה נוצר בהצלחה", message: "ההורה יכול להתחבר ומיד למלא את אשף רישום הילד.", credentials: response.credentials });
      event.currentTarget.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "הפעולה נכשלה"); } finally { setBusy(false); }
  }

  async function submitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const data = jsonFromForm(event.currentTarget);
      const response = await postJson("/api/garden/create-staff", { full_name: String(data.full_name), email: String(data.email), phone: String(data.phone || ""), role_title: String(data.role_title), identity_number: String(data.identity_number || ""), address: String(data.address || ""), class_group: String(data.class_group || ""), start_date: String(data.start_date || ""), notes: String(data.notes || "") });
      setResult({ title: "איש צוות נוצר", message: "המשתמש נוצר, אך לא יאושר לעבודה עד שמסמכי החובה יהיו תקפים.", credentials: response.credentials });
      event.currentTarget.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "הפעולה נכשלה"); } finally { setBusy(false); }
  }

  async function approveChild(childId: string) {
    setBusy(true); setError(null);
    try { await postJson("/api/garden/children/" + childId + "/approve", {}); setResult({ title: "הילד אושר", message: "כרטיס התלמיד הפך לפעיל ברשימת ילדי הגן." }); }
    catch (err) { setError(err instanceof Error ? err.message : "האישור נכשל"); } finally { setBusy(false); }
  }

  async function approveStaff(staffId: string) {
    setBusy(true); setError(null);
    try { await postJson("/api/garden/staff/" + staffId + "/approve", {}); setResult({ title: "איש הצוות אושר", message: "העובד סומן כמאושר לעבודה לאחר בדיקת מסמכי חובה." }); }
    catch (err) { setError(err instanceof Error ? err.message : "האישור נכשל"); } finally { setBusy(false); }
  }

  return (
    <div className="onboarding-console">
      <CredentialSuccess result={result} /><ErrorBox error={error} />
      <section className="grid cols-2 dashboard-panels">
        <form className="card form wizard-form" onSubmit={submitParent}>
          <h2>יצירת הורה</h2><p>לאחר היצירה ההורה יתחבר ויועבר לאשף רישום הילד.</p>
          <div className="form-grid"><label>שם מלא<input name="full_name" required /></label><label>מייל<input name="email" type="email" required /></label><label>טלפון<input name="phone" required /></label><label>תעודת זהות<input name="identity_number" /></label><label className="wide">כתובת<input name="address" /></label><label className="wide">חיבור לליד קיים<select name="lead_id"><option value="">ללא ליד</option>{parentLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.parent_name ?? "הורה"} · {lead.phone ?? ""}</option>)}</select></label></div>
          <button className="button primary large" disabled={busy}>יצירת משתמש הורה</button>
        </form>
        <form className="card form wizard-form" onSubmit={submitStaff}>
          <h2>יצירת צוות</h2><p>המשתמש יישאר בתהליך אישור עד תעודת יושר ובדיקת רקע תקפות.</p>
          <div className="form-grid"><label>שם מלא<input name="full_name" required /></label><label>תפקיד<input name="role_title" required placeholder="סייעת / מובילת כיתה" /></label><label>מייל<input name="email" type="email" required /></label><label>טלפון<input name="phone" /></label><label>תעודת זהות<input name="identity_number" /></label><label>כיתה<input name="class_group" /></label><label>תאריך התחלה<input name="start_date" type="date" /></label><label className="wide">הערות<textarea name="notes" rows={3} /></label></div>
          <button className="button primary large" disabled={busy}>יצירת משתמש צוות</button>
        </form>
      </section>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>אישורי ילדים</h2><p>רק לאחר אישור מנהלת הילד נכנס לרשימת התלמידים הפעילים.</p></div>{pendingChildren.length === 0 ? <div className="empty-mini">אין ילדים שממתינים לאישור.</div> : pendingChildren.map((child) => <div className="list-item" key={child.id}><div><strong>{child.full_name}</strong><span>{child.status}</span></div><button className="button secondary" disabled={busy} onClick={() => approveChild(child.id)}>אישור ילד</button></div>)}</article>
        <article className="card action-panel"><div className="section-heading"><h2>אישור צוות</h2><p>האישור יתאפשר רק כשבדיקת רקע ותעודת יושר מסומנות valid.</p></div>{pendingStaff.length === 0 ? <div className="empty-mini">אין אנשי צוות שממתינים לאישור.</div> : pendingStaff.map((staff) => <div className="list-item" key={staff.id}><div><strong>{staff.full_name}</strong><span>{staff.role_title ?? "צוות"} · רקע: {staff.background_check_status ?? "missing"} · יושר: {staff.police_clearance_status ?? "missing"}</span></div><button className="button secondary" disabled={busy} onClick={() => approveStaff(staff.id)}>אישור צוות</button></div>)}</article>
      </section>
    </div>
  );
}

export function ParentChildRegistrationWizard() {
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const data = jsonFromForm(event.currentTarget);
      await postJson("/api/parent/child-registration", { full_name: String(data.full_name), birth_date: String(data.birth_date || ""), identity_number: String(data.identity_number || ""), hmo: String(data.hmo || ""), allergies: String(data.allergies || ""), sensitivities: String(data.sensitivities || ""), regular_medications: String(data.regular_medications || ""), medical_notes: String(data.medical_notes || ""), address: String(data.address || ""), mother_name: String(data.mother_name || ""), mother_identity_number: String(data.mother_identity_number || ""), mother_phone: String(data.mother_phone || ""), father_name: String(data.father_name || ""), father_identity_number: String(data.father_identity_number || ""), father_phone: String(data.father_phone || ""), emergency_phone: String(data.emergency_phone || ""), pickup_authorized: String(data.pickup_authorized || "").split("\n").map((line) => line.trim()).filter(Boolean).map((name) => ({ name })), photo_consent: Boolean(data.photo_consent), system_consent: Boolean(data.system_consent), camera_consent: Boolean(data.camera_consent), privacy_consent: Boolean(data.privacy_consent), health_declaration: Boolean(data.health_declaration) });
      setResult({ title: "הרישום נשלח למנהלת", message: "הילד ממתין לאישור מנהלת הגן. לאחר האישור ייפתח כרטיס תלמיד פעיל." });
      event.currentTarget.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "שליחת הרישום נכשלה"); } finally { setBusy(false); }
  }

  return (
    <form className="card form wizard-form" onSubmit={submit}>
      <CredentialSuccess result={result} /><ErrorBox error={error} />
      <div className="progress-bar"><span style={{ width: "72%" }} /></div>
      <h2>פרטי ילד ובריאות</h2><p>המידע גלוי רק לגורמי הגן המורשים, לאדמין לפי הרשאה ולפקח במידת הצורך.</p>
      <div className="form-grid"><label>שם ילד מלא<input name="full_name" required /></label><label>תאריך לידה<input name="birth_date" type="date" /></label><label>תעודת זהות ילד אם קיימת<input name="identity_number" /></label><label>קופת חולים<input name="hmo" /></label><label>אלרגיות<input name="allergies" placeholder="אם אין, כתבו אין" /></label><label>רגישויות<input name="sensitivities" /></label><label>תרופות קבועות<input name="regular_medications" placeholder="שם התרופה ומינון" /></label><label>כתובת<input name="address" /></label><label className="wide">הערות רפואיות<textarea name="medical_notes" rows={3} /></label></div>
      <h3>פרטי הורים ואנשי קשר</h3>
      <div className="form-grid"><label>שם אם<input name="mother_name" /></label><label>ת.ז אם<input name="mother_identity_number" /></label><label>טלפון אם<input name="mother_phone" /></label><label>שם אב<input name="father_name" /></label><label>ת.ז אב<input name="father_identity_number" /></label><label>טלפון אב<input name="father_phone" /></label><label className="wide">טלפון חירום<input name="emergency_phone" /></label><label className="wide">מורשי איסוף<textarea name="pickup_authorized" rows={3} placeholder="כל מורשה בשורה נפרדת" /></label></div>
      <h3>הסכמות חובה</h3>
      <div className="consent-grid"><label><input name="system_consent" type="checkbox" required /> אישור שימוש במערכת</label><label><input name="privacy_consent" type="checkbox" required /> הסכמת פרטיות</label><label><input name="health_declaration" type="checkbox" required /> הצהרת בריאות</label><label><input name="photo_consent" type="checkbox" /> אישור צילום</label><label><input name="camera_consent" type="checkbox" /> אישור צפייה במצלמות אם רלוונטי</label></div>
      <button className="button primary large" disabled={busy}>שליחה לאישור מנהלת הגן</button>
    </form>
  );
}
