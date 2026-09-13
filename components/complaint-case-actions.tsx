"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "acknowledge" | "review" | "request_reporter" | "request_garden" | "garden_reply" | "escalate" | "resolve" | "close" | "reopen";

export function ComplaintCaseActions({ id, status, role }: { id: string; status: string; role: "inspector" | "garden" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actions: Array<[Action, string, boolean]> = role === "garden"
    ? [["acknowledge", "אישור קבלה", false], ["garden_reply", "תגובה", true]]
    : [["acknowledge", "אישור קבלה", false], ["review", "תחילת בדיקה", false],
      ["request_reporter", "בקשת מידע", true], ["escalate", "הסלמה", false],
      ["request_garden", "בקשת תגובת גן", true],
      ["resolve", "פתרון", true], ["close", "סגירה", false], ["reopen", "פתיחה מחדש", true]];
  async function run(action: Action, needsNote: boolean) {
    const note = needsNote ? window.prompt("פירוט הפעולה") : null;
    if (needsNote && !note?.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/complaints/${id}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, publicNote: note?.trim() ?? null })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "הפעולה נדחתה");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נדחתה"); }
    finally { setBusy(false); }
  }
  return <div className="profile-actions" aria-label="פעולות תלונה">
    {actions.filter(([action]) =>
      action === "acknowledge" ? status === "new"
      : action === "review" ? ["new", "assigned", "reopened"].includes(status)
      : action === "close" ? status === "resolved"
      : action === "reopen" ? ["resolved", "closed"].includes(status)
      : action === "resolve" ? ["in_progress", "escalated", "reopened"].includes(status)
      : !["closed", "resolved"].includes(status)
    ).map(([action, label, needsNote]) => <button className="button secondary" type="button" key={action} disabled={busy}
      onClick={() => run(action, needsNote)}>{label}</button>)}
    {error ? <span role="alert" className="error-banner">{error}</span> : null}
  </div>;
}
