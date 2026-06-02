"use client";

import { useState } from "react";
import { UploadImageField } from "@/components/upload-image-field";

export function ChildPhotoUpload({ childId, initialUrl }: { childId: string; initialUrl?: string | null }) {
  const [photoUrl, setPhotoUrl] = useState(initialUrl ?? "");
  const [message, setMessage] = useState("");
  async function save() {
    if (!photoUrl) return setMessage("בחרו תמונה לפני שמירה.");
    const response = await fetch(`/api/children/${childId}/photo`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo_url: photoUrl, field: "photo_url" }) });
    const body = await response.json();
    setMessage(response.ok ? "תמונת הילד נשמרה." : body.error || "שמירת התמונה נכשלה");
  }
  return <div className="card action-panel image-upload-panel"><h2>תמונת ילד</h2>{photoUrl ? <img className="profile-preview-image" src={photoUrl} alt="תמונת ילד" /> : <div className="empty-mini">לא הוגדרה תמונה.</div>}<UploadImageField label="העלאת תמונה" bucket="child-photos" prefix="child-profile" onUploaded={setPhotoUrl} /><button className="button primary" type="button" onClick={save}>שמירת תמונה בכרטיס</button>{message ? <small className={message.includes("נשמרה") ? "payment-action-message" : "error-text"}>{message}</small> : null}</div>;
}
