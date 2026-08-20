"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Save } from "lucide-react";

export function GardenPayoutConfigurationForm({ defaultOpen = false }: { defaultOpen?: boolean }) {
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
      const response = await fetch("/api/garden/payout-configuration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_type: formData.get("destination_type"),
          provider: formData.get("provider"),
          account_holder_name: formData.get("account_holder_name"),
          bank_name: formData.get("bank_name"),
          bank_branch: formData.get("bank_branch"),
          bank_account_last4: formData.get("bank_account_last4"),
          provider_account_reference: formData.get("provider_account_reference"),
          billing_email: formData.get("billing_email"),
          notes: formData.get("notes")
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לשמור יעד תשלום כרגע");
      setMessage(body.data?.message ?? "יעד התשלום נשמר.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לשמור יעד תשלום כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ganenet-module-panel garden-inline-action-panel" id="payout-settings">
      <div className="ganenet-module-title-card">
        <h2><Landmark size={24} /> הגדרת יעד תשלום הורים</h2>
        <p>שכר לימוד הורים מיועד לחשבון הגן או לספק התשלום של הגן. זה נפרד לגמרי ממנוי גן בטוח.</p>
        <button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "סגירת הטופס" : "הגדרת יעד תשלום"}
        </button>
      </div>
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {open ? (
        <form className="ganenet-form-grid" onSubmit={submit}>
          <label>סוג יעד<select name="destination_type" defaultValue="bank_account"><option value="bank_account">חשבון בנק של הגן</option><option value="payment_provider">ספק תשלום של הגן</option></select></label>
          <label>ספק<select name="provider" defaultValue="manual_bank"><option value="manual_bank">העברה בנקאית / ידני</option><option value="meshulam">Meshulam</option><option value="tranzila">Tranzila</option><option value="cardcom">Cardcom</option><option value="pelecard">Pelecard</option><option value="future_provider">ספק עתידי</option></select></label>
          <label>שם בעל החשבון<input name="account_holder_name" required placeholder="שם הגן / בעל החשבון" /></label>
          <label>בנק<input name="bank_name" placeholder="שם הבנק" /></label>
          <label>סניף<input name="bank_branch" inputMode="numeric" placeholder="מספר סניף" /></label>
          <label>4 ספרות אחרונות<input name="bank_account_last4" inputMode="numeric" maxLength={8} placeholder="1234" /></label>
          <label>מזהה ספק<input name="provider_account_reference" placeholder="אופציונלי" /></label>
          <label>מייל חיוב<input name="billing_email" type="email" placeholder="billing@example.com" /></label>
          <label className="wide">הערות<textarea name="notes" rows={3} placeholder="מידע פנימי לאימות יעד התשלום" /></label>
          <button className="button primary wide" disabled={busy} type="submit"><Save size={18} /> {busy ? "שומר..." : "שמירת יעד תשלום"}</button>
        </form>
      ) : null}
    </section>
  );
}
