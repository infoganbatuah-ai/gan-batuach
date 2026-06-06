"use client";

import { useState, type FormEvent } from "react";
import { UploadImageField } from "@/components/upload-image-field";

type Props = { profile: any; garden?: any; roleLabel: string; includeGarden?: boolean; requireProfilePhoto?: boolean; requireGardenLogo?: boolean };

export function ProfileSettingsForm({ profile, garden, roleLabel, includeGarden = false, requireProfilePhoto = false, requireGardenLogo = false }: Props) {
  const [profileImage, setProfileImage] = useState(profile?.profile_image_url ?? "");
  const [gardenLogo, setGardenLogo] = useState(garden?.logo_url ?? garden?.image_url ?? "");
  const [message, setMessage] = useState("");
  const [submitForApproval, setSubmitForApproval] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requireProfilePhoto && !profileImage) {
      setMessage("יש להעלות תמונת פרופיל");
      return;
    }
    if (requireGardenLogo && !gardenLogo) {
      setMessage("יש להעלות לוגו / תמונת גן");
      return;
    }
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload: any = { full_name: String(data.full_name || ""), phone: String(data.phone || ""), address: String(data.address || ""), emergency_contact: String(data.emergency_contact || ""), profile_image_url: profileImage || "" };
    if (includeGarden) payload.garden = { name: String(data.garden_name || ""), logo_url: gardenLogo || "", image_url: gardenLogo || "", address: String(data.garden_address || ""), phone: String(data.garden_phone || ""), email: String(data.garden_email || ""), owner_name: String(data.owner_name || ""), public_description: String(data.public_description || ""), ages: String(data.ages || "").split(",").map((item) => item.trim()).filter(Boolean), public_profile_enabled: Boolean(data.public_profile_enabled), submit_for_final_approval: submitForApproval };
    const response = await fetch("/api/profile/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    setMessage(response.ok ? "ההגדרות נשמרו בהצלחה." : body.error || "שמירת ההגדרות נכשלה");
  }
  return <form className="grid cols-2 dashboard-panels settings-profile-form" onSubmit={submit}><article className="card action-panel"><h2>הפרטים שלי</h2><p>{roleLabel}</p>{profileImage ? <img className="profile-preview-image" src={profileImage} alt="תמונת פרופיל" /> : <div className="empty-mini">{requireProfilePhoto ? "נדרשת תמונת פרופיל" : "אפשר להוסיף תמונה"}</div>}<UploadImageField label={profileImage ? "החלפת תמונה" : "העלאת תמונה"} bucket="profile-photos" prefix="profile-images" onUploaded={setProfileImage} />{profileImage ? <button className="button secondary tiny" type="button" onClick={() => setProfileImage("")}>הסרה</button> : null}<label>שם מלא<input name="full_name" defaultValue={profile?.full_name ?? ""} required /></label><label>טלפון<input name="phone" defaultValue={profile?.phone ?? ""} /></label><label>כתובת<input name="address" defaultValue={profile?.address ?? ""} /></label><label>איש קשר לחירום<input name="emergency_contact" defaultValue={profile?.emergency_contact ?? ""} /></label></article>{includeGarden ? <article className="card action-panel"><h2>פרופיל הגן</h2>{gardenLogo ? <img className="profile-preview-image" src={gardenLogo} alt="לוגו גן" /> : <div className="empty-mini">{requireGardenLogo ? "נדרש לוגו או צילום גן" : "אפשר להוסיף לוגו"}</div>}<UploadImageField label={gardenLogo ? "החלפת לוגו" : "העלאת לוגו"} bucket="kindergarten-logos" prefix="garden-branding" onUploaded={setGardenLogo} />{gardenLogo ? <button className="button secondary tiny" type="button" onClick={() => setGardenLogo("")}>הסרה</button> : null}<label>שם הגן<input name="garden_name" defaultValue={garden?.name ?? ""} /></label><label>כתובת<input name="garden_address" defaultValue={garden?.address ?? ""} /></label><label>טלפון<input name="garden_phone" defaultValue={garden?.phone ?? ""} /></label><label>מייל גן<input name="garden_email" type="email" defaultValue={garden?.email ?? ""} /></label><label>בעלים / איש קשר<input name="owner_name" defaultValue={garden?.owner_name ?? ""} /></label><label>קבוצות גיל<input name="ages" defaultValue={Array.isArray(garden?.ages) ? garden.ages.join(", ") : ""} /></label><label className="wide">תיאור קצר<textarea name="public_description" defaultValue={garden?.public_description ?? ""} rows={3} /></label><label><input name="public_profile_enabled" type="checkbox" defaultChecked={Boolean(garden?.public_profile_enabled)} /> הצגת פרופיל ציבורי אחרי אישור</label></article> : <article className="card action-panel"><h2>אבטחה והתראות</h2><p>התחברות, התראות ואבטחה במקום אחד.</p><span className="pill good">מחובר</span><span className="pill">התראות פעילות</span></article>}<div className="wide profile-actions"><button className="button secondary large" type="submit" onClick={() => setSubmitForApproval(false)}>שמירת טיוטה</button>{includeGarden ? <button className="button primary large" type="submit" onClick={() => setSubmitForApproval(true)}>שליחה לאישור סופי</button> : null}{message ? <span className={message.includes("נשמרו") ? "payment-action-message" : "error-text"}>{message}</span> : null}</div></form>;
}
