"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChildStatusActions({ childId }: { childId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  async function action(status: string) {
    const reason = status === "active" ? "" : window.prompt("סיבה / מה חסר?") ?? "";
    setBusy(true);
    const response = await fetch(`/api/garden/children/${childId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setMessage("סטטוס הילד עודכן ונשלחה התראה להורה.");
      if (["active", "rejected"].includes(status)) setCompleted(true);
      router.refresh();
    } else {
      setMessage(body.error || "עדכון סטטוס נכשל");
    }
    setBusy(false);
  }
  if (completed) return <div className="success-banner compact">{message}</div>;
  return <div className="profile-actions"><button className="button primary tiny" disabled={busy} type="button" onClick={() => action("active")}>אישור</button><button className="button secondary tiny" disabled={busy} type="button" onClick={() => action("missing_info")}>בקשת השלמה</button><button className="button secondary tiny" disabled={busy} type="button" onClick={() => action("rejected")}>דחייה</button>{message ? <small>{message}</small> : null}</div>;
}
