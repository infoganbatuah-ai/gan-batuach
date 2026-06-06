"use client";

import { useState } from "react";
import { UploadImageField } from "@/components/upload-image-field";

type Props = {
  staff: any;
  onboarding: any;
};

const labels: Record<string, string> = {
  personal_details: "פרטים אישיים",
  role_assignment: "תפקיד",
  emergency_contact: "איש קשר לחירום",
  documents: "מסמכים",
  policy_acknowledged: "נהלים"
};

export function StaffOnboardingForm({ staff, onboarding }: Props) {
  const [photoUrl, setPhotoUrl] = useState(staff?.profile_photo_url ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const missingItems = ((onboarding?.missing_items ?? []) as string[]).map((item) => labels[item] ?? item);
  const progress = Number(onboarding?.progress_percent ?? 0);
  const correction = onboarding?.correction_note || staff?.correction_note || "";

  async function submitForm(form: HTMLFormElement, submit: boolean) {
    setBusy(submit ? "submit" : "draft");
    setMessage("");
    const data = new FormData(form);
    try {
      const response = await fetch("/api/staff/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submit,
          full_name: String(data.get("full_name") || ""),
          phone: String(data.get("phone") || ""),
          address: String(data.get("address") || ""),
          emergency_contact: String(data.get("emergency_contact") || ""),
          role_title: String(data.get("role_title") || ""),
          class_group: String(data.get("class_group") || ""),
          profile_photo_url: photoUrl,
          documents_summary: String(data.get("documents_summary") || ""),
          policy_acknowledged: Boolean(data.get("policy_acknowledged"))
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לשמור כרגע");
      setMessage(submit ? "נשלח לאישור המנהלת" : "הטיוטה נשמרה");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לשמור כרגע");
    } finally {
      setBusy("");
    }
  }

  return (
    <form className="kindergarten-onboarding-form staff-onboarding-form" onSubmit={(event) => {
      event.preventDefault();
      void submitForm(event.currentTarget, false);
    }}>
      <section className="onboarding-progress-panel">
        <div>
          <p className="eyebrow">{correction ? "נדרש תיקון" : "קליטת צוות"}</p>
          <h2>{correction || "משלימים פרטים ושולחים לאישור."}</h2>
          <p>אחרי אישור המנהלת ייפתח דשבורד הצוות.</p>
        </div>
        <div className="onboarding-progress-ring"><strong>{progress}%</strong><span><i style={{ width: `${progress}%` }} /></span></div>
      </section>
      {missingItems.length ? <section className="card onboarding-missing-card"><h3>חסר לפני שליחה</h3><div className="status-chip-row">{missingItems.map((item) => <span className="pill warn" key={item}>{item}</span>)}</div></section> : null}
      <section className="clean-card-grid">
        <article className="card action-panel">
          <h2>פרטים אישיים</h2>
          <div className="form-grid">
            <label>שם מלא<input name="full_name" required defaultValue={staff?.full_name ?? ""} /></label>
            <label>טלפון<input name="phone" required defaultValue={staff?.phone ?? ""} /></label>
            <label className="wide">כתובת<input name="address" defaultValue={staff?.address ?? ""} /></label>
            <label className="wide">איש קשר לחירום<input name="emergency_contact" required defaultValue={staff?.emergency_contact ?? ""} /></label>
          </div>
        </article>
        <article className="card action-panel">
          <h2>תמונה ותפקיד</h2>
          <div className="upload-card-field">
            <strong>תמונת פרופיל</strong>
            {photoUrl ? <img className="profile-preview-image" src={photoUrl} alt="תמונת צוות" /> : <div className="empty-mini">נדרשת תמונה</div>}
            <UploadImageField label={photoUrl ? "החלפת תמונה" : "העלאת תמונה"} bucket="profile-photos" prefix="staff-onboarding" onUploaded={setPhotoUrl} />
          </div>
          <div className="form-grid">
            <label>תפקיד<input name="role_title" required defaultValue={staff?.role_title ?? ""} /></label>
            <label>כיתה / קבוצה<input name="class_group" defaultValue={staff?.class_group ?? ""} /></label>
          </div>
        </article>
        <article className="card action-panel">
          <h2>מסמכים</h2>
          <label className="wide">מה הועלה / מה חסר<textarea name="documents_summary" rows={4} required defaultValue={onboarding?.metadata?.documents_summary ?? ""} /></label>
        </article>
        <article className="card action-panel">
          <h2>נהלים</h2>
          <div className="consent-grid">
            <label><input name="policy_acknowledged" type="checkbox" required defaultChecked={Boolean(staff?.policy_acknowledged)} /> קראתי ואישרתי את נהלי הגן</label>
          </div>
        </article>
      </section>
      <div className="onboarding-form-actions">
        <button className="button secondary large" disabled={Boolean(busy)} type="submit">שמירת טיוטה</button>
        <button className="button primary large" disabled={Boolean(busy)} type="button" onClick={(event) => {
          if (event.currentTarget.form) void submitForm(event.currentTarget.form, true);
        }}>שליחה לאישור</button>
        {message ? <span className={message.includes("לא ") ? "error-text" : "payment-action-message"}>{message}</span> : null}
      </div>
    </form>
  );
}
