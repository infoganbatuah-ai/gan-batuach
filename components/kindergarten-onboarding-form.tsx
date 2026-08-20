"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  Baby,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCheck2,
  LoaderCircle,
  Save,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards
} from "lucide-react";
import { ManagerParentInvitationPanel } from "@/components/manager-parent-invitation-panel";
import { UploadImageField } from "@/components/upload-image-field";
import {
  calculateGanBatuachMonthlyPrice,
  calculateRequiredStaff,
  ganBatuachTrialDays,
  kindergartenAgeGroups,
  knownKindergartenCities,
  managerRegistrationSteps,
  operationalDistrictForCity,
  requiredKindergartenDocumentCategories
} from "@/lib/domain/kindergarten-onboarding";

type Garden = {
  id?: string | null;
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

type Props = { garden: Garden; onboarding: Onboarding; managerName?: string | null };

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
  manager_profile: "פרופיל מנהלת",
  documents: "מסמכים",
  camera_readiness: "מצב מצלמות"
};

const documentLabels: Record<string, string> = {
  ownership_legal_entity: "בעלות / ישות משפטית",
  legal_management_authorization: "הרשאת ניהול",
  first_aid_22_hours: "עזרה ראשונה",
  safe_conduct_course: "התנהלות בטוחה",
  educational_mentor_agreement: "ליווי חינוכי",
  building_yard_safety_report: "בטיחות מבנה וחצר",
  minimum_space_confirmation: "אישור שטח",
  local_authority_operating_permit: "רישיון רשות מקומית",
  fire_department_approval: "אישור כבאות",
  shelter_approval: "אישור מרחב מוגן",
  cctv_installation_declaration: "הצהרת התקנת מצלמות",
  no_audio_declaration: "הצהרת ללא שמע",
  camera_coverage_declaration: "הצהרת כיסוי מצלמות"
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function checked(form: FormData, name: string) {
  return form.get(name) === "on";
}

export function ManagerKindergartenApplicationForm({ managerName, managerPhone, managerEmail }: { managerName?: string | null; managerPhone?: string | null; managerEmail?: string | null }) {
  const router = useRouter();
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
      if (!response.ok) throw new Error(body.error || "לא ניתן לפתוח את הגן כרגע");
      setMessage("פרטי הבסיס נשמרו. ממשיכים מיד להשלמת הגן.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לפתוח את הגן כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="manager-registration-entry" onSubmit={submit}>
      <section className="manager-registration-intro">
        <div>
          <span className="manager-registration-icon"><ShieldCheck /></span>
          <p className="eyebrow">רישום מנהלת</p>
          <h2>ברוכה הבאה לגן בטוח</h2>
          <p>ממלאים את פרטי המנהלת והגן, ממשיכים ברצף לחמשת שלבי ההקמה ומתחילים תקופת ניסיון ללא המתנה לאישור אדמין.</p>
        </div>
        <div className="manager-registration-visual" aria-hidden="true"><Building2 /><Sparkles /></div>
      </section>

      <section className="manager-registration-card">
        <div className="section-heading"><h3>פרטים אישיים</h3><p>הפרטים ישמשו לזיהוי החשבון ולניהול הגן.</p></div>
        <div className="form-grid">
          <label>שם מלא *<input name="manager_full_name" required minLength={2} defaultValue={managerName ?? ""} /></label>
          <label>תעודת זהות<input name="manager_id_number" inputMode="numeric" /></label>
          <label>טלפון נייד<input name="manager_phone" inputMode="tel" defaultValue={managerPhone ?? ""} /></label>
          <label>אימייל<input name="manager_email" type="email" defaultValue={managerEmail ?? ""} /></label>
        </div>
      </section>

      <section className="manager-registration-card">
        <div className="section-heading"><h3>פרטי הגן</h3><p>אפשר לעדכן ולהרחיב את כל הפרטים בהמשך האשף.</p></div>
        <div className="form-grid">
          <label>שם הגן *<input name="kindergarten_name" required minLength={2} /></label>
          <label>עיר *<select name="city" required defaultValue=""><option value="">בחרי עיר</option>{knownKindergartenCities().map((city) => <option value={city} key={city}>{city}</option>)}<option value="אחר">אחר</option></select></label>
          <label>רחוב *<input name="street" required /></label>
          <label>מספר / פרטי כתובת<input name="address_details" /></label>
          <label>שם משפטי / עוסק<input name="legal_entity_name" /></label>
          <label>ח.פ / עוסק<input name="business_id" /></label>
          <label>טלפון הגן<input name="contact_phone" defaultValue={managerPhone ?? ""} /></label>
          <label>אימייל הגן<input name="contact_email" type="email" defaultValue={managerEmail ?? ""} /></label>
          <label className="wide">שעות פעילות<textarea name="opening_hours" rows={3} /></label>
          <label className="wide">תיאור הגן<textarea name="public_description" rows={3} /></label>
        </div>
      </section>

      <label className="manager-registration-consent"><input type="checkbox" required /> קראתי את תנאי השימוש ומדיניות הפרטיות הזמניים ואני מאשרת להמשיך בהקמת סביבת ניסיון.</label>
      <div className="manager-registration-actions">
        <button className="button primary large" disabled={busy} type="submit">{busy ? <><LoaderCircle className="spin" /> שומרים...</> : <>התחלת הקמת הגן <ChevronLeft /></>}</button>
        <span>אין חיוב ואין הפעלת תשלום חי בשלב זה.</span>
      </div>
      {message ? <p className={message.includes("לא ניתן") ? "error-text" : "payment-action-message"}>{message}</p> : null}
    </form>
  );
}

export function KindergartenOnboardingForm({ garden, onboarding, managerName }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const profileData = onboarding.profile_data ?? {};
  const initialStep = Math.min(5, Math.max(1, Number(profileData.registration_step ?? 1)));
  const [step, setStep] = useState(initialStep);
  const [logoUrl, setLogoUrl] = useState(String(garden.logo_url ?? profileData.logo_url ?? ""));
  const [imageUrl, setImageUrl] = useState(String(garden.image_url ?? profileData.image_url ?? ""));
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState<string[]>((onboarding.missing_fields ?? []).filter((field) => fieldLabels[field]).map((field) => fieldLabels[field]));
  const [busy, setBusy] = useState<"draft" | "finish" | "">("");
  const [confirmed, setConfirmed] = useState(false);
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>(Array.isArray(profileData.selected_age_groups) ? profileData.selected_age_groups : []);
  const [classCapacity, setClassCapacity] = useState<Record<string, number>>((profileData.class_capacity ?? {}) as Record<string, number>);
  const [staffCount, setStaffCount] = useState(Number(profileData.staff_count ?? 0));
  const galleryUrls = Array.isArray(profileData.gallery_urls) ? profileData.gallery_urls : [];
  const uploadedCategories = Array.isArray(profileData.uploaded_document_categories) ? profileData.uploaded_document_categories : [];
  const classCount = selectedAgeGroups.filter((key) => Number(classCapacity[key] ?? 0) > 0).length || selectedAgeGroups.length || 1;
  const monthlyPrice = calculateGanBatuachMonthlyPrice(classCount);
  const requiredStaff = selectedAgeGroups.reduce((sum, key) => sum + calculateRequiredStaff(key, Number(classCapacity[key] ?? 0)), 0);
  const trialEnd = useMemo(() => new Date(Date.now() + ganBatuachTrialDays * 86400000).toLocaleDateString("he-IL"), []);
  const cityFromAddress = String(profileData.city ?? "").trim();

  function buildPayload(formElement: HTMLFormElement, finish: boolean, registrationStep: number) {
    const form = new FormData(formElement);
    const ageGroupPricing = Object.fromEntries(kindergartenAgeGroups.map((group) => [group.key, {
      monthly_price: Number(text(form.get(`monthly_price_${group.key}`)) || 0),
      annual_price: Number(text(form.get(`annual_price_${group.key}`)) || 0),
      billing_day: Number(text(form.get(`billing_day_${group.key}`)) || 1),
      billing_cycle: text(form.get(`billing_cycle_${group.key}`)) === "annual" ? "annual" : "monthly",
      show_price_public: checked(form, `show_price_public_${group.key}`)
    }]));
    return {
      submit: finish,
      garden: {
        name: text(form.get("name")),
        logo_url: logoUrl,
        image_url: imageUrl,
        gallery_urls: text(form.get("gallery_urls")).split("\n").map((item) => item.trim()).filter(Boolean),
        address: text(form.get("address")),
        phone: text(form.get("phone")),
        email: text(form.get("email")),
        owner_name: text(form.get("owner_name")),
        city: text(form.get("city")),
        street: text(form.get("street")),
        operational_district: operationalDistrictForCity(text(form.get("city"))),
        manager_name: text(form.get("manager_name")),
        manager_phone: text(form.get("manager_phone")),
        business_id: text(form.get("business_id")),
        business_name: text(form.get("business_name")),
        operating_hours: text(form.get("operating_hours")),
        subscription_plan: "annual_monthly_charge_after_trial",
        selected_age_groups: selectedAgeGroups,
        age_group_pricing: ageGroupPricing,
        class_capacity: classCapacity,
        staff_count: staffCount,
        staff_initialized: checked(form, "staff_initialized"),
        children_initialized: checked(form, "children_initialized"),
        parents_invited: checked(form, "parents_invited"),
        vacation_calendar_ready: checked(form, "vacation_calendar_ready"),
        weekly_schedule_ready: checked(form, "weekly_schedule_ready"),
        manager_profile_completed: true,
        uploaded_document_categories: form.getAll("uploaded_document_categories").map(String),
        payment_status: finish ? "payment_pending" : "not_started",
        payment_method_preference: text(form.get("payment_method_preference")) || "not_selected",
        documents_summary: text(form.get("documents_summary")),
        camera_readiness: text(form.get("camera_readiness")),
        public_description: text(form.get("public_description")),
        registration_step: registrationStep
      }
    };
  }

  async function save(finish: boolean, nextStep = step) {
    if (!formRef.current) return false;
    setBusy(finish ? "finish" : "draft");
    setMessage("");
    try {
      const response = await fetch("/api/kindergarten-onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(formRef.current, finish, nextStep))
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לשמור כרגע");
      setMissing(body.data?.missing ?? []);
      if (finish) {
        router.replace(body.data?.next_path ?? "/dashboard/garden");
        router.refresh();
      } else {
        setMessage("הפרטים נשמרו ברקע");
      }
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשמור כרגע");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function move(next: number) {
    if (next < step) {
      setStep(next);
      return;
    }
    if (await save(false, next)) setStep(next);
  }

  return (
    <form ref={formRef} className="manager-live-onboarding" onSubmit={(event) => { event.preventDefault(); void save(false); }}>
      <nav className="manager-onboarding-steps" aria-label="שלבי רישום">
        {managerRegistrationSteps.map((item, index) => {
          const number = index + 1;
          return <button type="button" onClick={() => void move(number)} className={number === step ? "active" : number < step ? "done" : ""} key={item.key}><span>{number < step ? <Check size={18} /> : number}</span><b>{item.label}</b></button>;
        })}
      </nav>

      <section className="manager-onboarding-overview">
        <div><p className="eyebrow">התקדמות הקמה</p><h2>שלב {step} מתוך 5</h2><p>המידע נשמר בין השלבים. הזמנת הורים, ילדים וצוות היא אופציונלית ואפשר להשלים גם מהדשבורד.</p></div>
        <div className="manager-progress-value"><strong>{step * 20}%</strong><span><i style={{ width: `${step * 20}%` }} /></span></div>
      </section>

      {missing.length && step === 5 ? <div className="manager-missing-state"><strong>נדרש להשלים לפני ההפעלה:</strong>{missing.map((item) => <span key={item}>{item}</span>)}</div> : null}

      <section className={`manager-wizard-stage ${step === 1 ? "is-active" : ""}`} aria-hidden={step !== 1}>
        <div className="manager-stage-heading"><Building2 /><div><h2>פרטי הגן</h2><p>המידע שיופיע בכרטיס הגן ולצוות הניהול.</p></div></div>
        <div className="manager-stage-grid">
          <article className="manager-registration-card">
            <h3>פרטי קשר וכתובת</h3>
            <div className="form-grid">
              <label>שם הגן<input name="name" defaultValue={garden.name ?? ""} /></label>
              <label>עיר<select name="city" defaultValue={cityFromAddress}><option value="">בחרי עיר</option>{knownKindergartenCities().map((city) => <option value={city} key={city}>{city}</option>)}<option value="אחר">אחר</option></select></label>
              <label>רחוב<input name="street" defaultValue={profileData.street ?? ""} /></label>
              <label>כתובת מלאה<input name="address" defaultValue={garden.address ?? ""} /></label>
              <label>טלפון<input name="phone" defaultValue={garden.phone ?? ""} /></label>
              <label>אימייל<input name="email" type="email" defaultValue={garden.email ?? ""} /></label>
              <label>שם בעלים<input name="owner_name" defaultValue={garden.owner_name ?? ""} /></label>
              <label>שם מנהלת<input name="manager_name" defaultValue={profileData.manager_name ?? managerName ?? ""} /></label>
              <label>טלפון מנהלת<input name="manager_phone" defaultValue={profileData.manager_phone ?? garden.phone ?? ""} /></label>
              <label>שם עסק<input name="business_name" defaultValue={profileData.business_name ?? ""} /></label>
              <label>מספר עסק<input name="business_id" defaultValue={profileData.business_id ?? ""} /></label>
              <label className="wide">שעות פעילות<textarea name="operating_hours" rows={3} defaultValue={profileData.operating_hours ?? ""} /></label>
              <label className="wide">תיאור ציבורי<textarea name="public_description" rows={3} defaultValue={garden.public_description ?? ""} /></label>
            </div>
          </article>

          <article className="manager-registration-card manager-media-card">
            <h3>תמונות וכרטיס ציבורי</h3>
            <div className="manager-media-grid">
              <div className="upload-card-field"><strong>לוגו הגן</strong>{logoUrl ? <img className="profile-preview-image" src={logoUrl} alt="לוגו גן" /> : <div className="empty-mini">טרם הועלה לוגו</div>}<UploadImageField label={logoUrl ? "החלפת לוגו" : "העלאת לוגו"} bucket="kindergarten-logos" prefix="kindergarten-onboarding/logos" onUploaded={setLogoUrl} /></div>
              <div className="upload-card-field"><strong>תמונת הגן</strong>{imageUrl ? <img className="profile-preview-image" src={imageUrl} alt="תמונת גן" /> : <div className="empty-mini">טרם הועלתה תמונה</div>}<UploadImageField label={imageUrl ? "החלפת תמונה" : "העלאת תמונה"} bucket="kindergarten-logos" prefix="kindergarten-onboarding/images" onUploaded={setImageUrl} /></div>
            </div>
            <label>קישורי גלריה<textarea name="gallery_urls" rows={3} placeholder="קישור אחד בכל שורה" defaultValue={galleryUrls.join("\n")} /></label>
          </article>

          <article className="manager-registration-card manager-docs-card">
            <h3><FileCheck2 /> מסמכים והצהרות</h3>
            <p>סמני רק מסמכים שקיימים בפועל. קבצים עצמם מועלים במרכז המסמכים המוגן לאחר הכניסה לדשבורד.</p>
            <div className="manager-document-checks">{requiredKindergartenDocumentCategories.map((category) => <label key={category}><input type="checkbox" name="uploaded_document_categories" value={category} defaultChecked={uploadedCategories.includes(category)} /> {documentLabels[category] ?? category}</label>)}</div>
            <label>סיכום מצב מסמכים<textarea name="documents_summary" rows={3} defaultValue={profileData.documents_summary ?? ""} placeholder="אילו מסמכים קיימים ומה יושלם בהמשך" /></label>
          </article>
        </div>
      </section>

      <section className={`manager-wizard-stage ${step === 2 ? "is-active" : ""}`} aria-hidden={step !== 2}>
        <div className="manager-stage-heading"><UsersRound /><div><h2>קבוצות גיל וצוות</h2><p>המחיר להורה, הקיבולת ויחס הצוות נשמרים לכל קבוצה בנפרד.</p></div></div>
        <div className="manager-age-groups">
          {kindergartenAgeGroups.map((group) => {
            const selected = selectedAgeGroups.includes(group.key);
            return <article className={selected ? "selected" : ""} key={group.key}>
              <label className="manager-group-choice"><input type="checkbox" checked={selected} onChange={(event) => setSelectedAgeGroups((current) => event.target.checked ? [...current, group.key] : current.filter((key) => key !== group.key))} /><span><b>{group.label}</b><small>{group.range}</small></span></label>
              <p>עד {group.maxChildrenPerClass} ילדים · {group.rule}</p>
              <div className="form-grid">
                <label>מספר ילדים<input type="number" min="0" max={group.maxChildrenPerClass} value={classCapacity[group.key] ?? 0} onChange={(event) => setClassCapacity((current) => ({ ...current, [group.key]: Number(event.target.value) }))} /></label>
                <label>תשלום חודשי לילד<input name={`monthly_price_${group.key}`} type="number" min="0" defaultValue={profileData.age_group_pricing?.[group.key]?.monthly_price ?? ""} /></label>
                <label>יום חיוב<input name={`billing_day_${group.key}`} type="number" min="1" max="28" defaultValue={profileData.age_group_pricing?.[group.key]?.billing_day ?? 1} /></label>
                <label>מחזור<select name={`billing_cycle_${group.key}`} defaultValue={profileData.age_group_pricing?.[group.key]?.billing_cycle ?? "monthly"}><option value="monthly">חודשי</option><option value="annual">שנתי</option></select></label>
                <input name={`annual_price_${group.key}`} type="hidden" defaultValue={profileData.age_group_pricing?.[group.key]?.annual_price ?? ""} />
                <label className="wide"><input name={`show_price_public_${group.key}`} type="checkbox" defaultChecked={Boolean(profileData.age_group_pricing?.[group.key]?.show_price_public)} /> הצגת המחיר להורים לפני בקשת הצטרפות</label>
              </div>
            </article>;
          })}
        </div>
        <article className="manager-registration-card manager-staff-summary">
          <div><strong>{requiredStaff}</strong><span>אנשי צוות נדרשים לפי הקיבולת</span></div>
          <label>אנשי צוות שכבר הוגדרו<input type="number" min="0" value={staffCount} onChange={(event) => setStaffCount(Number(event.target.value))} /></label>
          <label><input name="staff_initialized" type="checkbox" defaultChecked={Boolean(profileData.staff_initialized)} /> הוזמן לפחות איש צוות אחד</label>
          <label>מצב מצלמות<select name="camera_readiness" defaultValue={profileData.camera_readiness ?? "not_now"}><option value="ready">יש מצלמות, נדרש חיבור Gateway</option><option value="needs_setup">נדרש תכנון וחיבור</option><option value="not_now">לא בשלב זה</option></select></label>
          <input name="vacation_calendar_ready" type="hidden" value={profileData.vacation_calendar_ready ? "on" : ""} />
          <input name="weekly_schedule_ready" type="hidden" value={profileData.weekly_schedule_ready ? "on" : ""} />
        </article>
      </section>

      <section className={`manager-wizard-stage ${step === 3 ? "is-active" : ""}`} aria-hidden={step !== 3}>
        <div className="manager-stage-heading"><WalletCards /><div><h2>סיכום ותשלום עתידי</h2><p>14 ימי ניסיון ללא חיוב. אמצעי תשלום יחובר רק דרך ספק מאושר.</p></div></div>
        <div className="manager-payment-layout">
          <article className="manager-registration-card manager-selected-plan">
            <span className="pill good">התוכנית שנבחרה</span>
            <ShieldCheck />
            <h3>מנוי גן בטוח שנתי</h3>
            <strong>{monthlyPrice.toLocaleString("he-IL")} ₪ <small>לחודש לאחר הניסיון</small></strong>
            <p>כולל את יכולות התצפיתן הדיגיטלי בתוך דשבורד הגן. אין צורך בחשבון נפרד למנהלת.</p>
          </article>
          <article className="manager-registration-card manager-trial-summary">
            <h3><CalendarDays /> תקופת ניסיון</h3>
            <dl><div><dt>חיוב היום</dt><dd>0 ₪</dd></div><div><dt>משך הניסיון</dt><dd>{ganBatuachTrialDays} ימים</dd></div><div><dt>מועד הסדרה משוער</dt><dd>{trialEnd}</dd></div><div><dt>אופן גבייה</dt><dd>רק לאחר חיבור ספק ואישור</dd></div></dl>
          </article>
          <article className="manager-registration-card manager-payment-methods">
            <h3><CreditCard /> אמצעי תשלום מועדף</h3>
            <p>הבחירה נשמרת כהעדפה בלבד. לא נאספים כאן פרטי כרטיס ולא מתבצע חיוב.</p>
            <label><input type="radio" name="payment_method_preference" value="card" defaultChecked={profileData.payment_method_preference === "card"} /> כרטיס אשראי דרך ספק מאובטח</label>
            <label><input type="radio" name="payment_method_preference" value="apple_pay" defaultChecked={profileData.payment_method_preference === "apple_pay"} /> Apple Pay — לאחר חיבור ספק תומך</label>
            <label><input type="radio" name="payment_method_preference" value="google_pay" defaultChecked={profileData.payment_method_preference === "google_pay"} /> Google Pay — לאחר חיבור ספק תומך</label>
            <label><input type="radio" name="payment_method_preference" value="not_selected" defaultChecked={!profileData.payment_method_preference || profileData.payment_method_preference === "not_selected"} /> אבחר לקראת סוף תקופת הניסיון</label>
          </article>
        </div>
      </section>

      <section className={`manager-wizard-stage ${step === 4 ? "is-active" : ""}`} aria-hidden={step !== 4}>
        <div className="manager-stage-heading"><Baby /><div><h2>ילדי הגן והזמנת הורים</h2><p>אפשר להזמין הורה רשום או חדש עכשיו, או לדלג ולהמשיך מהדשבורד.</p></div></div>
        {garden.id ? <ManagerParentInvitationPanel gardenId={garden.id} /> : <div className="notice">פרטי הגן נשמרים. לאחר השמירה ניתן יהיה לשלוח הזמנות.</div>}
        <div className="manager-optional-setup">
          <label><input name="children_initialized" type="checkbox" defaultChecked={Boolean(profileData.children_initialized)} /> הוגדרו ילדים או כרטיסי ילד ראשוניים</label>
          <label><input name="parents_invited" type="checkbox" defaultChecked={Boolean(profileData.parents_invited)} /> נשלחה לפחות הזמנת הורה אחת</label>
          <div className="manager-onboarding-readiness-actions" aria-label="פעולות שייפתחו לאחר ההפעלה">
            <span className="pill">ניהול ילדים מלא זמין מיד לאחר תחילת הניסיון</span>
            <span className="pill">הזמנת צוות זמינה מיד לאחר תחילת הניסיון</span>
          </div>
        </div>
      </section>

      <section className={`manager-wizard-stage ${step === 5 ? "is-active" : ""}`} aria-hidden={step !== 5}>
        <div className="manager-stage-heading"><CheckCircle2 /><div><h2>השלמת הקמה</h2><p>כניסה לדשבורד ותחילת תקופת ניסיון מבוקרת.</p></div></div>
        <div className="manager-finish-grid">
          <article className="manager-registration-card"><h3>מה יופעל עכשיו</h3>{["דשבורד ניהול הגן", "ילדים, הורים, צוות ומסמכים", "14 ימי ניסיון ללא חיוב היום", "תצפיתן דיגיטלי במצב מוכנות בתוך גן בטוח"].map((item) => <p key={item}><CheckCircle2 /> {item}</p>)}</article>
          <article className="manager-registration-card"><h3>מה נשאר חסום בכוונה</h3>{["תשלום חי עד חיבור ספק ואישור", "צפיית הורים במצלמות עד Gateway, הרשאות ואישור", "AI חי והודעות חיצוניות עד אישור מפורש"].map((item) => <p key={item}><ShieldCheck /> {item}</p>)}</article>
        </div>
        <label className="manager-registration-consent"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> אני מאשרת שהפרטים נכונים ומבקשת להתחיל 14 ימי ניסיון ללא חיוב היום.</label>
      </section>

      <footer className="manager-wizard-actions">
        <button type="button" className="button secondary" disabled={step === 1 || Boolean(busy)} onClick={() => void move(step - 1)}><ChevronRight /> חזרה</button>
        <button type="submit" className="button secondary" disabled={Boolean(busy)}><Save /> {busy === "draft" ? "שומר..." : "שמירת טיוטה"}</button>
        {step < 5 ? <button type="button" className="button primary" disabled={Boolean(busy)} onClick={() => void move(step + 1)}>{busy === "draft" ? <LoaderCircle className="spin" /> : null} שמירה והמשך <ChevronLeft /></button> : <button type="button" className="button primary" disabled={!confirmed || Boolean(busy)} onClick={() => void save(true, 5)}>{busy === "finish" ? <LoaderCircle className="spin" /> : <CheckCircle2 />} התחלת ניסיון וכניסה לדשבורד</button>}
        {step === 4 ? <button type="button" className="button text-button" disabled={Boolean(busy)} onClick={() => void move(5)}>דלגי לעת עתה</button> : null}
        {message ? <span className={message.includes("לא ניתן") || message.includes("חסרים") || message.includes("נכשלה") ? "error-text" : "payment-action-message"}>{message}</span> : null}
      </footer>
    </form>
  );
}
