"use client";

import { useMemo, useState, type FormEvent } from "react";
import { UploadImageField } from "@/components/upload-image-field";
import { calculateGanBatuachMonthlyPrice, calculateRequiredStaff, kindergartenAgeGroups, requiredKindergartenDocumentCategories } from "@/lib/domain/kindergarten-onboarding";

type Garden = {
  name?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  owner_name?: string | null;
  public_description?: string | null;
};

type Onboarding = {
  lifecycle_status?: string | null;
  progress_percent?: number | null;
  missing_fields?: string[] | null;
  profile_data?: Record<string, any> | null;
  correction_note?: string | null;
};

type Props = {
  garden: Garden;
  onboarding: Onboarding;
  managerName?: string | null;
};

const fieldLabels: Record<string, string> = {
  kindergarten_name: "שם הגן",
  logo: "לוגו",
  profile_image: "תמונת גן",
  address: "כתובת",
  phone: "טלפון",
  contact_details: "פרטי קשר",
  business_information: "פרטי עסק",
  operating_hours: "שעות פעילות",
  subscription_details: "מסלול תשלום",
  age_group_pricing: "מחירי קבוצות גיל",
  class_capacity_setup: "קיבולת כיתות",
  staff_setup: "הזמנת צוות",
  children_setup: "הוספת ילדים",
  parent_invitations: "הזמנת הורים",
  vacation_calendar: "לוח חופשות",
  weekly_schedule: "תוכנית שבועית",
  manager_profile: "פרופיל מנהלת",
  documents: "מסמכים",
  payment: "תשלום מנוי",
  camera_readiness: "מצלמות"
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function checked(form: FormData, name: string) {
  return form.get(name) === "on";
}

export function ManagerKindergartenApplicationForm({ managerName, managerPhone, managerEmail }: { managerName?: string | null; managerPhone?: string | null; managerEmail?: string | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/garden/manager-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kindergarten_name: text(form.get("kindergarten_name")),
          legal_entity_name: text(form.get("legal_entity_name")),
          business_id: text(form.get("business_id")),
          manager_full_name: text(form.get("manager_full_name")),
          manager_id_number: text(form.get("manager_id_number")),
          manager_phone: text(form.get("manager_phone")),
          manager_email: text(form.get("manager_email")),
          city: text(form.get("city")),
          street: text(form.get("street")),
          address_details: text(form.get("address_details")),
          public_description: text(form.get("public_description")),
          opening_hours: text(form.get("opening_hours")),
          contact_phone: text(form.get("contact_phone")),
          contact_email: text(form.get("contact_email"))
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן ליצור בקשת גן כרגע");
      setMessage("טיוטת הגן נוצרה. אפשר להמשיך לאשף ההפעלה.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן ליצור בקשת גן כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form wizard-form premium-step-form" onSubmit={submit}>
      <h2>פתיחת בקשת גן</h2>
      <p>הבקשה יוצרת טיוטת גן מוגבלת בלבד. הגן לא פעיל, לא ציבורי, ולא פתוח להורים עד אישור אדמין ותשלום מנוי.</p>
      <div className="form-grid">
        <label>שם הגן *<input name="kindergarten_name" required minLength={2} /></label>
        <label>שם משפטי / עוסק<input name="legal_entity_name" /></label>
        <label>ח.פ / עוסק / מזהה עסק<input name="business_id" /></label>
        <label>שם מנהלת *<input name="manager_full_name" required minLength={2} defaultValue={managerName ?? ""} /></label>
        <label>תעודת זהות מנהלת<input name="manager_id_number" /></label>
        <label>טלפון מנהלת<input name="manager_phone" defaultValue={managerPhone ?? ""} /></label>
        <label>אימייל מנהלת<input name="manager_email" type="email" defaultValue={managerEmail ?? ""} /></label>
        <label>עיר *<input name="city" required minLength={2} /></label>
        <label>רחוב<input name="street" /></label>
        <label>פרטי כתובת<input name="address_details" /></label>
        <label>טלפון לפרסום<input name="contact_phone" defaultValue={managerPhone ?? ""} /></label>
        <label>אימייל לפרסום<input name="contact_email" type="email" defaultValue={managerEmail ?? ""} /></label>
        <label className="wide">שעות פעילות<textarea name="opening_hours" rows={3} /></label>
        <label className="wide">תיאור ציבורי קצר<textarea name="public_description" rows={3} /></label>
      </div>
      <div className="warning-banner">גישה מלאה לדשבורד, ילדים, צוות, מסמכים פנימיים ותשלומים תיפתח רק אחרי אישור אדמין ותשלום מנוי גן בטוח.</div>
      <button className="button primary large" disabled={busy} type="submit">{busy ? "יוצר..." : "יצירת טיוטת גן"}</button>
      {message ? <span className={message.includes("לא ") ? "error-text" : "payment-action-message"}>{message}</span> : null}
    </form>
  );
}

export function KindergartenSubscriptionActivationPanel({ gardenName, monthlyAmount }: { gardenName?: string | null; monthlyAmount?: number | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function requestPayment() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/garden/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_renewal", notes: "Manager approved application subscription activation request" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לפתוח בקשת תשלום כרגע");
      setMessage(body.data?.message ?? "בקשת התשלום נשלחה לאדמין.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לפתוח בקשת תשלום כרגע");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card action-panel">
      <p className="eyebrow">אישור אדמין הושלם</p>
      <h2>הגן ממתין להפעלת מנוי גן בטוח.</h2>
      <p>{gardenName ?? "הגן"} אושר להפעלה, אבל הגישה המלאה תיפתח רק אחרי תשלום מנוי או override אדמין מתועד.</p>
      <div className="status-chip-row">
        <span className="pill warn">מנוי גן בטוח: ₪{Number(monthlyAmount ?? 800).toLocaleString("he-IL")}/חודש</span>
        <span className="pill">תשלומי הורים נשארים בנפרד ומועברים לגן</span>
      </div>
      <button className="button primary large" disabled={busy} onClick={requestPayment}>{busy ? "שולח..." : "פתיחת בקשת תשלום מנוי"}</button>
      {message ? <span className={message.includes("לא ") ? "error-text" : "payment-action-message"}>{message}</span> : null}
    </section>
  );
}

export function KindergartenOnboardingForm({ garden, onboarding, managerName }: Props) {
  const profileData = onboarding.profile_data ?? {};
  const galleryUrls = Array.isArray(profileData.gallery_urls) ? profileData.gallery_urls : [];
  const [logoUrl, setLogoUrl] = useState(String(garden.logo_url ?? profileData.logo_url ?? ""));
  const [imageUrl, setImageUrl] = useState(String(garden.image_url ?? profileData.image_url ?? ""));
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState<string[]>((onboarding.missing_fields ?? []).map((field) => fieldLabels[field] ?? field));
  const [busy, setBusy] = useState<"draft" | "submit" | "">("");
  const progress = Number(onboarding.progress_percent ?? 0);
  const correctionNote = onboarding.correction_note || "";
  const selectedAgeGroups = Array.isArray(profileData.selected_age_groups) ? profileData.selected_age_groups : [];
  const classCapacity = (profileData.class_capacity ?? {}) as Record<string, number>;
  const staffCount = Number(profileData.staff_count ?? 0);
  const requiredStaff = kindergartenAgeGroups.reduce((sum, group) => selectedAgeGroups.includes(group.key) ? sum + calculateRequiredStaff(group.key, Number(classCapacity[group.key] ?? 0)) : sum, 0);
  const missingStaff = Math.max(0, requiredStaff - staffCount);
  const classCount = selectedAgeGroups.filter((groupKey) => Number(classCapacity[groupKey] ?? 0) > 0).length || selectedAgeGroups.length;
  const ganBatuachMonthlyPrice = calculateGanBatuachMonthlyPrice(classCount);

  const statusLabel = useMemo(() => {
    const status = onboarding.lifecycle_status ?? "credentials_sent";
    if (status === "correction_required") return "נדרש תיקון";
    if (status === "pending_final_approval") return "נשלח לאישור";
    if (status === "active") return "פעיל";
    return "בהשלמה";
  }, [onboarding.lifecycle_status]);

  async function submitForm(formElement: HTMLFormElement, submitForApproval: boolean) {
    setBusy(submitForApproval ? "submit" : "draft");
    setMessage("");
    const form = new FormData(formElement);
    const selectedGroups = form.getAll("selected_age_groups").map((item) => String(item));
    const nextClassCapacity = Object.fromEntries(kindergartenAgeGroups.map((group) => [group.key, Number(text(form.get(`capacity_${group.key}`)) || 0)]));
    const ageGroupPricing = Object.fromEntries(kindergartenAgeGroups.map((group) => [group.key, {
      monthly_price: Number(text(form.get(`monthly_price_${group.key}`)) || 0),
      annual_price: Number(text(form.get(`annual_price_${group.key}`)) || 0),
      billing_day: Number(text(form.get(`billing_day_${group.key}`)) || 1),
      billing_cycle: text(form.get(`billing_cycle_${group.key}`)) === "annual" ? "annual" : "monthly",
      show_price_public: checked(form, `show_price_public_${group.key}`)
    }]));
    try {
      const response = await fetch("/api/kindergarten-onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submit: submitForApproval,
          garden: {
            name: text(form.get("name")),
            logo_url: logoUrl,
            image_url: imageUrl,
            gallery_urls: text(form.get("gallery_urls")).split("\n").map((item) => item.trim()).filter(Boolean),
            address: text(form.get("address")),
            phone: text(form.get("phone")),
            email: text(form.get("email")),
            owner_name: text(form.get("owner_name")),
            manager_name: text(form.get("manager_name")),
            manager_phone: text(form.get("manager_phone")),
            business_id: text(form.get("business_id")),
            business_name: text(form.get("business_name")),
            operating_hours: text(form.get("operating_hours")),
            subscription_plan: text(form.get("subscription_plan")),
            selected_age_groups: selectedGroups,
            age_group_pricing: ageGroupPricing,
            class_capacity: nextClassCapacity,
            staff_count: Number(text(form.get("staff_count")) || 0),
            staff_initialized: checked(form, "staff_initialized"),
            children_initialized: checked(form, "children_initialized"),
            parents_invited: checked(form, "parents_invited"),
            vacation_calendar_ready: checked(form, "vacation_calendar_ready"),
            weekly_schedule_ready: checked(form, "weekly_schedule_ready"),
            manager_profile_completed: checked(form, "manager_profile_completed"),
            uploaded_document_categories: form.getAll("uploaded_document_categories").map((item) => String(item)),
            payment_status: "not_started",
            documents_summary: text(form.get("documents_summary")),
            camera_readiness: text(form.get("camera_readiness")),
            public_description: text(form.get("public_description"))
          }
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לשמור כרגע");
      setMissing(body.data?.missing ?? []);
      setMessage(submitForApproval ? "נשלח לאישור האדמין" : "הטיוטה נשמרה");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשמור כרגע");
    } finally {
      setBusy("");
    }
  }

  return (
    <form className="kindergarten-onboarding-form" onSubmit={(event) => {
      event.preventDefault();
      void submitForm(event.currentTarget, false);
    }}>
      <section className="onboarding-progress-panel">
        <div>
          <p className="eyebrow">סטטוס</p>
          <h2>{statusLabel}</h2>
          <p>{correctionNote || "משלימים את הפרטים ושולחים לאישור סופי."}</p>
          <div className="status-chip-row">
            <span className={missingStaff ? "pill warn" : "pill good"}>צוות נדרש: {requiredStaff}</span>
            <span className="pill">צוות שהוזן: {staffCount}</span>
            <span className="pill">מנוי משוער: ₪{ganBatuachMonthlyPrice}/חודש</span>
          </div>
        </div>
        <div className="onboarding-progress-ring">
          <strong>{progress}%</strong>
          <span><i style={{ width: `${progress}%` }} /></span>
        </div>
      </section>

      {missing.length ? (
        <section className="card onboarding-missing-card">
          <h3>חסר לפני שליחה</h3>
          <div className="status-chip-row">{missing.map((item) => <span className="pill warn" key={item}>{item}</span>)}</div>
        </section>
      ) : null}

      <section className="clean-card-grid">
        <article className="card action-panel">
          <h2>פרטי הגן</h2>
          <div className="form-grid">
            <label>שם הגן<input name="name" required defaultValue={garden.name ?? ""} /></label>
            <label>כתובת<input name="address" required defaultValue={garden.address ?? ""} /></label>
            <label>טלפון<input name="phone" required defaultValue={garden.phone ?? ""} /></label>
            <label>מייל<input name="email" type="email" defaultValue={garden.email ?? ""} /></label>
            <label className="wide">תיאור קצר<textarea name="public_description" rows={3} defaultValue={garden.public_description ?? ""} /></label>
          </div>
        </article>

        <article className="card action-panel">
          <h2>תמונות</h2>
          <div className="upload-card-field">
            <strong>לוגו</strong>
            {logoUrl ? <img className="profile-preview-image" src={logoUrl} alt="לוגו גן" /> : <div className="empty-mini">נדרש לוגו</div>}
            <UploadImageField label={logoUrl ? "החלפת לוגו" : "העלאת לוגו"} bucket="kindergarten-logos" prefix="kindergarten-onboarding/logos" onUploaded={setLogoUrl} />
          </div>
          <div className="upload-card-field">
            <strong>תמונת גן</strong>
            {imageUrl ? <img className="profile-preview-image" src={imageUrl} alt="תמונת גן" /> : <div className="empty-mini">נדרשת תמונת גן</div>}
            <UploadImageField label={imageUrl ? "החלפת תמונה" : "העלאת תמונה"} bucket="kindergarten-logos" prefix="kindergarten-onboarding/images" onUploaded={setImageUrl} />
          </div>
          <label>גלריה<textarea name="gallery_urls" rows={3} placeholder="קישור אחד בכל שורה" defaultValue={galleryUrls.join("\n")} /></label>
        </article>

        <article className="card action-panel">
          <h2>בעלים ועסק</h2>
          <div className="form-grid">
            <label>שם בעלים<input name="owner_name" required defaultValue={garden.owner_name ?? ""} /></label>
            <label>שם מנהלת<input name="manager_name" required defaultValue={profileData.manager_name ?? managerName ?? ""} /></label>
            <label>טלפון מנהלת<input name="manager_phone" defaultValue={profileData.manager_phone ?? garden.phone ?? ""} /></label>
            <label>שם עסק<input name="business_name" defaultValue={profileData.business_name ?? ""} /></label>
            <label>מספר עסק<input name="business_id" defaultValue={profileData.business_id ?? ""} /></label>
          </div>
        </article>

        <article className="card action-panel">
          <h2>תמחור וקיבולת</h2>
          <div className="procedure-list">
            {kindergartenAgeGroups.map((group) => (
              <div className="card action-panel" key={group.key}>
                <label><input type="checkbox" name="selected_age_groups" value={group.key} defaultChecked={selectedAgeGroups.includes(group.key)} /> {group.label} · {group.range}</label>
                <small>מקסימום {group.maxChildrenPerClass} ילדים · {group.rule}</small>
                <div className="form-grid">
                  <label>ילדים בכיתה<input name={`capacity_${group.key}`} type="number" min="0" max={group.maxChildrenPerClass} defaultValue={classCapacity[group.key] ?? 0} /></label>
                  <label>מחיר חודשי לילד<input name={`monthly_price_${group.key}`} type="number" min="0" defaultValue={profileData.age_group_pricing?.[group.key]?.monthly_price ?? ""} /></label>
                  <label>מחיר שנתי לילד<input name={`annual_price_${group.key}`} type="number" min="0" defaultValue={profileData.age_group_pricing?.[group.key]?.annual_price ?? ""} /></label>
                  <label>יום חיוב<input name={`billing_day_${group.key}`} type="number" min="1" max="28" defaultValue={profileData.age_group_pricing?.[group.key]?.billing_day ?? 1} /></label>
                  <label>מחזור חיוב<select name={`billing_cycle_${group.key}`} defaultValue={profileData.age_group_pricing?.[group.key]?.billing_cycle ?? "monthly"}><option value="monthly">חודשי</option><option value="annual">שנתי</option></select></label>
                  <label><input name={`show_price_public_${group.key}`} type="checkbox" defaultChecked={Boolean(profileData.age_group_pricing?.[group.key]?.show_price_public)} /> הצגת מחיר להורים בחיפוש</label>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card action-panel">
          <h2>הפעלה יומית</h2>
          <div className="form-grid">
            <label className="wide">שעות פעילות<textarea name="operating_hours" rows={3} required defaultValue={profileData.operating_hours ?? ""} /></label>
            <label>מסלול תשלום<input name="subscription_plan" required defaultValue={profileData.subscription_plan ?? "מנוי שנתי בתשלום חודשי"} /></label>
            <label>מספר אנשי צוות שהוזנו<input name="staff_count" type="number" min="0" defaultValue={profileData.staff_count ?? 0} /></label>
            <label>מצלמות<select name="camera_readiness" required defaultValue={profileData.camera_readiness ?? ""}><option value="">בחרי</option><option value="ready">יש מצלמות מוכנות</option><option value="needs_setup">צריך חיבור</option><option value="not_now">לא עכשיו</option></select></label>
            <label className="wide">לוח חופשות<textarea name="vacation_calendar" rows={3} defaultValue={profileData.vacation_calendar ?? ""} placeholder="ימים סגורים / חופשות / חגים" /></label>
            <label className="wide">תוכנית שבועית<textarea name="weekly_schedule" rows={3} defaultValue={profileData.weekly_schedule ?? ""} placeholder="נושאי לימוד, פעילויות, חוגים ואירועים" /></label>
          </div>
          <div className="choice-grid detection-grid">
            <label><input name="staff_initialized" type="checkbox" defaultChecked={Boolean(profileData.staff_initialized)} /> צוות הוזמן</label>
            <label><input name="children_initialized" type="checkbox" defaultChecked={Boolean(profileData.children_initialized)} /> ילדים הוזנו</label>
            <label><input name="parents_invited" type="checkbox" defaultChecked={Boolean(profileData.parents_invited)} /> הורים הוזמנו</label>
            <label><input name="vacation_calendar_ready" type="checkbox" defaultChecked={Boolean(profileData.vacation_calendar_ready)} /> לוח חופשות מוכן</label>
            <label><input name="weekly_schedule_ready" type="checkbox" defaultChecked={Boolean(profileData.weekly_schedule_ready)} /> תוכנית שבועית מוכנה</label>
            <label><input name="manager_profile_completed" type="checkbox" defaultChecked={Boolean(profileData.manager_profile_completed)} /> פרופיל מנהלת הושלם</label>
          </div>
        </article>

        <article className="card action-panel">
          <h2>מסמכים ותשלום</h2>
          <div className="choice-grid detection-grid">
            {requiredKindergartenDocumentCategories.map((category) => <label key={category}><input type="checkbox" name="uploaded_document_categories" value={category} defaultChecked={Array.isArray(profileData.uploaded_document_categories) && profileData.uploaded_document_categories.includes(category)} /> {category.replaceAll("_", " ")}</label>)}
          </div>
          <div className="form-grid">
            <label className="wide">סיכום מסמכים<textarea name="documents_summary" rows={3} required defaultValue={profileData.documents_summary ?? ""} placeholder="מה הועלה ומה חסר" /></label>
            <div className="notice">תשלום מנוי גן בטוח ייפתח רק אחרי אישור אדמין. מנהלת לא יכולה לסמן תשלום בעצמה מתוך אשף הפרופיל.</div>
          </div>
        </article>
      </section>

      <div className="onboarding-form-actions">
        <button className="button secondary large" disabled={Boolean(busy)} type="submit">שמירת טיוטה</button>
        <button className="button primary large" disabled={Boolean(busy)} type="button" onClick={(event) => {
          if (event.currentTarget.form) void submitForm(event.currentTarget.form, true);
        }}>שליחה לאישור</button>
        {message ? <span className={message.includes("לא ") || message.includes("חסר") ? "error-text" : "payment-action-message"}>{message}</span> : null}
      </div>
    </form>
  );
}
