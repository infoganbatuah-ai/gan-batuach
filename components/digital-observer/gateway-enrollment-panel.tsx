"use client";

import { useEffect, useRef, useState } from "react";

type Props = { enrollmentId: string; siteId: string };

export function GatewayEnrollmentPanel(props: Props) {
  return <ScopedGatewayEnrollmentPanel key={JSON.stringify([props.enrollmentId, props.siteId])} {...props} />;
}

function ScopedGatewayEnrollmentPanel({ enrollmentId, siteId }: Props) {
  const [status, setStatus] = useState("בודק את בקשת הקישור...");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [lifecycle, setLifecycle] = useState(0);
  const [deviceType, setDeviceType] = useState<"SOFTWARE_CONNECTOR" | "PHYSICAL_GATEWAY">("PHYSICAL_GATEWAY");
  const owner = useRef({ active: false, generation: 0, get: 0, post: 0, busy: false });

  useEffect(() => {
    const current = owner.current;
    current.active = true;
    const generation = ++current.generation;
    setLifecycle(generation);
    const request = ++current.get;
    current.post++;
    current.busy = false;
    setBusy(false);
    setApproved(false);
    setCanApprove(false);
    setDeviceName("");
    setDeviceType("PHYSICAL_GATEWAY");
    setStatus("בודק את בקשת הקישור...");
    const owns = () => current.active && current.generation === generation && current.get === request;
    const load = async () => {
      if (!enrollmentId) throw new Error("אין בקשת קישור מהמכשיר המקומי. אין צורך להוסיף מצלמות מחדש.");
      const response = await fetch(`/api/digital-observer/gateway-enrollment?enrollment_request_id=${encodeURIComponent(enrollmentId)}&observer_site_id=${encodeURIComponent(siteId)}`, { cache: "no-store" });
      if (!owns()) return;
      const body = await response.json().catch(() => ({}));
      if (!owns()) return;
      if (!response.ok) throw new Error(body.error || "בקשת הקישור לא נמצאה");
      setDeviceName(body.data?.device_name || "Gateway מקומי");
      setDeviceType(body.data?.device_type === "SOFTWARE_CONNECTOR" ? "SOFTWARE_CONNECTOR" : "PHYSICAL_GATEWAY");
      const pending = body.data?.status === "pending";
      setCanApprove(pending);
      setStatus(pending ? "ממתין לאישור שלך" : `סטטוס: ${body.data?.status || "לא ידוע"}`);
    };
    load().catch((error) => {
      if (owns()) setStatus(error instanceof Error ? error.message : "יצירת בקשת הקישור נכשלה");
    });
    return () => {
      current.active = false;
      current.generation++;
      current.get++;
      current.post++;
      current.busy = false;
    };
  }, [enrollmentId, siteId]);

  async function approve() {
    const current = owner.current;
    if (!current.active || current.generation !== lifecycle || current.busy || !canApprove || approved) return;
    current.busy = true;
    current.get++;
    const generation = current.generation;
    const request = ++current.post;
    const owns = () => current.active && current.generation === generation && current.post === request;
    setBusy(true);
    setStatus(deviceType === "SOFTWARE_CONNECTOR" ? "מאשר את ה-Connector..." : "מאשר את ה-Gateway...");
    try {
      const response = await fetch("/api/digital-observer/gateway-enrollment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", enrollment_request_id: enrollmentId, observer_site_id: siteId })
      });
      if (!owns()) return;
      const body = await response.json().catch(() => ({}));
      if (!owns()) return;
      if (!response.ok) throw new Error(body.error || "אישור הקישור נכשל");
      setApproved(true);
      setCanApprove(false);
      setStatus("הבקשה אושרה. החיבור יושלם רק לאחר שהמכשיר המקומי יאסוף את האישור ויאמת וידאו.");
    } catch (error) {
      if (owns()) setStatus(error instanceof Error ? error.message : "אישור הקישור נכשל");
    } finally {
      if (owns()) {
        current.busy = false;
        setBusy(false);
      }
    }
  }

  return <section className="do-camera-connection-note" aria-live="polite">
    <div>
      <strong>{deviceType === "SOFTWARE_CONNECTOR" ? "קישור Software Connector למחשב המקומי" : "קישור Gateway למחשב המקומי"}</strong>
      <span>{deviceName ? `${deviceName} · ` : ""}{status}</span>
    </div>
    {!approved && canApprove ? <button className="do-button primary" type="button" onClick={approve} disabled={busy}>אישור וחיבור לאתר</button> : null}
  </section>;
}
