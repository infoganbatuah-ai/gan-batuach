"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, MonitorCog, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type Enrollment = { enrollment_request_id: string; status: string; device_name: string; device_platform: string; expires_at: string };

export function ObserverGatewayEnrollmentApproval({ enrollmentRequestId, observerSiteId }: { enrollmentRequestId?: string; observerSiteId?: string }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enrollmentRequestId) return;
    const token = readObserverAccessToken();
    if (!observerSiteId) return;
    fetch(`/api/digital-observer/gateway-enrollment?enrollment_request_id=${encodeURIComponent(enrollmentRequestId)}&observer_site_id=${encodeURIComponent(observerSiteId)}`, { credentials: "same-origin", headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "לא ניתן לקרוא את בקשת קישור המכשיר.");
        setEnrollment(payload.data);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "לא ניתן לקרוא את בקשת קישור המכשיר."));
  }, [enrollmentRequestId, observerSiteId]);

  async function approve() {
    if (!enrollment || !observerSiteId) return;
    setBusy(true); setError("");
    try {
      const token = readObserverAccessToken();
      const response = await fetch("/api/digital-observer/gateway-enrollment", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "approve", enrollment_request_id: enrollment.enrollment_request_id, observer_site_id: observerSiteId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "לא ניתן לאשר את המכשיר.");
      setEnrollment((current) => current ? { ...current, status: "approved" } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לאשר את המכשיר.");
    } finally { setBusy(false); }
  }

  if (!enrollmentRequestId) return null;
  if (error) return <section className="do-panel do-form-section"><p className="do-action-result error">{error}</p></section>;
  if (!enrollment) return <section className="do-panel do-form-section"><p className="do-action-result loading"><LoaderCircle className="do-spin" /> בודק את בקשת קישור המכשיר...</p></section>;
  const pending = enrollment.status === "pending" && Date.parse(enrollment.expires_at) > Date.now();
  return <section className="do-panel do-form-section do-device-enrollment-approval">
    <div className="do-section-head"><div><h2>אישור מחשב לחיבור המקליט</h2><p>בדקו שזה המחשב שנמצא באותה רשת של המקליט. לא מועברים לכאן פרטי DVR, כתובות או סיסמאות.</p></div><MonitorCog /></div>
    <div className="do-gateway-status pending"><MonitorCog /><span><strong>{enrollment.device_name}</strong><small>{enrollment.device_platform} · בקשה זו פגה ב־{new Date(enrollment.expires_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</small></span></div>
    {pending ? <button className="do-button primary" type="button" disabled={busy || !observerSiteId} onClick={approve}>{busy ? <LoaderCircle className="do-spin" /> : <ShieldCheck />} אשר/י מחשב זה לאתר הנבחר</button> : <div className="do-action-result success"><Check /> {enrollment.status === "approved" ? "המחשב אושר. חזרו לרכיב המקומי להמשך אוטומטי." : "הבקשה כבר טופלה או שפג תוקפה."}</div>}
  </section>;
}
