"use client";

import { useState, type FormEvent } from "react";

type Candidate = { city?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; availability?: { days?: string[]; notes?: string } | null; preferred_age_groups?: string[] | null; employment_preference?: string | null; professional_summary?: string | null; matching_paused?: boolean };

export function StaffCandidateProfileForm({ candidate, completeness }: { candidate?: Candidate | null; completeness?: { percentage?: number; blockers?: string[]; status?: string } | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    const list = (name: string) => String(data.get(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean);
    const response = await fetch("/api/staff/candidate-profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ city: data.get("city"), professional_role: data.get("professional_role"), qualification_keys: list("qualification_keys"), availability: { days: list("availability_days"), notes: String(data.get("availability_notes") ?? "") || undefined }, preferred_age_groups: list("preferred_age_groups"), employment_preference: String(data.get("employment_preference") ?? "") || undefined, professional_summary: String(data.get("professional_summary") ?? "") || undefined, matching_paused: data.get("matching_paused") === "on" }) });
    const body = await response.json().catch(() => ({})); setBusy(false); setMessage(response.ok ? "הפרופיל המקצועי נשמר. ההתאמות עודכנו." : body.error ?? "השמירה נכשלה.");
    if (response.ok) window.location.reload();
  }
  return <form className="card form" onSubmit={submit}>
    <h2>פרופיל מקצועי להתאמת משרות</h2>
    <p>הפרטים משמשים להתאמות בלבד. הם אינם פותחים גישה לגן.</p>
    <p className="pill">שלמות: {completeness?.percentage ?? 0}% · {completeness?.status ?? "incomplete"}</p>
    {completeness?.blockers?.length ? <p className="error-text">חסר: {completeness.blockers.join(", ")}</p> : null}
    <div className="form-grid">
      <label>עיר<input name="city" required defaultValue={candidate?.city ?? ""} /></label>
      <label>תפקיד מקצועי<input name="professional_role" required defaultValue={candidate?.professional_role ?? ""} placeholder="גננת, סייעת, מטפלת" /></label>
      <label>הסמכות (מופרדות בפסיק)<input name="qualification_keys" required defaultValue={(candidate?.qualification_keys ?? []).join(", ")} placeholder="teacher_certificate, first_aid" /></label>
      <label>קבוצות גיל מועדפות<input name="preferred_age_groups" defaultValue={(candidate?.preferred_age_groups ?? []).join(", ")} /></label>
      <label>ימי זמינות<input name="availability_days" required defaultValue={(candidate?.availability?.days ?? []).join(", ")} placeholder="א׳, ב׳, ג׳" /></label>
      <label>העדפת העסקה<input name="employment_preference" defaultValue={candidate?.employment_preference ?? ""} placeholder="מלאה / חלקית" /></label>
      <label className="wide">זמינות והערות<textarea name="availability_notes" defaultValue={candidate?.availability?.notes ?? ""} rows={2} /></label>
      <label className="wide">תיאור מקצועי<textarea name="professional_summary" defaultValue={candidate?.professional_summary ?? ""} rows={3} /></label>
    </div>
    <label><input type="checkbox" name="matching_paused" defaultChecked={candidate?.matching_paused} /> השהיית התאמות עבודה</label>
    <button className="button primary" disabled={busy} type="submit">{busy ? "שומר..." : "שמירת פרופיל מקצועי"}</button>
    {message ? <p className={message.includes("נשמר") ? "payment-action-message" : "error-text"}>{message}</p> : null}
  </form>;
}
