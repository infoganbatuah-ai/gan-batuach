"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Baby, BriefcaseBusiness, Building2, CheckCircle2, ClipboardCheck, Send, ShieldCheck } from "lucide-react";

type ApiState = { ok: boolean; message: string; href?: string };

async function postJson(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? "הפעולה נכשלה");
  return json.data ?? json;
}

function formValue(form: HTMLFormElement, name: string) {
  return String(new FormData(form).get(name) ?? "").trim();
}

export function SelfServiceRegisterForm() {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setState(null);
    const form = event.currentTarget;
    try {
      const data = await postJson("/api/self-service/register", {
        account_type: formValue(form, "account_type"),
        full_name: formValue(form, "full_name"),
        email: formValue(form, "email"),
        phone: formValue(form, "phone") || undefined,
        city: formValue(form, "city") || undefined,
        password: formValue(form, "password")
      });
      setState({ ok: true, message: "החשבון נוצר במצב מוגבל. אפשר להתחבר ולהגיש בקשת שיוך.", href: data.next_path });
      form.reset();
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "ההרשמה נכשלה" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form premium-login-card" onSubmit={submit}>
      <h2>הרשמה עצמאית</h2>
      <label>סוג חשבון
        <select name="account_type" required defaultValue="parent">
          <option value="parent">הורה</option>
          <option value="staff_candidate">מועמד/ת צוות</option>
          <option value="inspector_candidate">מועמד/ת מפקח</option>
          <option value="kindergarten_manager">מנהלת גן</option>
        </select>
      </label>
      <label>שם מלא<input name="full_name" required minLength={2} /></label>
      <label>אימייל<input name="email" type="email" required autoComplete="username" /></label>
      <label>טלפון<input name="phone" autoComplete="tel" /></label>
      <label>עיר<input name="city" /></label>
      <label>סיסמה<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      <button className="button primary" disabled={busy} type="submit"><Send size={16} /> {busy ? "שומר..." : "יצירת חשבון"}</button>
      {state ? <div className={state.ok ? "success-screen" : "error-banner"}><strong>{state.message}</strong>{state.href ? <Link className="button secondary tiny" href="/login">כניסה לחשבון</Link> : null}</div> : null}
    </form>
  );
}

export function ParentChildProfileForm() {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await postJson("/api/parent/child-profiles", {
        child_first_name: formValue(form, "child_first_name"),
        child_last_name: formValue(form, "child_last_name"),
        identity_number: formValue(form, "identity_number"),
        birth_date: formValue(form, "birth_date") || undefined,
        gender: formValue(form, "gender") || undefined,
        allergies: formValue(form, "allergies") || undefined,
        medical_notes: formValue(form, "medical_notes") || undefined,
        important_notes: formValue(form, "important_notes") || undefined,
        address: formValue(form, "address") || undefined,
        mother_name: formValue(form, "mother_name") || undefined,
        mother_phone: formValue(form, "mother_phone") || undefined,
        father_name: formValue(form, "father_name") || undefined,
        father_phone: formValue(form, "father_phone") || undefined,
        emergency_contacts: [{ name: formValue(form, "emergency_name"), phone: formValue(form, "emergency_phone"), relation: formValue(form, "emergency_relation") }].filter((item) => item.name),
        pickup_authorized: [{ name: formValue(form, "pickup_name"), phone: formValue(form, "pickup_phone"), relation: formValue(form, "pickup_relation"), identity_number: formValue(form, "pickup_identity") }].filter((item) => item.name)
      });
      setState({ ok: true, message: "כרטיס הילד נשמר אצלך בלבד. עכשיו אפשר לבחור גן ולהגיש בקשה." });
      form.reset();
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "שמירת כרטיס הילד נכשלה" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card form" onSubmit={submit}>
      <h2><Baby size={18} /> כרטיס ילד פרטי</h2>
      <div className="form-grid">
        <label>שם פרטי<input name="child_first_name" required /></label>
        <label>שם משפחה<input name="child_last_name" required /></label>
        <label>תעודת זהות ילד<input name="identity_number" required /></label>
        <label>תאריך לידה<input name="birth_date" type="date" /></label>
        <label>מין / מגדר<input name="gender" /></label>
        <label>כתובת<input name="address" /></label>
      </div>
      <div className="form-grid">
        <label>אלרגיות<textarea name="allergies" /></label>
        <label>הערות רפואיות<textarea name="medical_notes" /></label>
        <label>דגשים חשובים<textarea name="important_notes" /></label>
      </div>
      <div className="form-grid">
        <label>שם אם<input name="mother_name" /></label>
        <label>טלפון אם<input name="mother_phone" /></label>
        <label>שם אב<input name="father_name" /></label>
        <label>טלפון אב<input name="father_phone" /></label>
      </div>
      <div className="form-grid">
        <label>איש קשר חירום<input name="emergency_name" /></label>
        <label>טלפון חירום<input name="emergency_phone" /></label>
        <label>קרבה<input name="emergency_relation" /></label>
      </div>
      <div className="form-grid">
        <label>מורשה איסוף<input name="pickup_name" /></label>
        <label>תעודת זהות מורשה<input name="pickup_identity" /></label>
        <label>טלפון מורשה<input name="pickup_phone" /></label>
        <label>קרבה<input name="pickup_relation" /></label>
      </div>
      <button className="button primary" disabled={busy} type="submit"><CheckCircle2 size={16} /> {busy ? "שומר..." : "שמירת כרטיס ילד"}</button>
      {state ? <div className={state.ok ? "success-screen" : "error-banner"}><strong>{state.message}</strong></div> : null}
    </form>
  );
}

