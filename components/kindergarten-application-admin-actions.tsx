"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const labels: Record<string, string> = {
  activation_in_progress: "טיוטה / בהשלמה",
  onboarding_submitted: "נשלח לאישור",
  pending_final_approval: "ממתין לאישור",
  correction_required: "נדרש מידע נוסף",
  payment_pending: "אושר וממתין למנוי",
  active: "פעיל",
  suspended: "מושהה",
  archived: "בארכיון"
};

async function postAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin/kindergarten-approval", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data ?? body;
}

export function KindergartenApplicationAdminActions({ gardenId, status }: { gardenId: string; status?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const currentStatus = status ?? "activation_in_progress";

  async function act(action: string, success: string) {
    setBusy(action);
    setMessage("");
    try {
      await postAction({ action, garden_id: gardenId, note });
      setMessage(success);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="procedure-meta">
      <span className={currentStatus === "active" ? "pill good" : currentStatus === "payment_pending" || currentStatus === "correction_required" ? "pill warn" : "pill"}>{labels[currentStatus] ?? currentStatus}</span>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="הערה למנהלת / סיבת החלטה" />
      {["onboarding_submitted", "pending_final_approval"].includes(currentStatus) ? <button className="button primary" disabled={Boolean(busy)} onClick={() => act("approve_final_profile", "הבקשה אושרה וממתינה למנוי")}>אישור למנוי</button> : null}
      {["onboarding_submitted", "pending_final_approval", "activation_in_progress", "correction_required"].includes(currentStatus) ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("request_corrections", "נשלחה בקשת השלמה")}>בקשת מידע נוסף</button> : null}
      {currentStatus === "payment_pending" ? <button className="button primary" disabled={Boolean(busy)} onClick={() => act("activate_after_payment", "הגן הופעל אחרי תשלום/override")}>הפעלה אחרי תשלום</button> : null}
      {!["active", "archived"].includes(currentStatus) ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("archive", "הבקשה נדחתה/אורכבה")}>דחייה / ארכוב</button> : null}
      {currentStatus === "active" ? <button className="button secondary" disabled={Boolean(busy)} onClick={() => act("suspend", "הגן הושהה")}>השהיה</button> : null}
      {message ? <small className={message.includes("נכשל") || message.includes("לא ") ? "pill bad" : "pill good"}>{message}</small> : null}
    </div>
  );
}
