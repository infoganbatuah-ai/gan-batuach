"use client";

import { useState, type ChangeEvent } from "react";

export function UploadImageField({ label, bucket = "child-photos", prefix = "profiles", onUploaded }: { label: string; bucket?: string; prefix?: string; onUploaded: (url: string) => void }) {
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
  return <label>{label}<input type="file" accept="image/*" onChange={upload} /><small>{status}</small></label>;
}