export function EnrollmentRequestButton({ gardenId, childProfiles, feeGroups }: { gardenId: string; childProfiles: any[]; feeGroups: any[] }) {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await postJson("/api/parent/enrollment-requests", {
        garden_id: gardenId,
        child_profile_id: formValue(form, "child_profile_id"),
        requested_age_group: formValue(form, "requested_age_group") || undefined,
        requested_class_id: formValue(form, "requested_class_id") || undefined,
        parent_message: formValue(form, "parent_message") || undefined
      });
      setState({ ok: true, message: "בקשת ההצטרפות נשלחה למנהלת הגן." });
      form.reset();
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "שליחת הבקשה נכשלה" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form compact-form" onSubmit={submit}>
      <label>ילד/ה
        <select name="child_profile_id" required>
          <option value="">בחרו כרטיס ילד</option>
          {childProfiles.map((child) => <option key={child.id} value={child.id}>{child.full_name}</option>)}
        </select>
      </label>
      <label>קבוצת גיל
        <select name="requested_class_id">
          <option value="">ללא בחירה</option>
          {feeGroups.map((group) => <option key={group.id} value={group.id}>{group.group_name} {group.show_price_public ? `- ${group.monthly_fee} ₪` : ""}</option>)}
        </select>
      </label>
      <input name="requested_age_group" placeholder="הערת קבוצת גיל" />
      <textarea name="parent_message" placeholder="הודעה קצרה למנהלת" />
      <button className="button primary tiny" disabled={busy || childProfiles.length === 0} type="submit">שליחת בקשה</button>
      {state ? <small className={state.ok ? "pill good" : "pill bad"}>{state.message}</small> : null}
    </form>
  );
}

export function StaffApplicationForm({ opening }: { opening: any }) {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await postJson("/api/staff/job-applications", {
        opening_id: opening.id,
        requested_role: opening.role_needed,
        full_name: formValue(form, "full_name"),
        phone: formValue(form, "phone") || undefined,
        email: formValue(form, "email") || undefined,
        identity_number: formValue(form, "identity_number"),
        date_of_birth: formValue(form, "date_of_birth") || undefined,
        previous_kindergarten_experience: formValue(form, "previous_kindergarten_experience") === "on",
        previous_kindergarten_name: formValue(form, "previous_kindergarten_name") || undefined,
        work_experience: formValue(form, "work_experience") || undefined,
        document_status: { police_clearance: "pending_upload", sexual_offense_clearance: "pending_upload", first_aid: "optional" }
      });
      setState({ ok: true, message: "המועמדות נשלחה למנהלת הגן." });
      form.reset();
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "שליחת המועמדות נכשלה" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form compact-form" onSubmit={submit}>
      <div className="form-grid">
        <label>שם מלא<input name="full_name" required /></label>
        <label>טלפון<input name="phone" /></label>
        <label>אימייל<input name="email" type="email" /></label>
        <label>תעודת זהות<input name="identity_number" required /></label>
      </div>
      <div className="form-grid">
        <label>תאריך לידה<input name="date_of_birth" type="date" /></label>
        <label>גן קודם<input name="previous_kindergarten_name" /></label>
      </div>
      <label><input name="previous_kindergarten_experience" type="checkbox" /> יש לי ניסיון קודם בגן</label>
      <label>ניסיון תעסוקתי<textarea name="work_experience" /></label>
      <button className="button primary tiny" disabled={busy} type="submit">הגשת מועמדות</button>
      {state ? <small className={state.ok ? "pill good" : "pill bad"}>{state.message}</small> : null}
    </form>
  );
}

export function StaffOpeningForm() {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await postJson("/api/garden/staff-openings", {
        role_needed: formValue(form, "role_needed"),
        age_group: formValue(form, "age_group") || undefined,
        description: formValue(form, "description") || undefined,
        requirements: formValue(form, "requirements") || undefined,
        employment_type: formValue(form, "employment_type") || undefined,
        active_status: formValue(form, "active_status") || "published"
      });
      setState({ ok: true, message: "המשרה פורסמה לשוק המשרות." });
      form.reset();
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "פרסום המשרה נכשל" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card form" onSubmit={submit}>
      <h2><BriefcaseBusiness size={18} /> פרסום משרה</h2>
      <div className="form-grid">
        <label>תפקיד דרוש<input name="role_needed" required placeholder="סייעת / גננת" /></label>
        <label>קבוצת גיל<input name="age_group" /></label>
        <label>סוג העסקה<input name="employment_type" placeholder="משרה מלאה / חלקית" /></label>
        <label>סטטוס
          <select name="active_status" defaultValue="published">
            <option value="published">פרסום פעיל</option>
            <option value="draft">טיוטה</option>
            <option value="paused">מושהה</option>
            <option value="closed">סגור</option>
          </select>
        </label>
      </div>
      <label>תיאור<textarea name="description" /></label>
      <label>דרישות<textarea name="requirements" /></label>
      <button className="button primary" disabled={busy} type="submit">פרסום משרה</button>
      {state ? <div className={state.ok ? "success-screen" : "error-banner"}><strong>{state.message}</strong></div> : null}
    </form>
  );
}

