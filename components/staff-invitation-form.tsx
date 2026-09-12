"use client";

import { useState, type FormEvent } from "react";

export function StaffInvitationForm({ openings }: { openings: Array<{ id: string; role_needed: string }> }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/garden/staff-invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ full_name: data.get("full_name"), email: data.get("email"), phone: data.get("phone") || undefined, opening_id: data.get("opening_id") }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    setMessage(response.ok ? body.data?.delivery_status === "sent" ? "ההזמנה נוצרה ונשלחה." : "ההזמנה נוצרה; ספק המסירה עדיין לא אישר שליחה." : body.error ?? "יצירת ההזמנה נכשלה.");
  }
  return <form className="card form" onSubmit={submit}><h3>הזמנת מועמד/ת למשרה</h3><div className="form-grid"><label>שם מלא<input name="full_name" required /></label><label>דוא״ל<input name="email" type="email" required /></label><label>טלפון<input name="phone" /></label><label>משרה<select name="opening_id" required defaultValue=""><option value="">בחירת משרה</option>{openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.role_needed}</option>)}</select></label></div><button className="button primary" disabled={busy || openings.length === 0} type="submit">{busy ? "יוצר הזמנה..." : "יצירת הזמנה חתומה"}</button>{message ? <p>{message}</p> : null}</form>;
}
