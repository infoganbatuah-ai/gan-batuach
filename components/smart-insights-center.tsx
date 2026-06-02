"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BellRing, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import type { SmartInsight } from "@/lib/domain/smart-kindergarten-engine";

const severityClass: Record<string, string> = {
  info: "pill good",
  warning: "pill warn",
  urgent: "pill bad",
  critical: "pill bad"
};

export function SmartInsightsCenter({ insights }: { insights: SmartInsight[] }) {
  const [rows, setRows] = useState(insights);
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("open");
  const [message, setMessage] = useState<string | null>(null);
  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category))), [rows]);
  const filtered = rows.filter((row) => (category === "all" || row.category === category) && (status === "all" || (row.status ?? "open") === status));

  async function updateInsight(id: string | undefined, nextStatus: "handled" | "snoozed" | "dismissed") {
    if (!id) {
      setMessage("התובנה עדיין לא נשמרה במסד הנתונים. נסו לרענן בעוד רגע.");
      return;
    }
    const response = await fetch(`/api/smart-insights/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus, snoozeHours: 24 })
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "הפעולה נכשלה");
      return;
    }
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...(body.data ?? {}) } : row));
    setMessage(nextStatus === "handled" ? "התובנה סומנה כטופלה" : nextStatus === "snoozed" ? "התובנה הושהתה ל-24 שעות" : "התובנה הוסרה");
  }

  return (
    <>
      {message ? <div className="success-banner">{message}</div> : null}
      <section className="filter-bar">
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">כל הקטגוריות</option>
          {categories.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">פתוחות</option>
          <option value="snoozed">מושהות</option>
          <option value="handled">טופלו</option>
          <option value="all">הכל</option>
        </select>
      </section>
      <section className="dashboard-section">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Sparkles />
            <strong>אין תובנות פתוחות במסנן הזה</strong>
            <span>כשהמערכת תזהה משהו שדורש תשומת לב, הוא יופיע כאן עם פעולה ברורה.</span>
          </div>
        ) : (
          <div className="procedure-list">
            {filtered.map((item) => (
              <article className="card procedure-card" key={item.id ?? item.dedupe_key}>
                <div>
                  <span className={severityClass[item.severity] ?? "pill"}>{item.severity}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <small>{item.category} · {item.generated_at ? new Date(item.generated_at).toLocaleString("he-IL") : "נוצר עכשיו"}</small>
                </div>
                <div className="procedure-meta">
                  <Link className="button primary" href={item.action_url}><BellRing size={14} /> {item.recommended_action}</Link>
                  <button className="button secondary" type="button" onClick={() => updateInsight(item.id, "handled")}><CheckCircle2 size={14} /> טופל</button>
                  <button className="button secondary" type="button" onClick={() => updateInsight(item.id, "snoozed")}><Clock3 size={14} /> הזכרי מחר</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