export function InspectorApplicationForm({ application }: { application?: any }) {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await postJson("/api/inspector/applications", {
        full_name: formValue(form, "full_name"),
        phone: formValue(form, "phone") || undefined,
        email: formValue(form, "email") || undefined,
        city: formValue(form, "city") || undefined,
        identity_number: formValue(form, "identity_number") || undefined,
        preferred_regions: formValue(form, "preferred_regions").split(",").map((item) => item.trim()).filter(Boolean),
        experience_summary: formValue(form, "experience_summary") || undefined,
        documents: { id_verification: "pending_upload", confidentiality: "pending_upload", training: "pending" },
        submit: true
      });
      setState({ ok: true, message: "בקשת ההצטרפות למערך המפקחים נשלחה לאדמין." });
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "שליחת הבקשה נכשלה" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card form" onSubmit={submit}>
      <h2><ClipboardCheck size={18} /> בקשת הצטרפות למערך המפקחים</h2>
      <div className="form-grid">
        <label>שם מלא<input name="full_name" required defaultValue={application?.full_name ?? ""} /></label>
        <label>טלפון<input name="phone" defaultValue={application?.phone ?? ""} /></label>
        <label>אימייל<input name="email" type="email" defaultValue={application?.email ?? ""} /></label>
        <label>עיר<input name="city" defaultValue={application?.city ?? ""} /></label>
        <label>תעודת זהות<input name="identity_number" /></label>
        <label>אזורים מועדפים<input name="preferred_regions" placeholder="מרכז, שרון, ירושלים" defaultValue={(application?.preferred_regions ?? []).join(", ")} /></label>
      </div>
      <label>ניסיון מקצועי<textarea name="experience_summary" defaultValue={application?.experience_summary ?? ""} /></label>
      <button className="button primary" disabled={busy} type="submit"><ShieldCheck size={16} /> {busy ? "שולח..." : "שליחת בקשה"}</button>
      {state ? <div className={state.ok ? "success-screen" : "error-banner"}><strong>{state.message}</strong></div> : null}
    </form>
  );
}

export function ApplicationDecisionForm({ endpoint, actions }: { endpoint: string; actions: Array<{ value: string; label: string }> }) {
  const [state, setState] = useState<ApiState | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    try {
      await postJson(endpoint, {
        action: formValue(form, "action"),
        decision_reason: formValue(form, "decision_reason") || undefined,
        assigned_age_group: formValue(form, "assigned_age_group") || undefined,
        assigned_role: formValue(form, "assigned_role") || undefined,
        assigned_regions: formValue(form, "assigned_regions").split(",").map((item) => item.trim()).filter(Boolean),
        garden_ids: formValue(form, "garden_ids").split(",").map((item) => item.trim()).filter(Boolean)
      });
      setState({ ok: true, message: "ההחלטה נשמרה." });
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "שמירת ההחלטה נכשלה" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form compact-form" onSubmit={submit}>
      <select name="action" required>{actions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}</select>
      <input name="assigned_age_group" placeholder="קבוצת גיל / כיתה" />
      <input name="assigned_role" placeholder="תפקיד צוות" />
      <input name="assigned_regions" placeholder="אזורי מפקח, מופרדים בפסיק" />
      <input name="garden_ids" placeholder="מזהי גנים לשיוך, מופרדים בפסיק" />
      <textarea name="decision_reason" placeholder="הערת החלטה" />
      <button className="button secondary tiny" disabled={busy} type="submit"><BriefcaseBusiness size={14} /> שמירה</button>
      {state ? <small className={state.ok ? "pill good" : "pill bad"}>{state.message}</small> : null}
    </form>
  );
}

export function ProductRoleCards() {
  return (
    <div className="login-audience-grid">
      <article className="audience-card"><Baby /><strong>הורים</strong><span>מצאו את הגן של ילדכם והגישו בקשת הצטרפות.</span></article>
      <article className="audience-card"><BriefcaseBusiness /><strong>צוות</strong><span>מצאו גן שמחפש עובדים והגישו מועמדות.</span></article>
      <article className="audience-card"><ClipboardCheck /><strong>מפקחים</strong><span>הגישו בקשה להצטרף למערך המפקחים של גן בטוח.</span></article>
      <article className="audience-card"><Building2 /><strong>מנהלות גן</strong><span>מסלול רישום גנים נשאר דרך תהליך ההפעלה הקיים.</span></article>
    </div>
  );
}
