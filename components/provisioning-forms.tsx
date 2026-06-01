"use client";

import { useState, type FormEvent } from "react";

type Credentials = { username: string; email: string; temporary_password: string };
type ResultState = { title: string; message: string; credentials?: Credentials };
type PendingChild = { id: string; full_name: string; status: string; created_at?: string };
type PendingLead = { id: string; parent_name?: string; phone?: string; email?: string; child_name?: string; child_age?: string; status?: string };
type PendingStaff = { id: string; full_name: string; role_title?: string; background_check_status?: string; police_clearance_status?: string; approved_to_work?: boolean };
type ParentWizardChild = {
  id?: string;
  full_name?: string | null;
  birth_date?: string | null;
  identity_number?: string | null;
  photo_url?: string | null;
  face_image_url?: string | null;
  child_age?: string | null;
  requested_age_group?: string | null;
  requested_start_date?: string | null;
  lead_parent_name?: string | null;
  lead_parent_phone?: string | null;
  parent_photo_url?: string | null;
  mother_photo_url?: string | null;
  father_photo_url?: string | null;
  important_notes?: string | null;
  likes_notes?: string | null;
  dislikes_notes?: string | null;
  age_group?: string | null;
  classroom?: string | null;
  hmo?: string | null;
  allergies?: string | null;
  sensitivities?: string | null;
  regular_medications?: string | null;
  medical_notes?: string | null;
  address?: string | null;
  mother_name?: string | null;
  mother_identity_number?: string | null;
  mother_phone?: string | null;
  father_name?: string | null;
  father_identity_number?: string | null;
  father_phone?: string | null;
  emergency_phone?: string | null;
  pickup_authorized?: unknown;
  photo_consent?: boolean | null;
  system_consent?: boolean | null;
  additional_consents?: any;
  status?: string | null;
};
type AgeGroupOption = { id?: string; label: string; age_range?: string | null; monthly_fee?: number | null; source?: string };

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
  const copyText = result.credentials ? "Username: " + result.credentials.username + "\nPassword: " + result.credentials.temporary_password : "";
  return (
    <div className="success-screen">
      <strong>{result.title}</strong>
      <p>{result.message}</p>
      {result.credentials ? (
        <div className="credential-box" dir="ltr">
          <span>Username: {result.credentials.username}</span>
          <span>Password: {result.credentials.temporary_password}</span>
          <button className="button secondary" type="button" onClick={() => navigator.clipboard?.writeText(copyText)}>העתקת פרטי כניסה</button>
        </div>
      ) : null}
      <small>פרטי הכניסה נשמרים למנהלת עד שהמשתמש מחליף סיסמה.</small>
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  return error ? <div className="error-banner">{error}</div> : null;
}

function asPickupText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map((item: any) => [item?.name ?? item?.full_name, item?.identity_number, item?.phone, item?.photo_url].filter(Boolean).join(" | ")).filter(Boolean).join("\n");
}

function statusLabel(status?: string | null) {
  if (status === "active" || status === "approved") return "אושר";
  if (status === "pending_manager_approval") return "ממתין לאישור הגן";
  if (status === "pending_parent_completion") return "חסרים פרטים";
  if (status === "request_missing_details" || status === "missing_info") return "חסרים פרטים";
  return "טיוטה";
}

function completeText(done: boolean) {
  return done ? "✓ שלב הושלם" : "חסר רק עוד קצת מידע";
}

