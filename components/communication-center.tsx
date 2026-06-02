"use client";

import { useMemo, useState } from "react";

type CommunicationLog = {
  id: string;
  channel: string;
  template_key: string;
  message_preview?: string | null;
  status: string;
  provider?: string | null;
  failure_reason?: string | null;
  created_at?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  kindergarten_id?: string | null;
};

type CommunicationTemplate = {
  id: string;
  template_key: string;
  audience_role: string;
  title: string;
  body: string;
  whatsapp_template_name?: string | null;
  active: boolean;
};

type CommunicationSettings = {
  default_parent_channel?: string;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  email_fallback_enabled?: boolean;
};

const channelLabels: Record<string, string> = {
  in_app: "התראה במערכת",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email"
};

const statusLabels: Record<string, string> = {
  queued: "ממתין",
  sent_mock: "נשלח במצב בדיקה",
  sent: "נשלח",
  failed: "נכשל",
  delivered: "נמסר",
  read: "נקרא",
  skipped_preferences: "דולג לפי העדפות",
  deduped: "לא נשלח כפול"
};

function toneForStatus(status: string) {
  if (status === "failed") return "bad";
  if (status === "sent" || status === "sent_mock" || status === "delivered" || status === "read") return "good";
  if (status === "skipped_preferences" || status === "deduped") return "warn";
  return "neutral";
}

export function CommunicationCenter({
  role,
  logs,
  templates,
  settings,
  apiPath
}: {
  role: "admin" | "garden";
  logs: CommunicationLog[];
  templates: CommunicationTemplate[];
  settings?: CommunicationSettings | null;
  apiPath: string;
}) {
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [defaultChannel, setDefaultChannel] = useState(settings?.default_parent_channel ?? "in_app");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    if (channel !== "all" && log.channel !== channel) return false;
    if (status !== "all" && log.status !== status) return false;
    return true;
  }), [logs, channel, status]);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_settings", default_parent_channel: defaultChannel })
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "הגדרות התקשורת נשמרו" : json.error || "שמירת ההגדרות נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function retryLog(id: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id })
      });
      const json = await res.json().catch(() => ({}));
      setMessage(res.ok ? "ההודעה סומנה לניסיון חוזר במצב בדיקה" : json.error || "ניסיון השליחה נכשל");
    } finally {
      setSaving(false);
    }
  }

  const failedCount = logs.filter((log) => log.status === "failed").length;
  const mockCount = logs.filter((log) => log.status === "sent_mock").length;

  return (
    <div className="stack">
      <section className="card-grid three">
        <div className="metric-card"><span>הודעות</span><strong>{logs.length}</strong><small>כל הערוצים</small></div>
        <div className="metric-card"><span>מצב בדיקה</span><strong>{mockCount}</strong><small>לא נשלח SMS/WhatsApp אמיתי</small></div>
        <div className="metric-card"><span>דורש בדיקה</span><strong>{failedCount}</strong><small>טלפון חסר, העדפה או ספק</small></div>
      </section>

      {role === "garden" ? (
        <section className="form-card compact-form">
          <div>
            <p className="eyebrow">ערוץ ברירת מחדל</p>
            <h2>איך לשלוח הודעות להורים</h2>
            <p>המערכת עדיין עובדת במצב בדיקה. אפשר לבחור ערוץ מועדף כדי לבדוק זרימה בלי לשלוח הודעות אמיתיות.</p>
          </div>
          <label>
            ערוץ ברירת מחדל
            <select value={defaultChannel} onChange={(event) => setDefaultChannel(event.target.value)}>
              <option value="in_app">התראה במערכת</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
          <button className="primary-action" type="button" disabled={saving} onClick={saveSettings}>שמירת הגדרות</button>
        </section>
      ) : null}

      {message ? <div className="status-banner">{message}</div> : null}

      <section className="form-card compact-form">
        <div>
          <p className="eyebrow">סינון</p>
          <h2>לוג תקשורת</h2>
        </div>
        <div className="form-grid two">
          <label>
            ערוץ
            <select value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="all">כל הערוצים</option>
              <option value="in_app">התראה במערכת</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label>
            סטטוס
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">כל הסטטוסים</option>
              <option value="sent_mock">נשלח במצב בדיקה</option>
              <option value="failed">נכשל</option>
              <option value="skipped_preferences">דולג לפי העדפות</option>
              <option value="deduped">לא נשלח כפול</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card-list">
        {filteredLogs.length ? filteredLogs.map((log) => (
          <article className="info-card" key={log.id}>
            <div className="card-row">
              <div>
                <p className="eyebrow">{channelLabels[log.channel] ?? log.channel}</p>
                <h3>{log.template_key}</h3>
                <p>{log.message_preview || "אין תצוגה מקדימה"}</p>
              </div>
              <span className={`pill ${toneForStatus(log.status)}`}>{statusLabels[log.status] ?? log.status}</span>
            </div>
            <div className="meta-row">
              <span>{log.provider || "mock"}</span>
              <span>{log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : "ללא תאריך"}</span>
              {log.failure_reason ? <span>{log.failure_reason}</span> : null}
            </div>
            {role === "admin" && log.status === "failed" ? (
              <button className="secondary-action" type="button" disabled={saving} onClick={() => retryLog(log.id)}>ניסיון חוזר</button>
            ) : null}
          </article>
        )) : (
          <div className="empty-state">
            <h3>אין הודעות במסנן הזה</h3>
            <p>כאשר פעולות חשובות ייצרו SMS, WhatsApp או Email, הן יופיעו כאן.</p>
          </div>
        )}
      </section>

      <section className="form-card compact-form">
        <div>
          <p className="eyebrow">Templates</p>
          <h2>תבניות מוכנות</h2>
          <p>התבניות מוכנות לחיבור עתידי ל-WhatsApp Business API, SMS וספקי Email.</p>
        </div>
        <div className="card-list">
          {templates.slice(0, 12).map((template) => (
            <article className="info-card" key={template.id}>
              <div className="card-row">
                <div>
                  <h3>{template.title}</h3>
                  <p>{template.body}</p>
                  <small>{template.template_key} · {template.audience_role}</small>
                </div>
                <span className={`pill ${template.active ? "good" : "warn"}`}>{template.active ? "פעיל" : "כבוי"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
