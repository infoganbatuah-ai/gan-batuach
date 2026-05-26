"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import type { UserRole } from "@/lib/roles";

type Suggestion = {
  title: string;
  body: string;
  href: string;
  tone?: "good" | "warn" | "bad";
};

type AssistantSummary = {
  provider: "pending" | "connected";
  role: UserRole;
  title: string;
  summary: string;
  suggestions: Suggestion[];
  prompts: string[];
};

const roleNames: Record<UserRole, string> = {
  admin: "אדמין",
  inspector: "פקח",
  manager: "מנהלת גן",
  owner: "בעלים",
  staff: "צוות",
  parent: "הורה"
};

export function AIAssistantPanel({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssistantSummary | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data || loading) return;
    setLoading(true);
    setError(null);
    fetch("/api/assistant/summary")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "לא ניתן לטעון את העוזר כרגע");
        setData(body.data as AssistantSummary);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "לא ניתן לטעון את העוזר כרגע"))
      .finally(() => setLoading(false));
  }, [open, data, loading]);

  const selectedAnswer = useMemo(() => {
    if (!selectedPrompt || !data) return null;
    const suggestionText = data.suggestions.map((suggestion) => `${suggestion.title}: ${suggestion.body}`).join(" · ");
    return `לפי הנתונים הקיימים במערכת: ${suggestionText || data.summary}`;
  }, [data, selectedPrompt]);

  return (
    <>
      <button className="ai-assistant-fab" type="button" onClick={() => setOpen(true)} aria-label="פתיחת עוזר גן בטוח AI">
        <Sparkles size={18} />
        <span>עוזר גן בטוח AI</span>
      </button>
      {open ? <div className="ai-assistant-backdrop" onClick={() => setOpen(false)} /> : null}
      <aside className={open ? "ai-assistant-panel open" : "ai-assistant-panel"} aria-hidden={!open}>
        <div className="assistant-header">
          <div><span className="pill good"><Bot size={14} /> {roleNames[role]}</span><h2>עוזר גן בטוח AI</h2><p>סיכום תפעולי חכם לפי ההרשאות והנתונים שלך.</p></div>
          <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="סגירה"><X size={18} /></button>
        </div>
        {loading ? <div className="assistant-loading"><Loader2 className="spin" /><strong>טוען סיכום נתונים...</strong></div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
        {data ? <>
          <div className="provider-pending">
            <Sparkles size={18} />
            <div><strong>{data.provider === "connected" ? "AI מחובר" : "AI provider pending"}</strong><span>בשלב זה הסיכום מבוסס חוקים ונתוני מערכת בלבד. אין כאן תשובה חיה מספק AI חיצוני.</span></div>
          </div>
          <article className="assistant-summary-card">
            <span className="eyebrow">{data.title}</span>
            <p>{data.summary}</p>
          </article>
          <section>
            <h3>פעולות מומלצות</h3>
            <div className="assistant-suggestion-list">
              {data.suggestions.map((suggestion) => <Link className={`assistant-suggestion-card ${suggestion.tone ?? "warn"}`} href={suggestion.href} key={`${suggestion.title}-${suggestion.href}`}>
                <CheckCircle2 size={18} />
                <div><strong>{suggestion.title}</strong><span>{suggestion.body}</span></div>
              </Link>)}
            </div>
          </section>
          <section>
            <h3>שאלות מומלצות</h3>
            <div className="assistant-prompt-row">
              {data.prompts.map((prompt) => <button className={selectedPrompt === prompt ? "chip active" : "chip"} type="button" key={prompt} onClick={() => setSelectedPrompt(prompt)}>{prompt}</button>)}
            </div>
            {selectedAnswer ? <div className="assistant-answer"><strong>{selectedPrompt}</strong><p>{selectedAnswer}</p></div> : null}
          </section>
        </> : null}
      </aside>
    </>
  );
}
