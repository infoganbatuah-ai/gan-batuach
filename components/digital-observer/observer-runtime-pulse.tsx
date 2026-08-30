"use client";

import { Activity, BrainCircuit, Clock3, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type RuntimeStatus = {
  checked_at: string;
  camera_count: number;
  connected_camera_count: number;
  open_event_count: number;
  last_event_at: string | null;
  last_learning_at: string | null;
};

function dateTime(value: Date | string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function time(value?: string | null) {
  if (!value) return "טרם התקבל";
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function ObserverRuntimePulse({
  observerSiteId,
  initial,
  compact = false
}: {
  observerSiteId: string;
  initial: RuntimeStatus;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    const refresh = window.setInterval(async () => {
      const token = readObserverAccessToken();
      const response = await fetch(`/api/digital-observer/runtime-status?observer_site_id=${encodeURIComponent(observerSiteId)}`, {
        credentials: "same-origin",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.data) setStatus(payload.data as RuntimeStatus);
    }, 30_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, [observerSiteId]);

  return <section className={`do-runtime-pulse ${compact ? "compact" : ""}`} aria-live="polite">
    <div className="do-runtime-clock"><Clock3 /><span><strong>{dateTime(now)}</strong><small>שעון ישראל · עדכון ממשק חי</small></span></div>
    <div className="do-runtime-facts">
      <span><Radio /><b>{status.connected_camera_count}/{status.camera_count}</b><small>מצלמות מחוברות</small></span>
      <span><Activity /><b>{status.open_event_count}</b><small>אירועים פתוחים</small></span>
      <span><BrainCircuit /><b>{time(status.last_learning_at)}</b><small>דגימת למידה אחרונה</small></span>
    </div>
    {!compact ? <small className="do-runtime-last-update">האירוע האחרון: {time(status.last_event_at)} · נבדק מול השרת ב־{time(status.checked_at)}</small> : null}
  </section>;
}
