"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Smartphone, Mail, Bell, MessageCircle } from "lucide-react";

type Channel = "whatsapp" | "sms" | "email" | "push";

type ProviderOption = {
  channel: Channel;
  provider: string;
  display_name?: string | null;
  status?: string | null;
};

const channels: Array<{ key: Channel; label: string; icon: typeof MessageCircle }> = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "push", label: "Push", icon: Bell }
];

const templateLabels: Record<string, string> = {
  welcome: "ברוכים הבאים",
  password_reset: "איפוס סיסמה",
  kindergarten_approval: "אישור גן",
  correction_required: "נדרש תיקון",
  onboarding_completed: "קליטה הושלמה",
  parent_invitation: "הזמנת הורה",
  staff_invitation: "הזמנת צוות",
  alerts: "התראה"
};

export function AdminCommunicationsTestPanel({ providers, templates }: { providers: ProviderOption[]; templates: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [provider, setProvider] = useState("");
  const [recipient, setRecipient] = useState("");
  const [templateKind, setTemplateKind] = useState(templates[0] ?? "welcome");
  const [message, setMessage] = useState<string | null>(null);

  const providerOptions = useMemo(() => providers.filter((item) => item.channel === channel), [providers, channel]);

  async function runTest() {
    setMessage(null);
    const selectedProvider = provider || providerOptions.find((item) => item.provider.startsWith("mock_"))?.provider || providerOptions[0]?.provider;
    startTransition(async () => {
      const response = await fetch("/api/admin/communications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          provider: selectedProvider,
          recipient: recipient || undefined,
          template_kind: templateKind
        })
      });
      const payload = await response.json().catch(() => ({}));
      setMessage(response.ok ? "בדיקה נשמרה במצב mock. לא נשלחה הודעה אמיתית." : payload.error || "הבדיקה נכשלה");
      if (response.ok) router.refresh();
    });
  }

  return (
    <section className="communication-test-panel">
      <div>
        <p className="premium-eyebrow">בדיקות</p>
        <h2>שליחת ניסיון בטוחה</h2>
        <p>הבדיקה יוצרת רשומת מסירה בלבד. אין שליחה אמיתית עד להפעלה מפורשת של ספק.</p>
      </div>

      <div className="communication-channel-tabs" role="tablist" aria-label="ערוצי תקשורת">
        {channels.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={channel === item.key ? "active" : ""}
              key={item.key}
              type="button"
              onClick={() => {
                setChannel(item.key);
                setProvider("");
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="communication-test-grid">
        <label>
          ספק
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="">בחירה אוטומטית</option>
            {providerOptions.map((item) => (
              <option key={item.provider} value={item.provider}>
                {item.display_name ?? item.provider} · {item.status ?? "not_configured"}
              </option>
            ))}
          </select>
        </label>
        <label>
          תבנית
          <select value={templateKind} onChange={(event) => setTemplateKind(event.target.value)}>
            {templates.map((item) => <option key={item} value={item}>{templateLabels[item] ?? item}</option>)}
          </select>
        </label>
        <label>
          נמען לבדיקה
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            placeholder={channel === "email" ? "name@example.com" : "0500000000"}
          />
        </label>
        <button className="button primary" type="button" disabled={isPending} onClick={runTest}>
          <Send size={18} />
          {isPending ? "בודק..." : "הרצת בדיקה"}
        </button>
      </div>

      {message ? <div className="communication-test-message">{message}</div> : null}
    </section>
  );
}
