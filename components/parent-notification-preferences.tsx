"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { BellRing, CheckCircle2, Clock3, Mail, MessageCircleOff, MessageSquareText, Send, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { loadPersistedPreferences, saveAndReconcilePreferences } from "@/lib/management/preference-save-reconciliation";
import { availableChannelPatch, externalCategoryChoices } from "@/lib/management/notification-preference-payload";

export type NotificationPreferences = {
  receive_push?: boolean; receive_email?: boolean; receive_sms?: boolean; receive_whatsapp?: boolean;
  critical_push_allowed?: boolean; emergency_messages_allowed?: boolean; parent_daily_digest_enabled?: boolean;
  parent_ai_summary_enabled?: boolean; parent_category_channels?: Record<string, string[]>;
  notification_category_channels?: Record<string, string[]>; quiet_hours_start?: string | null;
  quiet_hours_end?: string | null; quiet_hours_timezone?: string; preferred_language?: "he" | "en" | "ar";
};
export type DeliveryCapability = {
  in_app: string; push: string; email: string; whatsapp: string; sms: string;
};
type Props = {
  preferences?: NotificationPreferences | null;
  pushCategoryPreferences?: Record<string, boolean>;
  capability?: DeliveryCapability;
  audienceLabel?: string;
};

const categories = [
  { key: "important", label: "חשוב", text: "פעולות שמחכות היום" },
  { key: "safety", label: "בטיחות", text: "עדכונים שנבדקו ואושרו" },
  { key: "attendance", label: "נוכחות ואיסוף", text: "הגעה, היעדרות ושחרור" },
  { key: "message", label: "הודעות", text: "שיחות ותקשורת מורשית" },
  { key: "document", label: "מסמכים", text: "אישורים, טפסים וחתימות" },
  { key: "payment", label: "תשלומים", text: "יתרות ותזכורות מורשות" },
  { key: "task", label: "משימות", text: "פעולות שהוקצו לך" },
  { key: "inspection", label: "פיקוח", text: "בדיקות ופעולות מתקנות" }
];
// Task and inspection have channel preferences, but no persisted Push-category
// toggle in the current Management schema. Do not display a false save control.
const pushToggleCategories = new Set(["important", "safety", "attendance", "message", "document", "payment"]);

const channelInfo = {
  in_app: { label: "בתוך האפליקציה", icon: BellRing, preference: null },
  push: { label: "Push", icon: Smartphone, preference: "receive_push" },
  email: { label: "Email", icon: Mail, preference: "receive_email" },
  whatsapp: { label: "WhatsApp", icon: MessageSquareText, preference: "receive_whatsapp" },
  sms: { label: "SMS", icon: Send, preference: "receive_sms" }
} as const;
type ChannelKey = keyof typeof channelInfo;

const defaultCapability: DeliveryCapability = { in_app: "available", push: "not_configured", email: "not_configured", whatsapp: "not_configured", sms: "not_configured" };
function ready(status: string) { return status === "available" || status === "provider_submission_available"; }
function capabilityLabel(status: string) { return ready(status) ? "זמין" : status === "degraded" ? "מוגבל" : "לא הוגדר"; }

function initialChannels(preferences?: NotificationPreferences | null) {
  return preferences?.notification_category_channels ?? preferences?.parent_category_channels ?? {
    important: ["in_app", "push"], safety: ["in_app", "push"], attendance: ["in_app"],
    message: ["in_app", "push"], document: ["in_app", "email"], payment: ["in_app", "email"],
    task: ["in_app"], inspection: ["in_app"]
  };
}

export function NotificationPreferencesPanel(props: Props) {
  const [snapshot, setSnapshot] = useState({ preferences: props.preferences, pushCategoryPreferences: props.pushCategoryPreferences });
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  async function reloadPersisted() {
    const persisted = await loadPersistedPreferences(fetch);
    if (!persisted) { setUnavailable(true); setError("לא ניתן לאמת מה נשמר. העדפות העריכה הוסתרו; נסו לטעון אותן מחדש."); return; }
    setSnapshot({ preferences: persisted.preferences as NotificationPreferences, pushCategoryPreferences: persisted.push_category_preferences });
    setRevision((current) => current + 1);
    setUnavailable(false);
    setError("ההעדפות נטענו מחדש מהשרת. בדקו אותן לפני שמירה חוזרת.");
  }

  async function save(payload: unknown) {
    const result = await saveAndReconcilePreferences(fetch, payload);
    if (result.status === "saved") { setError(""); return true; }
    setError(result.message);
    if (result.status === "reconciled") {
      setSnapshot({ preferences: result.snapshot.preferences as NotificationPreferences, pushCategoryPreferences: result.snapshot.push_category_preferences });
      setRevision((current) => current + 1);
      setUnavailable(false);
    } else setUnavailable(true);
    return false;
  }

  return <div>{error ? <div role="alert" className="communication-save-message error">{error}</div> : null}
    {unavailable ? <button type="button" className="button" onClick={() => void reloadPersisted()}>טעינה מחדש של העדפות</button>
      : <NotificationPreferencesForm key={revision} {...props} preferences={snapshot.preferences} pushCategoryPreferences={snapshot.pushCategoryPreferences} onSave={save} />}</div>;
}

