"use client";

import { useEffect, useState } from "react";

type Props = { enrollmentId: string; siteId: string };

export function GatewayEnrollmentPanel({ enrollmentId, siteId }: Props) {
  const activeEnrollmentId = enrollmentId;
  const [status, setStatus] = useState("בודק את בקשת הקישור...");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const id = activeEnrollmentId;
      if (!id) throw new Error("אין בקשת קישור מהמכשיר המקומי. אין צורך להוסיף מצלמות מחדש.");
      const response = await fetch(`/api/digital-observer/gateway-enrollment?enrollment_request_id=${encodeURIComponent(id)}&observer_site_id=${encodeURIComponent(siteId)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "בקשת הקישור לא נמצאה");
      if (!active) return;
      setDeviceName(body.data?.device_name || "Gateway מקומי");
      setStatus(body.data?.status === "pending" ? "ממתין לאישור שלך" : `סטטוס: ${body.data?.status || "לא ידוע"}`);
    };
    load().catch((error) => active && setStatus(error instanceof Error ? error.message : "יצירת בקשת הקישור נכשלה"));
    return () => { active = false; };
  }, [activeEnrollmentId, siteId]);

  async function approve() {
    setBusy(true);
    setStatus("מאשר את ה-Gateway...");
    try {
      const response = await fetch("/api/digital-observer/gateway-enrollment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", enrollment_request_id: activeEnrollmentId, observer_site_id: siteId })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "אישור הקישור נכשל");
      setApproved(true);
      setStatus("הבקשה אושרה. החיבור יושלם רק לאחר שהמכשיר המקומי יאסוף את האישור ויאמת וידאו.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "אישור הקישור נכשל");
    } finally {
      setBusy(false);
    }
  }

  return <section className="do-camera-connection-note" aria-live="polite">
    <div>
      <strong>קישור Gateway למחשב המקומי</strong>
      <span>{deviceName ? `${deviceName} · ` : ""}{status}</span>
    </div>
    {!approved && /ממתין לאישור/.test(status) ? <button className="do-button primary" type="button" onClick={approve} disabled={busy}>אישור וחיבור</button> : null}
  </section>;
}
