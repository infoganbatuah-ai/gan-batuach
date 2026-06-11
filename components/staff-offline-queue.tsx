"use client";

import { useEffect, useState, useTransition } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { readStaffOfflineQueue, syncStaffOfflineQueue, type StaffOfflineAction } from "@/lib/client/staff-offline-queue";

function timeText(value: string) {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function StaffOfflineQueue() {
  const [online, setOnline] = useState(true);
  const [rows, setRows] = useState<StaffOfflineAction[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function refresh() {
      setOnline(navigator.onLine);
      setRows(readStaffOfflineQueue());
    }
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("staff-offline-queue-change", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("staff-offline-queue-change", refresh);
    };
  }, []);

  function sync() {
    setMessage("");
    startTransition(async () => {
      const result = await syncStaffOfflineQueue();
      setRows(result.remaining);
      setMessage(result.remaining.length ? `סונכרנו ${result.synced.length}, נשארו ${result.remaining.length} לבדיקה.` : "כל הפעולות סונכרנו.");
    });
  }

  return (
    <article className="staff-offline-card">
      <div>
        {online ? <Wifi /> : <CloudOff />}
        <div>
          <h2>{online ? "מחובר" : "אין חיבור"}</h2>
          <p>פעולות מהירות נשמרות מקומית ומסתנכרנות כשאפשר.</p>
        </div>
      </div>
      <span className={rows.length ? "pill warn" : "pill good"}>{rows.length} בתור</span>
      {rows.length ? (
        <div className="staff-offline-list">
          {rows.slice(0, 4).map((row) => <span key={row.id}><b>{row.label}</b><small>{timeText(row.createdAt)}</small></span>)}
        </div>
      ) : null}
      <button className="button secondary" type="button" disabled={pending || !rows.length || !online} onClick={sync}>
        <RefreshCw size={16} /> סנכרון
      </button>
      {message ? <small>{message}</small> : null}
    </article>
  );
}
