"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Brain, Camera, Cloud, Database, Mail, MessageCircle, Send, Server, Smartphone } from "lucide-react";

type IntegrationType = "email" | "whatsapp" | "sms" | "push" | "supabase" | "vercel" | "camera_gateway" | "ai_provider";

type IntegrationOption = {
  integration_type: IntegrationType;
  provider: string;
  status?: string | null;
};

const integrationTabs: Array<{ key: IntegrationType; label: string; icon: typeof Mail }> = [
  { key: "email", label: "Email", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "sms", label: "SMS", icon: Smartphone },
  { key: "push", label: "Push", icon: Bell },
  { key: "supabase", label: "Supabase", icon: Database },
  { key: "vercel", label: "Vercel", icon: Cloud },
  { key: "camera_gateway", label: "Video", icon: Camera },
  { key: "ai_provider", label: "AI", icon: Brain }
];

function placeholderFor(type: IntegrationType) {
  if (type === "email") return "admin@example.com";
  if (type === "push") return "profile id או email של אדמין";
  if (type === "supabase" || type === "vercel" || type === "camera_gateway" || type === "ai_provider") return "לא נדרש";
  return "0500000000";
}

export function AdminIntegrationsTestPanel({ integrations }: { integrations: IntegrationOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [integrationType, setIntegrationType] = useState<IntegrationType>("email");
  const [provider, setProvider] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const providerOptions = useMemo(() => integrations.filter((item) => item.integration_type === integrationType), [integrations, integrationType]);

  async function runTest() {
    setMessage(null);
    const selectedProvider = provider || providerOptions[0]?.provider;
    startTransition(async () => {
      const response = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_type: integrationType,
          provider: selectedProvider,
          recipient: recipient || undefined
        })
      });
      const payload = await response.json().catch(() => ({}));
      setMessage(response.ok ? "בדיקה בטוחה נשמרה. לא בוצעה הפעלה אמיתית." : payload.error || "הבדיקה נכשלה");
      if (response.ok) router.refresh();
    });
  }

  return (
    <section className="communication-test-panel">
      <div>
        <p className="premium-eyebrow">בדיקה בטוחה</p>
        <h2>בדיקת אינטגרציה</h2>
        <p>הבדיקה נשארת mock/dry-run ודורשת נמען מאושר או את פרטי האדמין המחובר.</p>
      </div>

      <div className="communication-channel-tabs" role="tablist" aria-label="אינטגרציות">
        {integrationTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={integrationType === item.key ? "active" : ""}
              key={item.key}
              type="button"
              onClick={() => {
                setIntegrationType(item.key);
                setProvider("");
                setRecipient("");
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
              <option key={`${item.integration_type}-${item.provider}`} value={item.provider}>
                {item.provider} · {item.status ?? "not_configured"}
              </option>
            ))}
          </select>
        </label>
        <label>
          נמען מאושר
          <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={placeholderFor(integrationType)} />
        </label>
        <button className="button primary" type="button" disabled={isPending} onClick={runTest}>
          <Send size={18} />
          {isPending ? "בודק..." : "הרצת בדיקה"}
        </button>
      </div>

      {integrationType !== "email" && integrationType !== "whatsapp" && integrationType !== "sms" && integrationType !== "push" ? (
        <div className="communication-test-message"><Server size={16} /> בדיקות תשתית לא שולחות הודעות ולא דורשות נמען.</div>
      ) : null}
      {message ? <div className="communication-test-message">{message}</div> : null}
    </section>
  );
}
