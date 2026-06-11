"use client";

import { useState, useTransition } from "react";
import { LogIn, LogOut, MapPin } from "lucide-react";
import { queueStaffOfflineAction } from "@/lib/client/staff-offline-queue";

type Props = {
  staffId?: string | null;
  gardenId?: string | null;
  hasOpenShift?: boolean;
};

export function StaffAttendanceActions({ staffId, gardenId, hasOpenShift = false }: Props) {
  const [openShift, setOpenShift] = useState(hasOpenShift);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function update(action: "check_in" | "check_out") {
    if (!staffId || !gardenId) {
      setMessage("לא נמצא שיוך צוות וגן לביצוע החתמה.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueStaffOfflineAction({
        type: "attendance",
        label: action === "check_in" ? "כניסה למשמרת" : "יציאה ממשמרת",
        endpoint: "/api/staff/gps-attendance",
        method: "POST",
        body: { action, staff_id: staffId, garden_id: gardenId, gps_lat: null, gps_lng: null, offline: true }
      });
      setMessage("אין חיבור כרגע. הפעולה נשמרה לסנכרון כשיחזור החיבור.");
      return;
    }
    setMessage("מבקש הרשאת מיקום...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          setMessage("");
          const response = await fetch("/api/staff/gps-attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              staff_id: staffId,
              garden_id: gardenId,
              gps_lat: position.coords.latitude,
              gps_lng: position.coords.longitude
            })
          });
          const body = await response.json().catch(() => null);
          if (response.ok) {
            setOpenShift(action === "check_in");
            setMessage(action === "check_in" ? "כניסה נשמרה בהצלחה." : "יציאה נשמרה בהצלחה.");
          } else {
            setMessage(body?.error || "לא ניתן לשמור החתמה כרגע.");
          }
        });
      },
      () => setMessage("לא ניתן לקבל מיקום. אפשרו הרשאת מיקום בדפדפן ונסו שוב."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  return (
    <article className="card action-panel staff-attendance-actions">
      <div className="section-heading">
        <div>
          <h2>החתמה מהירה</h2>
          <p>כניסה ויציאה נשמרות עם זמן ומיקום, בלי טופס נוסף.</p>
        </div>
        <span className={openShift ? "pill good" : "pill warn"}>
          <MapPin size={14} /> {openShift ? "משמרת פתוחה" : "לא במשמרת"}
        </span>
      </div>
      <div className="profile-actions">
        <button className="button primary large" type="button" disabled={isPending || openShift || !staffId || !gardenId} onClick={() => update("check_in")}>
          <LogIn size={18} /> כניסה
        </button>
        <button className="button secondary large" type="button" disabled={isPending || !openShift || !staffId || !gardenId} onClick={() => update("check_out")}>
          <LogOut size={18} /> יציאה
        </button>
      </div>
      {message ? <small className={message.includes("בהצלחה") ? "payment-action-message" : "error-text"}>{message}</small> : null}
    </article>
  );
}
