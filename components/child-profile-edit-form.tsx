"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Save } from "lucide-react";

export function ChildProfileEditForm({ child }: { child: { id: string; full_name?: string | null; birth_date?: string | null; hmo?: string | null } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/garden/children/${child.id}/profile`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: String(form.get("full_name") ?? "").trim(),
            birth_date: String(form.get("birth_date") ?? "").trim() || null,
            hmo: String(form.get("hmo") ?? "").trim() || null
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error ?? "לא ניתן לעדכן את הפרטים כרגע");
        setMessage("פרטי הילד/ה נשמרו.");
        router.refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "לא ניתן לעדכן את הפרטים כרגע");
      }
    });
  }

  return (
    <form className="ux04-form-card" onSubmit={submit}>
      <div className="ux04-form-grid">
        <label><span>שם מלא</span><input name="full_name" defaultValue={child.full_name ?? ""} minLength={2} maxLength={120} required /></label>
        <label><span>תאריך לידה</span><input name="birth_date" type="date" defaultValue={child.birth_date?.slice(0, 10) ?? ""} /></label>
        <label><span>קופת חולים</span><input name="hmo" defaultValue={child.hmo ?? ""} maxLength={80} /></label>
      </div>
      {message ? <p className="ux04-inline-message success"><CheckCircle2 size={17} />{message}</p> : null}
      {error ? <p className="ux04-inline-message error">{error}</p> : null}
      <button className="button primary" disabled={pending} type="submit"><Save size={18} />{pending ? "שומר..." : "שמירת פרטים"}</button>
    </form>
  );
}