function NotificationPreferencesForm({ preferences, pushCategoryPreferences, capability = defaultCapability, audienceLabel = "העדכונים שלך", onSave }: Props & { onSave: (payload: unknown) => Promise<boolean> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const availableChannels = useMemo(() => new Set((Object.keys(channelInfo) as ChannelKey[]).filter((channel) => ready(capability[channel]))), [capability]);
  const [categoryChannels, setCategoryChannels] = useState<Record<string, string[]>>(() => {
    return initialChannels(preferences);
  });
  const [categoryEnabled, setCategoryEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(categories.map((category) => [category.key, pushCategoryPreferences?.[category.key] ?? true])));
  const [quietEnabled, setQuietEnabled] = useState(Boolean(preferences?.quiet_hours_start && preferences?.quiet_hours_end));

  const activeChannelCount = useMemo(() => Object.values(categoryChannels).reduce((sum, value) => sum + value.length, 0), [categoryChannels]);

  function toggleChannel(category: string, channel: ChannelKey) {
    if (!availableChannels.has(channel)) return;
    setCategoryChannels((current) => {
      const selected = new Set(current[category] ?? []);
      if (selected.has(channel)) selected.delete(channel); else selected.add(channel);
      return { ...current, [category]: Array.from(selected) };
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // In-app delivery is canonical and always available, but the persisted channel
    // maps describe external delivery intents only.
    const sanitized = externalCategoryChoices(categoryChannels);
    const payload = {
      ...availableChannelPatch(data, availableChannels),
      critical_push_allowed: data.get("critical_push_allowed") === "on",
      emergency_messages_allowed: data.get("emergency_messages_allowed") === "on",
      parent_daily_digest_enabled: data.get("parent_daily_digest_enabled") === "on",
      parent_ai_summary_enabled: false,
      parent_category_channels: sanitized,
      notification_category_channels: sanitized,
      preferred_language: String(data.get("preferred_language") || "he"),
      quiet_hours_start: quietEnabled ? String(data.get("quiet_hours_start") || "") || null : null,
      quiet_hours_end: quietEnabled ? String(data.get("quiet_hours_end") || "") || null : null,
      quiet_hours_timezone: String(data.get("quiet_hours_timezone") || "Asia/Jerusalem"),
      push_category_preferences: Object.fromEntries(Object.entries(categoryEnabled)
        .filter(([category]) => pushToggleCategories.has(category)))
    };
    setMessage("");
    startTransition(async () => {
      if (await onSave(payload)) setMessage("העדפות ההתראות נשמרו.");
    });
  }

  return (
    <form className="notification-preferences-platform" onSubmit={submit} dir="rtl">
      <div className="notification-preferences-hero">
        <div><span className="eyebrow">שליטה שקטה וברורה</span><h2><BellRing size={23} /> העדפות התראות</h2><p>{audienceLabel}: בוחרים נושא וערוץ. ערוץ שאינו מחובר מוצג כלא זמין ולא יוצר הבטחת מסירה.</p></div>
        <span className="notification-preferences-count"><b>{activeChannelCount}</b> בחירות פעילות</span>
      </div>

      <section className="delivery-channel-grid" aria-label="מוכנות ערוצי מסירה">
        {(Object.keys(channelInfo) as ChannelKey[]).map((key) => {
          const item = channelInfo[key]; const Icon = item.icon; const isReady = ready(capability[key]);
          return <article className={`delivery-channel-card ${isReady ? "ready" : "unavailable"}`} key={key}><span className="delivery-channel-icon"><Icon size={23} /></span><div><strong>{item.label}</strong><small>{key === "in_app" ? "ערוץ פנימי קנוני" : isReady ? "ספק מוכן להגשה" : "אין ספק פעיל"}</small></div><span className="delivery-channel-state">{isReady ? <CheckCircle2 size={16} /> : <XCircle size={16} />}{capabilityLabel(capability[key])}</span>{item.preference ? <label className="delivery-channel-toggle"><input name={item.preference} type="checkbox" defaultChecked={isReady && Boolean(preferences?.[item.preference])} disabled={!isReady} /><span /></label> : null}</article>;
        })}
      </section>

      <section className="quiet-hours-card">
        <div className="quiet-hours-title"><span><Clock3 size={22} /></span><div><strong>שעות שקט</strong><p>עדכונים רגילים ימתינו. חריגי חירום פועלים לפי כללי המוצר.</p></div><label className="delivery-channel-toggle"><input type="checkbox" checked={quietEnabled} onChange={(event) => setQuietEnabled(event.target.checked)} /><span /></label></div>
        <div className={`quiet-hours-times ${quietEnabled ? "" : "disabled"}`}><label>משעה<input name="quiet_hours_start" type="time" defaultValue={preferences?.quiet_hours_start?.slice(0, 5) ?? "22:00"} disabled={!quietEnabled} /></label><span>עד</span><label>עד שעה<input name="quiet_hours_end" type="time" defaultValue={preferences?.quiet_hours_end?.slice(0, 5) ?? "07:00"} disabled={!quietEnabled} /></label><label>אזור זמן<select name="quiet_hours_timezone" defaultValue={preferences?.quiet_hours_timezone ?? "Asia/Jerusalem"}><option value="Asia/Jerusalem">ירושלים (GMT+3)</option><option value="UTC">UTC</option></select></label></div>
      </section>

      <section className="quiet-hours-card" id="preferences">
        <div className="quiet-hours-title"><span><BellRing size={22} /></span><div><strong>שפה ותצוגה מקומית</strong><p>השפה נשמרת כהעדפה קנונית. תאריכים ומספרים נשארים קריאים ב־RTL.</p></div></div>
        <div className="quiet-hours-times"><label>שפת ממשק<select name="preferred_language" defaultValue={preferences?.preferred_language ?? "he"}><option value="he">עברית</option><option value="en">English</option><option value="ar">العربية</option></select></label><small>שינוי שפה משפיע רק כאשר התרגום הקנוני זמין.</small></div>
      </section>

      <section className="notification-category-matrix">
        <div className="notification-category-head"><div><span className="eyebrow">לפי נושא</span><h3>מה לקבל ובאיזה ערוץ?</h3></div><span><ShieldCheck size={17} /> מידע רגיש נשאר בתוך האפליקציה</span></div>
        <div className="notification-category-list">
          {categories.map((category) => (
            <article key={category.key}>
              {pushToggleCategories.has(category.key)
                ? <label className="notification-category-toggle"><input type="checkbox" checked={categoryEnabled[category.key]} onChange={(event) => setCategoryEnabled((current) => ({ ...current, [category.key]: event.target.checked }))} /><span /><div><strong>{category.label}</strong><small>{category.text}</small></div></label>
                : <div className="notification-category-toggle"><div><strong>{category.label}</strong><small>{category.text} · בחירת ערוצים בלבד</small></div></div>}
              <div className="notification-channel-pills">
                {(Object.keys(channelInfo) as ChannelKey[]).map((channel) => {
                  const item = channelInfo[channel]; const Icon = item.icon;
                  const selected = (categoryChannels[category.key] ?? []).includes(channel);
                  const disabled = !availableChannels.has(channel) || !categoryEnabled[category.key];
                  return <button className={selected ? "selected" : ""} disabled={disabled} type="button" onClick={() => toggleChannel(category.key, channel)} key={channel}><Icon size={15} />{item.label}</button>;
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="notification-preferences-footer">
        <div className="notification-critical-controls"><label><input name="critical_push_allowed" type="checkbox" defaultChecked={preferences?.critical_push_allowed ?? true} /> עדכונים דחופים</label><label><input name="emergency_messages_allowed" type="checkbox" defaultChecked={preferences?.emergency_messages_allowed ?? true} /> הודעות חירום</label><label><input name="parent_daily_digest_enabled" type="checkbox" defaultChecked={preferences?.parent_daily_digest_enabled ?? true} /> סיכום יומי</label></div>
        <button className="button primary" disabled={pending} type="submit"><CheckCircle2 size={18} />{pending ? "שומר..." : "שמירת העדפות"}</button>
        {message ? <span className={message.includes("נשמרו") ? "communication-save-message success" : "communication-save-message error"}>{message.includes("נשמרו") ? <CheckCircle2 size={16} /> : <MessageCircleOff size={16} />}{message}</span> : null}
      </section>
    </form>
  );
}

export function ParentNotificationPreferences(props: Props) {
  return <NotificationPreferencesPanel {...props} audienceLabel={props.audienceLabel ?? "העדכונים של המשפחה"} />;
}
