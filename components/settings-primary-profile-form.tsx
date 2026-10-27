"use client";

import { useState, type FormEvent } from "react";
import { UploadImageField } from "@/components/upload-image-field";

type Profile = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  profile_image_url?: string | null;
};

export function SettingsPrimaryProfileForm({ profile, email, roleLabel }: { profile: Profile; email: string; roleLabel: string }) {
  const [photo, setPhoto] = useState(profile.profile_image_url ?? "");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!photo) {
      setMessageKind("error");
      setMessage("יש להעלות תמונת פרופיל לפני שמירה");
      return;
    }

    const fields = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: String(fields.get("full_name") ?? "").trim(),
          phone: String(fields.get("phone") ?? "").trim(),
          profile_image_url: photo
        })
      });
      const body = await response.json();
      setMessageKind(response.ok ? "success" : "error");
      setMessage(response.ok ? "השינויים נשמרו" : body.error || "שמירת השינויים נכשלה");
    } catch {
      setMessageKind("error");
      setMessage("לא ניתן לשמור כרגע. נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="ux18-primary-profile-form" onSubmit={save}>
    <div className="ux18-primary-profile-fields">
      <div className="ux18-primary-profile-photo">
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded private profile URL is not covered by fixed Next Image host metadata */}
        <img src={photo || "/assets/teacher-avatar.svg"} alt={photo ? "תמונת הפרופיל הנוכחית" : "איור חלופי; טרם הועלתה תמונת פרופיל"} />
      </div>
      <div className="ux18-primary-profile-inputs">
        <label>שם מלא<input name="full_name" defaultValue={profile.full_name ?? ""} minLength={2} required /></label>
        <label>תפקיד<input value={roleLabel} readOnly /></label>
        <label>דוא״ל<input value={email} type="email" dir="ltr" readOnly title="שינוי דוא״ל מחייב אימות חשבון" /></label>
        <label>טלפון<input name="phone" defaultValue={profile.phone ?? ""} type="tel" dir="ltr" /></label>
      </div>
    </div>
    <div className="ux18-primary-profile-photo-actions">
      <UploadImageField label={photo ? "החלפת תמונה" : "העלאת תמונה"} bucket="profile-photos" prefix="profile-images" onUploaded={setPhoto} />
      {photo ? <button type="button" onClick={() => setPhoto("")}>הסרת תמונה</button> : null}
    </div>
    <button className="ux18-primary-profile-save" type="submit" disabled={saving}>{saving ? "שומר..." : "שמירת שינויים"}</button>
    {message ? <p className={`ux18-primary-profile-message ${messageKind}`} role={messageKind === "error" ? "alert" : "status"}>{message}</p> : null}
  </form>;
}
