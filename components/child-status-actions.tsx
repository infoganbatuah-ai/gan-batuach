"use client";

import { useState } from "react";

export function ChildStatusActions({ childId }: { childId: string }) {
  const [message, setMessage] = useState("");
  async function action(status: string) {
    const reason = status === "active" ? "" : window.prompt("סיבה / מה חסר?") ?? "";
    const response = await fetch(`/api/garden/children/${childId}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
    const body = await response.json();
    setMessage(response.ok ? "סטטוס הילד עודכן ונשלחה התראה להורה." : body.error || "עדכון סטטוס נכשל");
  }
  return <div className="profile-actions"><button className="button primary tiny" type="button" onClick={() => action("active")}>אישור</button><button className="button secondary tiny" type="button" onClick={() => action("request_missing_details")}>בקשת השלמה</button><button className="button secondary tiny" type="button" onClick={() => action("rejected")}>דחייה</button>{message ? <small>{message}</small> : null}</div>;
}
