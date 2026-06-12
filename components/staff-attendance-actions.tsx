"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MapPin, Radio, ShieldCheck } from "lucide-react";
import { queueStaffOfflineAction } from "@/lib/client/staff-offline-queue";

type Props = {
  staffId?: string | null;
  gardenId?: string | null;
  hasOpenShift?: boolean;
};

function statusText(event?: string) {
  if (event === "started") return "המשמרת נפתחה אוטומטית.";
  if (event === "closed") return "המשמרת נסגרה אוטומטית.";
  if (event === "monitoring_exit") return "המערכת בודקת יציאה מהגן.";
  return "המערכת בודקת נוכחות בגן.";
}

export function StaffAttendanceActions({ staffId, gardenId, hasOpenShift = false }: Props) {
  const watchId = useRef<number | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [openShift, setOpenShift] = useState(hasOpenShift);
  const [message, setMessage] = useState("הנוכחות נפתחת ונסגרת אוטומטית אחרי 30 דקות של נוכחות רצופה או היעדרות רצופה.");
  const [lastSample, setLastSample] = useState<{ inside?: boolean; distance?: number | null; confidence?: string; event?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  function sendSample(position: GeolocationPosition) {
    if (!staffId || !gardenId) {
      setMessage("לא נמצא שיוך צוות וגן לבדיקת נוכחות.");
      return;
    }
    const payload = {
      action: "location_sample",
      staff_id: staffId,
      garden_id: gardenId,
      gps_lat: position.coords.latitude,
      gps_lng: position.coords.longitude,
      gps_accuracy_meters: position.coords.accuracy,
      captured_at: new Date(position.timestamp || Date.now()).toISOString(),
      network_reliable: typeof navigator !== "undefined" ? navigator.onLine : true
    };
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueStaffOfflineAction({
        type: "attendance",
        label: "דגימת נוכחות אוטומטית",
        endpoint: "/api/staff/gps-attendance",
        method: "POST",
        body: payload
      });
      setMessage("אין חיבור כרגע. דגימת המיקום נשמרה לסנכרון.");
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/staff/gps-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.error || "לא ניתן לעדכן נוכחות אוטומטית כרגע.");
        return;
      }
      const data = body.data ?? body;
      setOpenShift(Boolean(data.shift?.actual_start && !data.shift?.actual_end) || data.attendance_event === "started");
      setLastSample({
        inside: data.inside_geofence,
        distance: data.distance_meters,
        confidence: data.confidence?.status,
        event: data.attendance_event
      });
      setMessage(statusText(data.attendance_event));
    });
  }

  function startMonitoring() {
    if (!staffId || !gardenId) {
      setMessage("לא נמצא שיוך צוות וגן לבדיקת נוכחות.");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("המכשיר לא תומך בבדיקת מיקום.");
      return;
    }
    setMessage("מבקש הרשאת מיקום לנוכחות אוטומטית...");
    watchId.current = navigator.geolocation.watchPosition(
      sendSample,
      () => setMessage("לא ניתן לקבל מיקום. אפשרו הרשאת מיקום כדי שהנוכחות תתעדכן אוטומטית."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
    setMonitoring(true);
  }

  function stopMonitoring() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setMonitoring(false);
    setMessage("בדיקת המיקום נעצרה במכשיר הזה. הנוכחות תתעדכן שוב כשהבדיקה תחודש.");
  }

  return (
    <article className="card action-panel staff-attendance-actions automatic">
      <div className="section-heading">
        <div>
          <h2>נוכחות אוטומטית</h2>
          <p>אין צורך להחתים ידנית. המערכת מזהה נוכחות בגן ושומרת כניסה/יציאה לאחר 30 דקות.</p>
        </div>
        <span className={openShift ? "pill good" : monitoring ? "pill warn" : "pill"}>
          <MapPin size={14} /> {openShift ? "משמרת פעילה" : monitoring ? "בודק מיקום" : "מוכן להפעלה"}
        </span>
      </div>
      <div className="staff-auto-attendance-state">
        <span><Radio size={16} /> {monitoring ? "בדיקת מיקום פעילה" : "בדיקת מיקום כבויה"}</span>
        <span><ShieldCheck size={16} /> {lastSample?.confidence === "verified" ? "אימות גבוה" : lastSample?.confidence === "probable" ? "אימות סביר" : "דורש דגימות"}</span>
        <span>{lastSample?.distance != null ? `${Math.round(lastSample.distance)} מטר מהגן` : "מרחק יופיע אחרי דגימה"}</span>
      </div>
      <div className="profile-actions">
        <button className="button primary large" type="button" disabled={isPending || monitoring || !staffId || !gardenId} onClick={startMonitoring}>
          הפעלת נוכחות אוטומטית
        </button>
        <button className="button secondary large" type="button" disabled={!monitoring} onClick={stopMonitoring}>
          עצירת בדיקה במכשיר
        </button>
      </div>
      {message ? <small className={message.includes("אוטומטית") || message.includes("פעילה") ? "payment-action-message" : "helper-text"}>{message}</small> : null}
    </article>
  );
}
