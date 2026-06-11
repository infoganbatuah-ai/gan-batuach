"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";

type Preferences = {
  receive_push?: boolean;
  receive_email?: boolean;
  receive_sms?: boolean;
  receive_whatsapp?: boolean;
  critical_push_allowed?: boolean;
  emergency_messages_allowed?: boolean;
  parent_daily_digest_enabled?: boolean;
  parent_ai_summary_enabled?: boolean;
  parent_category_channels?: Record<string, string[]>;
};

type Props = {
  preferences?: Preferences | null;
  pushCategoryPreferences?: Record<string, boolean>;
};

const categories = [
  { key: "important", label: "חשוב", text: "דברים שדורשים תשומת לב היום" },
  { key: "safety", label: "בטיחות", text: "רק עדכונים שנבדקו ואושרו" },
  { key: "attendance", label: "נוכחות", text: "הגעה, היעדרות ואיסוף" },
  { key: "message", label: "הודעות", text: "שיחות עם הגן" },
  { key: "document", label: "מסמכים", text: "אישורים, טפסים וחתימות" },
  { key: "payment", label: "תשלומים", text: "יתרות, חשבוניות ותזכורות" },
  { key: "pickup", label: "איסוף", text: "שינויי איסוף והרשאות" }
];

const channels = [
  { key: "push", label: "התראה" },
  { key: "email", label: "מייל" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "וואטסאפ" }
];

function initialChannels(preferences?: Preferences | null) {
  return preferences?.parent_category_channels ?? {
    important: ["push", "email"],
    safety: ["push", "email", "whatsapp"],
    attendance: ["push"],
    message: ["push", "whatsapp"],
    document: ["push", "email"],
    payment: ["push", "email"],
    pickup: ["push"]
  };
}

export function ParentNotificationPreferences({ preferences, pushCategoryPreferences }: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [categoryChannels, setCategoryChannels] = useState<Record<string, string[]>>(() => initialChannels(preferences));
  const [categoryEnabled, setCategoryEnabled] = useState<Record<string, boolean>>(() => Object.fromEntries(categories.map((category) => [category.key, pushCategoryPreferences?.[category.key] ?? true])));

  const activeChannelCount = useMemo(() => Object.values(categoryChannels).reduce((sum, value) => sum + value.length, 0), [categoryChannels]);

  function toggleChannel(category: string, channel: string) {
    setCategoryChannels((current) => {
      const selected = new Set(current[category] ?? []);
      if (selected.has(channel)) selected.delete(channel);
      else selected.add(channel);
      return { ...current, [category]: Array.from(selected) };
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      receive_push: data.get("receive_push") === "on",
      receive_email: data.get("receive_email") === "on",
      receive_sms: data.get("receive_sms") === "on",
      receive_whatsapp: data.get("receive_whatsapp") === "on",
      critical_push_allowed: data.get("critical_push_allowed") === "on",
      emergency_messages_allowed: data.get("emergency_messages_allowed") === "on",
      parent_daily_digest_enabled: data.get("parent_daily_digest_enabled") === "on",
      parent_ai_summary_enabled: data.get("parent_ai_summary_enabled") === "on",
      parent_category_channels: categoryChannels,
      push_category_preferences: categoryEnabled
    };
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/profile/communication-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      setMessage(response.ok ? "העדפות ההתראות נשמרו." : body.error ?? "שמירת ההעדפות נכשלה.");
    });
  }

  return (
    <form className="parent-preferences-panel" onSubmit={submit}>
      <div className="section-heading">
        <h2><BellRing size={18} /> איך תרצו לקבל עדכונים?</h2>
        <p>בחרו ערוצים לפי נושא. עדכוני בטיחות ותצפיתן נשלחים להורים רק אחרי בדיקה ואישור.</p>
      </div>

      <div className="parent-channel-switches">
        <label><input name="receive_push" type="checkbox" defaultChecked={preferences?.receive_push ?? true} /> התראות בטלפון</label>
        <label><input name="receive_email" type="checkbox" defaultChecked={preferences?.receive_email ?? true} /> מייל</label>
        <label><input name="receive_sms" type="checkbox" defaultChecked={preferences?.receive_sms ?? false} /> SMS</label>
        <label><input name="receive_whatsapp" type="checkbox" defaultChecked={preferences?.receive_whatsapp ?? false} /> וואטסאפ</label>
      </div>

      <div className="parent-channel-switches">
        <label><input name="critical_push_allowed" type="checkbox" defaultChecked={preferences?.critical_push_allowed ?? true} /> עדכונים דחופים</label>
        <label><input name="emergency_messages_allowed" type="checkbox" defaultChecked={preferences?.emergency_messages_allowed ?? true} /> הודעות חירום</label>
        <label><input name="parent_daily_digest_enabled" type="checkbox" defaultChecked={preferences?.parent_daily_digest_enabled ?? true} /> סיכום יומי</label>
        <label><input name="parent_ai_summary_enabled" type="checkbox" defaultChecked={preferences?.parent_ai_summary_enabled ?? true} /> סיכום חכם</label>
      </div>

      <div className="parent-category-preferences">
        {categories.map((category) => (
          <article key={category.key}>
            <div>
              <label className="parent-category-toggle">
                <input type="checkbox" checked={categoryEnabled[category.key]} onChange={(event) => setCategoryEnabled((current) => ({ ...current, [category.key]: event.target.checked }))} />
                <span>{category.label}</span>
              </label>
              <p>{category.text}</p>
            </div>
            <div className="parent-channel-pills">
              {channels.map((channel) => {
                const selected = (categoryChannels[category.key] ?? []).includes(channel.key);
                return <button className={selected ? "selected" : ""} type="button" onClick={() => toggleChannel(category.key, channel.key)} key={channel.key}>{channel.label}</button>;
              })}
            </div>
          </article>
        ))}
      </div>

      <div className="profile-actions">
        <span className="pill good"><CheckCircle2 size={14} /> {activeChannelCount} בחירות פעילות</span>
        <button className="button primary" disabled={pending} type="submit">{pending ? "שומר..." : "שמירת העדפות"}</button>
        {message ? <span className={message.includes("נשמרו") ? "payment-action-message" : "error-text"}>{message}</span> : null}
      </div>
    </form>
  );
}
