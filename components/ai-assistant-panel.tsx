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
  session_id?: string | null;
  title: string;
  summary: string;
  daily_briefing?: string;
  permission_summary?: string;
  context_sources?: string[];
  notification_intelligence?: {
    urgent: number;
    important: number;
    informational: number;
  };
  suggestions: Suggestion[];
  prompts: string[];
  answers?: Record<string, string>;
};

type Interaction = {
  prompt: string;
  answer: string;
  at: string;
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
  const [customPrompt, setCustomPrompt] = useState("");
  const [recentInteractions, setRecentInteractions] = useState<Interaction[]>([]);

  useEffect(() => {
    try {
      setRecentInteractions(JSON.parse(localStorage.getItem(`gan-batuach-ai-${role}`) || "[]"));
    } catch {
      setRecentInteractions([]);
    }
  }, [role]);

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
    if (data.answers?.[selectedPrompt]) return data.answers[selectedPrompt];
    const suggestionText = data.suggestions.map((suggestion) => `${suggestion.title}: ${suggestion.body}`).join(" · ");
    return `לפי הנתונים הקיימים במערכת: ${suggestionText || data.summary}`;
  }, [data, selectedPrompt]);

  function choosePrompt(prompt: string) {
    setSelectedPrompt(prompt);
    if (!data) return;
    const suggestionText = data.suggestions.map((suggestion) => `${suggestion.title}: ${suggestion.body}`).join(" · ");
    const answer = data.answers?.[prompt] ?? `לפי הנתונים הקיימים במערכת: ${suggestionText || data.summary}`;
    const next = [{ prompt, answer, at: new Date().toISOString() }, ...recentInteractions.filter((item) => item.prompt !== prompt)].slice(0, 6);
    setRecentInteractions(next);
    localStorage.setItem(`gan-batuach-ai-${role}`, JSON.stringify(next));
    if (data.session_id) {
      fetch("/api/assistant/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: data.session_id,
          prompt,
          response: answer,
          context_sources: data.context_sources ?? [],
          suggested_actions: data.suggestions.slice(0, 5)
        })
      }).catch(() => undefined);
    }
  }

  function askCustom() {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    choosePrompt(prompt);
    setCustomPrompt("");
  }

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
          <article className="assistant-summary-card">
            <span className="eyebrow">תדרוך יומי</span>
            <p>{data.daily_briefing ?? "התדרוך מבוסס על הנתונים המותרים לתפקיד שלך."}</p>
          </article>
          <section>
            <h3>גבולות מידע</h3>
            <div className="assistant-context-card">
              <CheckCircle2 size={18} />
              <div><strong>הרשאות נשמרות</strong><span>{data.permission_summary ?? "העוזר משתמש רק במידע שהמשתמש רשאי לראות."}</span></div>
            </div>
            {data.context_sources?.length ? <div className="assistant-source-list">{data.context_sources.map((source) => <span key={source}>{source}</span>)}</div> : null}
          </section>
          {data.notification_intelligence ? <section>
            <h3>עדיפות התראות</h3>
            <div className="assistant-priority-grid">
              <span className="bad">דחוף <b>{data.notification_intelligence.urgent}</b></span>
              <span className="warn">חשוב <b>{data.notification_intelligence.important}</b></span>
              <span className="good">מידע <b>{data.notification_intelligence.informational}</b></span>
            </div>
          </section> : null}
          <section>
            <h3>המלצה הקשרית</h3>
            <div className="assistant-context-card">
              <Sparkles size={18} />
              <div><strong>{data.suggestions[0]?.title ?? "אין פעולה דחופה"}</strong><span>{data.suggestions[0]?.body ?? "המערכת לא זיהתה פעולה דחופה לפי הנתונים הזמינים."}</span></div>
            </div>
          </section>
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
              {data.prompts.map((prompt) => <button className={selectedPrompt === prompt ? "chip active" : "chip"} type="button" key={prompt} onClick={() => choosePrompt(prompt)}>{prompt}</button>)}
            </div>
            <div className="assistant-free-question">
              <input value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="שאלו: מה דורש טיפול היום? מי לא שילם? אילו מסמכים חסרים?" />
              <button className="button secondary tiny" type="button" onClick={askCustom}>ענה לפי הנתונים</button>
            </div>
            {selectedAnswer ? <div className="assistant-answer"><strong>{selectedPrompt}</strong><p>{selectedAnswer}</p></div> : null}
          </section>
          <section>
            <h3>שיחות אחרונות</h3>
            {recentInteractions.length === 0 ? <div className="empty-mini">עדיין אין שאלות אחרונות. בחרו שאלה מומלצת כדי לשמור אינטראקציה.</div> : <div className="assistant-history-list">{recentInteractions.map((item) => <button type="button" key={`${item.prompt}-${item.at}`} onClick={() => setSelectedPrompt(item.prompt)}><strong>{item.prompt}</strong><span>{new Date(item.at).toLocaleString("he-IL")}</span></button>)}</div>}
          </section>
        </> : null}
      </aside>
    </>
  );
}