export function AdminProvisioningPanel() {
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitGardenManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const data = jsonFromForm(form);
      const response = await postJson("/api/admin/create-garden-manager", {
        garden: {
          name: String(data.garden_name), city: String(data.city), address: String(data.address || ""),
          framework_type: String(data.framework_type || "mixed"), children_capacity: Number(data.children_capacity || 0),
          owner_name: String(data.owner_name), phone: String(data.garden_phone || ""), email: String(data.garden_email || "") || undefined
        },
        manager: { full_name: String(data.manager_full_name), email: String(data.manager_email || "") || undefined, phone: String(data.manager_phone || "") },
        owner: data.owner_email ? { full_name: String(data.owner_full_name || data.owner_name || data.manager_full_name), email: String(data.owner_email || "") || undefined, phone: String(data.owner_phone || "") } : undefined
      });
      setResult({ title: "הגן ומנהלת הגן נוצרו", message: response.credentials?.owner ? "נוצרו משתמשי מנהלת ובעלים, פרופילים ורשומת גן פעילה." : "נוצרו משתמש Supabase Auth, פרופיל מנהלת ורשומת גן פעילה.", credentials: response.credentials?.manager ?? response.credentials });
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    } finally { setBusy(false); }
  }

  async function submitInspector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const data = jsonFromForm(form);
      const response = await postJson("/api/admin/create-inspector", {
        full_name: String(data.full_name), email: String(data.email || "") || undefined, phone: String(data.phone || ""),
        service_cities: String(data.service_cities).split(",").map((city) => city.trim()).filter(Boolean),
        certification_notes: String(data.certification_notes || "")
      });
      setResult({ title: "הפקח נוצר בהצלחה", message: "נוצרו משתמש Supabase Auth, פרופיל פקח ושיוך ערים.", credentials: response.credentials });
      form.reset();
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
          <div className="form-grid"><label>שם הגן<input name="garden_name" required /></label><label>עיר<input name="city" required /></label><label>כתובת<input name="address" /></label><label>סוג מסגרת<select name="framework_type"><option value="mixed">מעורב</option><option value="birth_to_3">לידה עד 3</option><option value="3_to_6">3 עד 6</option></select></label><label>קיבולת ילדים<input name="children_capacity" type="number" min="0" /></label><label>שם בעלים<input name="owner_name" required /></label><label>טלפון גן<input name="garden_phone" /></label><label>מייל גן<input name="garden_email" type="email" placeholder="אם ריק, המערכת תשתמש במייל המנהלת" /></label><label>שם מנהלת<input name="manager_full_name" required /></label><label>טלפון מנהלת<input name="manager_phone" /></label><label>מייל מנהלת<input name="manager_email" type="email" placeholder="ריק = שם משתמש זמני אוטומטי" /></label><label>שם בעלים משתמש<input name="owner_full_name" /></label><label>טלפון בעלים<input name="owner_phone" /></label><label className="wide">מייל בעלים אופציונלי<input name="owner_email" type="email" /></label></div>
          <button className="button primary large" disabled={busy}>יצירת גן ומשתמש מנהלת</button>
        </form>
        <form className="card form wizard-form" onSubmit={submitInspector}>
          <h2>יצירת פקח</h2><p>הפקח נוצר ב־Auth וב־profiles, ומקבל רשימת ערים לפיקוח.</p>
          <div className="form-grid"><label>שם מלא<input name="full_name" required /></label><label>מייל<input name="email" type="email" placeholder="ריק = שם משתמש זמני אוטומטי" /></label><label>טלפון<input name="phone" /></label><label className="wide">ערים באחריות<input name="service_cities" required placeholder="תל אביב, רמת גן, חולון" /></label><label className="wide">הערות הסמכה<textarea name="certification_notes" rows={3} /></label></div>
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
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(null);
    try {
      const data = jsonFromForm(form);
      const response = await postJson("/api/garden/create-parent", { full_name: String(data.full_name), email: String(data.email), phone: String(data.phone || ""), identity_number: String(data.identity_number || ""), address: String(data.address || ""), lead_id: String(data.lead_id || "") || undefined });
      setResult({ title: "הורה נוצר בהצלחה", message: "ההורה יכול להתחבר ומיד למלא את אשף רישום הילד.", credentials: response.credentials });
      form.reset();
    } catch (err) { setError(err instanceof Error ? err.message : "הפעולה נכשלה"); } finally { setBusy(false); }
  }

  async function submitStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(null);
    try {
      const data = jsonFromForm(form);
      const response = await postJson("/api/garden/create-staff", { full_name: String(data.full_name), email: String(data.email), phone: String(data.phone || ""), role_title: String(data.role_title), identity_number: String(data.identity_number || ""), address: String(data.address || ""), class_group: String(data.class_group || ""), start_date: String(data.start_date || ""), notes: String(data.notes || "") });
      setResult({ title: "איש צוות נוצר", message: "המשתמש נוצר, אך לא יאושר לעבודה עד שמסמכי החובה יהיו תקפים.", credentials: response.credentials });
      form.reset();
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

export function ParentChildRegistrationWizard({ child, parent, garden, documents = [], ageGroups = [] }: { child?: ParentWizardChild | null; parent?: any; garden?: any; documents?: any[]; ageGroups?: AgeGroupOption[] }) {
  const [result, setResult] = useState<ResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const consents = child?.additional_consents ?? {};
  const specialNotes = consents?.special_notes ?? {};
  const requiredDocs = documents.filter((doc) => ["missing", "rejected", "expired", "requested", "required"].includes(String(doc.status ?? "").toLowerCase()));
  const documentsRequired = requiredDocs.length > 0;
  const documentsCompleted = !documentsRequired || requiredDocs.every((doc) => ["approved", "uploaded", "pending_review"].includes(String(doc.status ?? "").toLowerCase()));
  const parentPhotoComplete = Boolean(child?.parent_photo_url || child?.mother_photo_url || child?.father_photo_url);
  const completed = {
    child: Boolean(child?.full_name && child?.birth_date && (child?.photo_url || child?.face_image_url)),
    health: Boolean(child?.important_notes || child?.likes_notes || child?.dislikes_notes || child?.allergies || child?.sensitivities || child?.regular_medications || child?.medical_notes || child?.hmo),
    contacts: Boolean((child?.mother_identity_number || child?.father_identity_number) && parentPhotoComplete && (child?.mother_phone || child?.father_phone) && (Array.isArray(child?.pickup_authorized) && child?.pickup_authorized.length)),
    documents: documentsCompleted,
    notes: Boolean(specialNotes.food || specialNotes.sleep || specialNotes.behavior || specialNotes.parent_notes),
    declarations: Boolean(child?.system_consent && consents?.privacy && consents?.health_declaration)
  };
  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = Math.round((completedCount / 6) * 100);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setError(null);
    try {
      const data = jsonFromForm(form);
      await postJson("/api/parent/child-registration", {
        child_id: String(data.child_id || "") || undefined,
        full_name: String(data.full_name),
        birth_date: String(data.birth_date || ""),
        identity_number: String(data.identity_number || ""),
        photo_url: String(data.photo_url || ""),
        age_group: String(data.age_group || ""),
        hmo: String(data.hmo || ""),
        allergies: String(data.allergies || ""),
        sensitivities: String(data.sensitivities || ""),
        regular_medications: String(data.regular_medications || ""),
        medical_notes: String(data.medical_notes || ""),
        address: String(data.address || ""),
        mother_name: String(data.mother_name || ""),
        mother_identity_number: String(data.mother_identity_number || ""),
        mother_phone: String(data.mother_phone || ""),
        father_name: String(data.father_name || ""),
        father_identity_number: String(data.father_identity_number || ""),
        father_phone: String(data.father_phone || ""),
        emergency_phone: String(data.emergency_phone || ""),
        child_age: String(data.child_age || ""),
        requested_age_group: String(data.requested_age_group || ""),
        requested_start_date: String(data.requested_start_date || ""),
        parent_photo_url: String(data.parent_photo_url || ""),
        mother_photo_url: String(data.mother_photo_url || ""),
        father_photo_url: String(data.father_photo_url || ""),
        important_notes: String(data.important_notes || ""),
        likes_notes: String(data.likes_notes || ""),
        dislikes_notes: String(data.dislikes_notes || ""),
        pickup_authorized: String(data.pickup_authorized || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 3).map((line) => {
          const [name, identity_number, phone, photo_url] = line.split("|").map((part) => part.trim());
          return { name, identity_number, phone, photo_url };
        }),
        special_food_notes: String(data.special_food_notes || ""),
        sleep_notes: String(data.sleep_notes || ""),
        behavior_notes: String(data.behavior_notes || ""),
        parent_notes: String(data.parent_notes || ""),
        photo_consent: Boolean(data.photo_consent),
        system_consent: Boolean(data.system_consent),
        camera_consent: Boolean(data.camera_consent),
        privacy_consent: Boolean(data.privacy_consent),
        health_declaration: Boolean(data.health_declaration),
        parent_policy_consent: Boolean(data.parent_policy_consent)
      });
      setResult({ title: "הפרטים נשמרו", message: child?.status === "active" || child?.status === "approved" ? "השינויים נשמרו בכרטיס הילד." : "הילד ממתין לאישור מנהלת הגן. לאחר האישור ייפתח כרטיס תלמיד פעיל." });
    } catch (err) { setError(err instanceof Error ? err.message : "שליחת הרישום נכשלה"); } finally { setBusy(false); }
  }

  return (
    <form className="card form wizard-form parent-inline-wizard" onSubmit={submit}>
      <CredentialSuccess result={result} /><ErrorBox error={error} />
      <input type="hidden" name="child_id" value={child?.id ?? ""} />
      <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
      <div className="wizard-summary-strip">
        <span className={child?.status === "active" || child?.status === "approved" ? "pill good" : "pill warn"}>{statusLabel(child?.status)}</span>
        <span>{completedCount === 6 ? "הרישום הושלם ונשלח לאישור הגן" : `חסר רק עוד ${6 - completedCount} פרטים`}</span>
        <span>{garden?.name ? `גן: ${garden.name}` : "גן משויך"}</span>
      </div>
      <div className="readonly-lead-summary">
        <strong>פרטים שנשלחו בבקשת ההצטרפות</strong>
        <p>פרטים אלו נשלחו בבקשת ההצטרפות. לשינוי יש לשלוח בקשה לגננת.</p>
        <div className="profile-details-grid">
          <label>שם הורה<input readOnly value={child?.lead_parent_name ?? parent?.full_name ?? ""} /></label>
          <label>טלפון הורה<input readOnly value={child?.lead_parent_phone ?? parent?.phone ?? ""} /></label>
          <label>שם הילד<input readOnly value={child?.full_name ?? ""} /></label>
          <label>גיל הילד<input readOnly value={child?.child_age ?? ""} /></label>
          <label>קבוצה מבוקשת<input readOnly value={child?.requested_age_group ?? child?.age_group ?? child?.classroom ?? ""} /></label>
          <label>תאריך התחלה<input readOnly value={child?.requested_start_date ? String(child.requested_start_date).slice(0, 10) : ""} /></label>
          <label className="wide">כתובת<input readOnly value={child?.address ?? parent?.address ?? ""} /></label>
        </div>
        <a className="button secondary tiny" href="/dashboard/parent/messages">בקשה לתיקון פרטים</a>
      </div>
      <h2>פרטי הילד נשמרים בשלבים ברורים</h2>
      <p>כל שלב נפתח מתחת לכותרת שלו. אם כבר מילאתם מידע, הוא מופיע כאן ולא תצטרכו להתחיל מחדש.</p>

      <details className="accordion-step" open>
        <summary><strong>1. פרטי הילד</strong><span>{completeText(completed.child)}</span></summary>
        <input type="hidden" name="full_name" value={child?.full_name ?? ""} />
        <input type="hidden" name="child_age" value={child?.child_age ?? ""} />
        <input type="hidden" name="requested_age_group" value={child?.requested_age_group ?? child?.age_group ?? child?.classroom ?? ""} />
        <input type="hidden" name="requested_start_date" value={child?.requested_start_date ? String(child.requested_start_date).slice(0, 10) : ""} />
        <input type="hidden" name="address" value={child?.address ?? parent?.address ?? ""} />
        <div className="form-grid"><label>תאריך לידה<input name="birth_date" type="date" required defaultValue={child?.birth_date ? String(child.birth_date).slice(0, 10) : ""} /></label><label>תעודת זהות ילד אם קיימת<input name="identity_number" defaultValue={child?.identity_number ?? ""} /></label><label className="wide">תמונת ילד / כתובת תמונה<input name="photo_url" required defaultValue={child?.photo_url ?? child?.face_image_url ?? ""} placeholder="הדביקו כתובת תמונה או העלו דרך כרטיס הילד" /></label>{ageGroups.length ? <label className="wide">קבוצת גיל / כיתה<select disabled defaultValue={child?.requested_age_group ?? child?.age_group ?? child?.classroom ?? ""}><option value="">הגן ישייך במידת הצורך</option>{ageGroups.map((group) => <option value={group.label} key={group.id ?? group.label}>{group.age_range ? `${group.label} · ${group.age_range}` : group.label}</option>)}</select><small>האפשרויות מגיעות מהגדרות הגן. לשינוי יש לשלוח בקשה לגננת.</small></label> : <label className="wide">קבוצת גיל / כיתה<div className="gateway-setup-state"><strong>הגן עדיין לא הגדיר קבוצות גיל.</strong><p>ניתן להשלים את שאר הפרטים והגן ישייך את הילד לקבוצה.</p></div></label>}</div>
      </details>

      <details className="accordion-step" open={!completed.health}>
        <summary><strong>2. בריאות ואלרגיות</strong><span>{completeText(completed.health)}</span></summary>
        <div className="form-grid"><label>קופת חולים<input name="hmo" defaultValue={child?.hmo ?? ""} /></label><label>אלרגיות<input name="allergies" defaultValue={child?.allergies ?? ""} placeholder="אם אין, כתבו אין" /></label><label>רגישויות<input name="sensitivities" defaultValue={child?.sensitivities ?? ""} /></label><label>תרופות קבועות<input name="regular_medications" defaultValue={child?.regular_medications ?? ""} placeholder="שם התרופה ומינון" /></label><label className="wide">דברים שחשוב לדעת<textarea name="important_notes" rows={2} defaultValue={child?.important_notes ?? ""} /></label><label>מה הילד אוהב<input name="likes_notes" defaultValue={child?.likes_notes ?? ""} /></label><label>מה פחות מתאים לילד<input name="dislikes_notes" defaultValue={child?.dislikes_notes ?? ""} /></label><label className="wide">הערות רפואיות / חירום<textarea name="medical_notes" rows={3} defaultValue={child?.medical_notes ?? ""} /></label></div>
      </details>

      <details className="accordion-step" open={!completed.contacts}>
        <summary><strong>3. אנשי קשר ואיסוף</strong><span>{completeText(completed.contacts)}</span></summary>
        <div className="form-grid"><label>שם אם<input name="mother_name" defaultValue={child?.mother_name ?? parent?.full_name ?? ""} /></label><label>ת.ז אם<input name="mother_identity_number" defaultValue={child?.mother_identity_number ?? parent?.identity_number ?? ""} /></label><label>טלפון אם<input name="mother_phone" defaultValue={child?.mother_phone ?? parent?.phone ?? ""} /></label><label>תמונת אם<input name="mother_photo_url" defaultValue={child?.mother_photo_url ?? child?.parent_photo_url ?? ""} /></label><label>שם אב<input name="father_name" defaultValue={child?.father_name ?? ""} /></label><label>ת.ז אב<input name="father_identity_number" defaultValue={child?.father_identity_number ?? ""} /></label><label>טלפון אב<input name="father_phone" defaultValue={child?.father_phone ?? ""} /></label><label>תמונת אב<input name="father_photo_url" defaultValue={child?.father_photo_url ?? ""} /></label><label className="wide">תמונת הורה ראשית<input name="parent_photo_url" defaultValue={child?.parent_photo_url ?? child?.mother_photo_url ?? child?.father_photo_url ?? ""} /></label><label className="wide">טלפון חירום<input name="emergency_phone" defaultValue={child?.emergency_phone ?? ""} /></label><label className="wide">מורשי איסוף עד 3<textarea name="pickup_authorized" rows={4} placeholder="שם מלא | תעודת זהות | טלפון | כתובת תמונה" defaultValue={asPickupText(child?.pickup_authorized)} /></label></div>
      </details>

      <details className="accordion-step" open={!completed.documents}>
        <summary><strong>4. מסמכים</strong><span>{completeText(completed.documents)}</span></summary>
        {!documentsRequired ? <div className="success-screen"><strong>העלאת מסמכים אינה נדרשת בשלב זה.</strong><p>המסמכים אינם נדרשים כרגע. אם הגן יבקש מסמך בהמשך, תקבלו התראה.</p></div> : <div className="risk-list">{documents.map((doc) => <div key={doc.id}><span>{doc.name ?? doc.document_type}</span><b>{doc.status}</b></div>)}</div>}
      </details>

      <details className="accordion-step" open={!completed.notes}>
        <summary><strong>5. בקשות מיוחדות והערות</strong><span>{completeText(completed.notes)}</span></summary>
        <div className="form-grid"><label>אוכל<textarea name="special_food_notes" rows={2} defaultValue={specialNotes.food ?? ""} placeholder="העדפות או הנחיות מיוחדות" /></label><label>שינה<textarea name="sleep_notes" rows={2} defaultValue={specialNotes.sleep ?? ""} placeholder="הרגלים או בקשות שינה" /></label><label>התנהגות / רגישות<textarea name="behavior_notes" rows={2} defaultValue={specialNotes.behavior ?? ""} /></label><label>הערות הורה<textarea name="parent_notes" rows={2} defaultValue={specialNotes.parent_notes ?? ""} /></label></div>
      </details>

      <details className="accordion-step" open={!completed.declarations}>
        <summary><strong>6. אישורים והצהרות</strong><span>{completeText(completed.declarations)}</span></summary>
        <div className="consent-grid"><label><input name="system_consent" type="checkbox" required defaultChecked={Boolean(child?.system_consent)} /> הסכמה לשימוש במערכת</label><label><input name="privacy_consent" type="checkbox" required defaultChecked={Boolean(consents?.privacy)} /> מדיניות פרטיות</label><label><input name="health_declaration" type="checkbox" required defaultChecked={Boolean(consents?.health_declaration)} /> הצהרת בריאות</label><label><input name="photo_consent" type="checkbox" defaultChecked={Boolean(child?.photo_consent)} /> אישור צילום</label><label><input name="camera_consent" type="checkbox" defaultChecked={Boolean(consents?.camera_viewing)} /> אישור צפייה במצלמות אם רלוונטי</label><label><input name="parent_policy_consent" type="checkbox" required defaultChecked={Boolean(consents?.parent_policy)} /> תקנון הורים</label></div>
      </details>

      <button className="button primary large" disabled={busy}>{child?.status === "active" || child?.status === "approved" ? "שמירת שינויים" : "שמירה ושליחה לאישור הגן"}</button>
      <div className={completedCount === 6 ? "success-banner" : "gateway-setup-state"}>{completedCount === 6 ? "הרישום הושלם ונשלח לאישור הגן. הפרטים הושלמו, וכעת הגן בודק ומאשר את הילד." : "אפשר לשמור גם לפני השלמה מלאה, אבל הגן יאשר את הילד רק אחרי שכל שלבי החובה הושלמו."}</div>
    </form>
  );
}
