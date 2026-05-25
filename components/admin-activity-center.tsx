"use client";

import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";

export type AdminActivityItem = {
  type: string;
  title: string;
  meta: string;
  date?: string | null;
  tone?: string;
  severity?: string;
};

export function AdminActivityCenter({ items }: { items: AdminActivityItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.type))).filter(Boolean), [items]);
  const filtered = items.filter((item) => {
    const text = `${item.type} ${item.title} ${item.meta}`.toLowerCase();
    const itemTime = item.date ? new Date(item.date).getTime() : 0;
    const now = Date.now();
    const inRange =
      dateRange === "all" ||
      (dateRange === "today" && itemTime >= now - 24 * 60 * 60 * 1000) ||
      (dateRange === "week" && itemTime >= now - 7 * 24 * 60 * 60 * 1000) ||
      (dateRange === "month" && itemTime >= now - 30 * 24 * 60 * 60 * 1000);
    return (!query || text.includes(query.toLowerCase())) && (!category || item.type === category) && (!severity || item.tone === severity || item.severity === severity) && inRange;
  });
  const severityChips = [
    { value: "", label: "הכל" },
    { value: "bad", label: "קריטי" },
    { value: "warn", label: "דורש טיפול" },
    { value: "good", label: "תקין" },
    { value: "default", label: "כללי" }
  ];

  return (
    <article className="card activity-center-card">
      <div className="section-heading"><h2>מרכז פעילות</h2><p>פניות הורים, אירועי פיקוח, העלאות צוות, AI והודעות אחרונות.</p></div>
      <div className="activity-filters">
        <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש פעילות" /></label>
        <label><Filter size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">כל הקטגוריות</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <select value={dateRange} onChange={(event) => setDateRange(event.target.value)}><option value="all">כל התאריכים</option><option value="today">24 שעות</option><option value="week">7 ימים</option><option value="month">30 ימים</option></select>
      </div>
      <div className="severity-chip-row">{severityChips.map((chip) => <button className={severity === chip.value ? "severity-chip active" : "severity-chip"} type="button" onClick={() => setSeverity(chip.value)} key={chip.value || "all"}>{chip.label}</button>)}</div>
      {filtered.length === 0 ? <div className="empty-state"><strong>אין פעילות תואמת</strong><span>שנו פילטר או חיפוש כדי לראות אירועים נוספים.</span></div> : <div className="activity-timeline">{filtered.map((item, index) => <div className={`activity-item ${item.tone ?? "default"}`} key={`${item.type}-${item.title}-${index}`}><span>{item.type}</span><div><strong>{item.title}</strong><small>{item.meta} · {item.date ? new Date(item.date).toLocaleString("he-IL") : ""}</small></div></div>)}</div>}
    </article>
  );
}
