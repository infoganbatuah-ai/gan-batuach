import { maskDeviceToken } from "@/lib/domain/push-service";

type DeviceToken = {
  id: string;
  profile_id: string;
  role: string;
  platform: string;
  device_token: string;
  device_id?: string | null;
  app_version?: string | null;
  is_active: boolean;
  last_seen_at?: string | null;
  created_at?: string | null;
};

type PushLog = {
  id: string;
  profile_id?: string | null;
  platform: string;
  title: string;
  body?: string | null;
  action_url?: string | null;
  status: string;
  provider: string;
  failure_reason?: string | null;
  created_at?: string | null;
};

const statusLabels: Record<string, string> = {
  queued_mock: "ממתין במצב בדיקה",
  sent_mock: "נשלח במצב בדיקה",
  queued: "ממתין לספק",
  sent: "נשלח",
  failed: "נכשל",
  skipped_preferences: "דולג לפי העדפות",
  no_active_device: "אין מכשיר פעיל",
  deduped: "לא נשלח כפול"
};

function tone(status: string) {
  if (status === "failed" || status === "no_active_device") return "bad";
  if (status === "sent" || status === "sent_mock") return "good";
  if (status === "queued" || status === "queued_mock") return "warn";
  return "neutral";
}

export function PushDiagnostics({ devices, logs }: { devices: DeviceToken[]; logs: PushLog[] }) {
  const activeDevices = devices.filter((device) => device.is_active).length;
  const failedLogs = logs.filter((log) => log.status === "failed" || log.status === "no_active_device").length;
  const mockLogs = logs.filter((log) => log.status === "sent_mock" || log.status === "queued_mock").length;

  return (
    <div className="stack">
      <section className="card-grid three">
        <div className="metric-card"><span>מכשירים פעילים</span><strong>{activeDevices}</strong><small>Web / Android / iOS</small></div>
        <div className="metric-card"><span>Push במצב בדיקה</span><strong>{mockLogs}</strong><small>לא נשלח Push אמיתי</small></div>
        <div className="metric-card"><span>דורש טיפול</span><strong>{failedLogs}</strong><small>כשלונות או בלי מכשיר פעיל</small></div>
      </section>

      <section className="form-card compact-form">
        <div>
          <p className="eyebrow">Device Tokens</p>
          <h2>מכשירים רשומים</h2>
          <p>טוקנים מוצגים באופן חלקי בלבד. מפתחות FCM/APNs/VAPID נשארים בשרת.</p>
        </div>
        <div className="card-list">
          {devices.length ? devices.map((device) => (
            <article className="info-card" key={device.id}>
              <div className="card-row">
                <div>
                  <h3>{device.platform} · {device.role}</h3>
                  <p>{maskDeviceToken(device.device_token)}</p>
                  <small>{device.app_version || "ללא גרסה"} · {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString("he-IL") : "ללא last seen"}</small>
                </div>
                <span className={`pill ${device.is_active ? "good" : "warn"}`}>{device.is_active ? "פעיל" : "כבוי"}</span>
              </div>
            </article>
          )) : (
            <div className="empty-state">
              <h3>אין עדיין מכשירים רשומים</h3>
              <p>לאחר חיבור Web Push או Capacitor, מכשירים רשומים יופיעו כאן.</p>
            </div>
          )}
        </div>
      </section>

      <section className="form-card compact-form">
        <div>
          <p className="eyebrow">Push Logs</p>
          <h2>לוג משלוחים</h2>
        </div>
        <div className="card-list">
          {logs.length ? logs.map((log) => (
            <article className="info-card" key={log.id}>
              <div className="card-row">
                <div>
                  <h3>{log.title}</h3>
                  <p>{log.body || "ללא תוכן"}</p>
                  <small>{log.platform} · {log.provider} · {log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : "ללא תאריך"}</small>
                </div>
                <span className={`pill ${tone(log.status)}`}>{statusLabels[log.status] ?? log.status}</span>
              </div>
              {log.failure_reason ? <p className="muted">{log.failure_reason}</p> : null}
              {log.action_url ? <p className="muted">יעד: {log.action_url}</p> : null}
            </article>
          )) : (
            <div className="empty-state">
              <h3>אין עדיין לוגים</h3>
              <p>כאשר התראה קריטית תכין Push, הלוג יופיע כאן.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
