"use client";

import { useState } from "react";

export function ServiceCharterEditor({ charter }: { charter?: { title?: string | null; version?: string | null; content?: string | null } | null }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/service-charter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") ?? ""),
          version: String(form.get("version") ?? ""),
          content: String(form.get("content") ?? "")
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "השמירה נכשלה");
      setMessage("האמנה נשמרה ופורסמה");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form wizard-form" onSubmit={submit}>
      <h2>עריכת אמנת השירות</h2>
      <div className="form-grid">
        <label>כותרת<input name="title" required defaultValue={charter?.title ?? "אמנת השירות של גן בטוח"} /></label>
        <label>גרסה<input name="version" required defaultValue={charter?.version ?? "2026-06-13"} /></label>
        <label className="wide">תוכן<textarea name="content" required rows={14} defaultValue={charter?.content ?? ""} /></label>
      </div>
      <button className="button primary" disabled={busy}>שמירה ופרסום</button>
      {message ? <span className={message.includes("נכשל") ? "error-text" : "payment-action-message"}>{message}</span> : null}
    </form>
  );
}
