"use client";

import { useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";

export function UploadImageField({ label, bucket = "child-photos", prefix = "profiles", onUploaded, variant = "default" }: { label: string; bucket?: string; prefix?: string; onUploaded: (url: string) => void; variant?: "default" | "avatar" }) {
  const [status, setStatus] = useState("");
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus("מעלה תמונה...");
    const formData = new FormData();
    formData.set("file", file);
    formData.set("bucket", bucket);
    formData.set("prefix", prefix);
    const response = await fetch("/api/storage/upload", { method: "POST", body: formData });
    const body = await response.json();
    if (!response.ok || !body.data?.url) {
      setStatus(body.error || "העלאת התמונה נכשלה");
      return;
    }
    onUploaded(body.data.url);
    setStatus("התמונה הועלתה בהצלחה. לחצו שמירה לעדכון הכרטיס.");
  }
  if (variant === "avatar") return <div className="upload-image-avatar">
    <label className="upload-image-avatar-trigger" title={label}>
      <Camera aria-hidden="true" />
      <span className="upload-image-avatar-label">{label}</span>
      <input type="file" accept="image/*" aria-label={label} onChange={upload} />
    </label>
    {status ? <small role="status">{status}</small> : null}
  </div>;
  return <label>{label}<input type="file" accept="image/*" onChange={upload} /><small>{status}</small></label>;
}
