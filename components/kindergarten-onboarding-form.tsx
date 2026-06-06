"use client";

import { useMemo, useState } from "react";
import { UploadImageField } from "@/components/upload-image-field";

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
  documents: "מסמכים",
  camera_readiness: "מצלמות"
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
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
          <h2>הפעלה</h2>
          <div className="form-grid">
            <label className="wide">שעות פעילות<textarea name="operating_hours" rows={3} required defaultValue={profileData.operating_hours ?? ""} /></label>
            <label>מסלול תשלום<input name="subscription_plan" required defaultValue={profileData.subscription_plan ?? ""} placeholder="חודשי / שנתי / בהקמה" /></label>
            <label>מצלמות<select name="camera_readiness" required defaultValue={profileData.camera_readiness ?? ""}><option value="">בחרי</option><option value="ready">יש מצלמות מוכנות</option><option value="needs_setup">צריך חיבור</option><option value="not_now">לא עכשיו</option></select></label>
            <label className="wide">מסמכים<textarea name="documents_summary" rows={3} required defaultValue={profileData.documents_summary ?? ""} placeholder="רישיון, ביטוח, אישור עסק או מה שחסר" /></label>
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
