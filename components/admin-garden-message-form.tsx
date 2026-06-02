"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Recipient = { id: string; full_name?: string | null; role?: string | null };

export function AdminGardenMessageForm({ gardenId, recipients }: { gardenId: string; recipients: Recipient[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null); setError(null);
    setBusy(true);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(`/api/admin/gardens/${gardenId}/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient_id: String(data.recipient_id), subject: String(data.subject), content: String(data.content) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "שליחת הודעה נכשלה");
      form.reset();
      setMessage("ההודעה נשלחה ותופיע בממשק הגן.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שליחת הודעה נכשלה");
    } finally {
      setBusy(false);
    }
  }
  return <form className="card form" onSubmit={submit}><h2>הודעה למנהלת/בעלים</h2>{message ? <div className="success-banner">{message}</div> : null}{error ? <div className="error-banner">{error}</div> : null}<label>נמען<select name="recipient_id" required>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.full_name ?? recipient.id} · {recipient.role}</option>)}</select></label><label>נושא<input name="subject" required /></label><label>תוכן<textarea name="content" rows={4} required /></label><button className="button primary" disabled={busy}>{busy ? "שולח..." : "שליחת הודעה"}</button></form>;
}
