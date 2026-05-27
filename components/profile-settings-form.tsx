"use client";

import { useState, type FormEvent } from "react";
import { UploadImageField } from "@/components/upload-image-field";

type Props = { profile: any; garden?: any; roleLabel: string; includeGarden?: boolean };

export function ProfileSettingsForm({ profile, garden, roleLabel, includeGarden = false }: Props) {
  const [profileImage, setProfileImage] = useState(profile?.profile_image_url ?? "");
  const [gardenLogo, setGardenLogo] = useState(garden?.logo_url ?? garden?.image_url ?? "");
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload: any = { full_name: String(data.full_name || ""), phone: String(data.phone || ""), address: String(data.address || ""), emergency_contact: String(data.emergency_contact || ""), profile_image_url: profileImage || "" };
    if (includeGarden) payload.garden = { name: String(data.garden_name || ""), logo_url: gardenLogo || "", image_url: gardenLogo || "", address: String(data.garden_address || ""), phone: String(data.garden_phone || ""), public_description: String(data.public_description || ""), ages: String(data.ages || "").split(",").map((item) => item.trim()).filter(Boolean), public_profile_enabled: Boolean(data.public_profile_enabled) };
    const response = await fetch("/api/profile/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    setMessage(response.ok ? "ההגדרות נשמרו בהצלחה." : body.error || "שמירת ההגדרות נכשלה");
  }
  return <form className="grid cols-2 dashboard-panels settings-profile-form" onSubmit={submit}><article className="card action-panel"><h2>פרטים אישיים</h2><p>{roleLabel}</p>{profileImage ? <img className="profile-preview-image" src={profileImage} alt="תמונת פרופיל" /> : null}<UploadImageField label="תמונת פרופיל" bucket="documents" prefix="profile-images" onUploaded={setProfileImage} /><label>שם מלא<input name="full_name" defaultValue={profile?.full_name ?? ""} required /></label><label>טלפון<input name="phone" defaultValue={profile?.phone ?? ""} /></label><label>כתובת<input name="address" defaultValue={profile?.address ?? ""} /></label><label>איש קשר לחירום<input name="emergency_contact" defaultValue={profile?.emergency_contact ?? ""} /></label></article>{includeGarden ? <article className="card action-panel"><h2>פרטי הגן</h2>{gardenLogo ? <img className="profile-preview-image" src={gardenLogo} alt="לוגו גן" /> : null}<UploadImageField label="לוגו / תמונת גן" bucket="documents" prefix="garden-branding" onUploaded={setGardenLogo} /><label>שם הגן<input name="garden_name" defaultValue={garden?.name ?? ""} /></label><label>כתובת הגן<input name="garden_address" defaultValue={garden?.address ?? ""} /></label><label>טלפון הגן<input name="garden_phone" defaultValue={garden?.phone ?? ""} /></label><label>קבוצות גיל<input name="ages" defaultValue={Array.isArray(garden?.ages) ? garden.ages.join(", ") : ""} /></label><label className="wide">תיאור ציבורי<textarea name="public_description" defaultValue={garden?.public_description ?? ""} rows={4} /></label><label><input name="public_profile_enabled" type="checkbox" defaultChecked={Boolean(garden?.public_profile_enabled)} /> הצגת פרופיל ציבורי</label></article> : <article className="card action-panel"><h2>אבטחה והתראות</h2><p>כאן מרוכזים פרטי אבטחה, Passkeys והעדפות התראות. שינוי סיסמה מתבצע דרך איפוס מאובטח.</p><span className="pill good">Session פעיל</span><span className="pill">התראות מערכת</span></article>}<div className="wide profile-actions"><button className="button primary large">שמירת הגדרות</button>{message ? <span className={message.includes("נשמרו") ? "payment-action-message" : "error-text"}>{message}</span> : null}</div></form>;
}
