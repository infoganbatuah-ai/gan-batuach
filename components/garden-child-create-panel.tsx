"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Baby, CheckCircle2, Save } from "lucide-react";

type Props = {
  gardenId: string;
  defaultOpen?: boolean;
};

export function GardenChildCreatePanel({ gardenId, defaultOpen = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garden_id: gardenId,
          full_name: String(formData.get("full_name") || ""),
          birth_date: String(formData.get("birth_date") || "") || undefined,
          identity_number: String(formData.get("identity_number") || "") || undefined,
          hmo: String(formData.get("hmo") || "") || undefined,
          allergies: String(formData.get("allergies") || "") || undefined,
          medical_notes: String(formData.get("medical_notes") || "") || undefined,
          photo_consent: formData.get("photo_consent") === "on",
          system_consent: formData.get("system_consent") === "on"
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן להוסיף ילד כרגע");
      setMessage("הילד נוסף לגן. אפשר להשלים פרטים נוספים מכרטיס הילד.");
      form.reset();
      const childId = String(body.data?.id ?? "");
      if (childId) router.push(`/dashboard/garden/children/${childId}`);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן להוסיף ילד כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ganenet-module-panel garden-inline-action-panel" id="new-child">
      <div className="ganenet-module-title-card">
        <h2><Baby size={24} /> הוספת ילד/ה לגן</h2>
        <p>פתיחת כרטיס בסיסי. פרטים רפואיים נשמרים דרך מנגנון ההצפנה הקיים של המערכת.</p>
        <button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "סגירת הטופס" : "פתיחת טופס הוספה"}
        </button>
      </div>

      {message ? <div className="success-banner"><CheckCircle2 size={18} /> {message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {open ? (
        <form className="ganenet-form-grid" onSubmit={submit}>
          <label>שם מלא<input name="full_name" required placeholder="שם הילד/ה" /></label>
          <label>תאריך לידה<input name="birth_date" type="date" /></label>
          <label>תעודת זהות<input name="identity_number" inputMode="numeric" placeholder="אופציונלי" /></label>
          <label>קופת חולים<input name="hmo" placeholder="כללית / מכבי / מאוחדת / לאומית" /></label>
          <label>אלרגיות<input name="allergies" placeholder="אם אין, אפשר להשאיר ריק" /></label>
          <label className="wide">הערה רפואית<textarea name="medical_notes" rows={3} placeholder="מידע חשוב לצוות בלבד" /></label>
          <label className="ganenet-checkbox-row"><input name="photo_consent" type="checkbox" /> קיים אישור צילום / יושלם מול ההורה</label>
          <label className="ganenet-checkbox-row"><input name="system_consent" type="checkbox" /> קיים אישור שימוש במערכת / יושלם מול ההורה</label>
          <button className="button primary wide" disabled={busy} type="submit"><Save size={18} /> {busy ? "שומר..." : "שמירת ילד/ה"}</button>
        </form>
      ) : null}
    </section>
  );
}
