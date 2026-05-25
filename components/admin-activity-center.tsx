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
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.type))).filter(Boolean), [items]);
  const filtered = items.filter((item) => {
    const text = `${item.type} ${item.title} ${item.meta}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!category || item.type === category) && (!severity || item.tone === severity || item.severity === severity);
  });

  return (
    <article className="card activity-center-card">
      <div className="section-heading"><h2>מרכז פעילות</h2><p>פניות הורים, אירועי פיקוח, העלאות צוות, AI והודעות אחרונות.</p></div>
      <div className="activity-filters">
        <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש פעילות" /></label>
        <label><Filter size={16} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">כל הקטגוריות</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">כל החומרות</option><option value="bad">חמור</option><option value="warn">דורש טיפול</option><option value="good">תקין</option><option value="default">כללי</option></select>
      </div>
      {filtered.length === 0 ? <div className="empty-state"><strong>אין פעילות תואמת</strong><span>שנו פילטר או חיפוש כדי לראות אירועים נוספים.</span></div> : <div className="activity-timeline">{filtered.map((item, index) => <div className={`activity-item ${item.tone ?? "default"}`} key={`${item.type}-${item.title}-${index}`}><span>{item.type}</span><div><strong>{item.title}</strong><small>{item.meta} · {item.date ? new Date(item.date).toLocaleString("he-IL") : ""}</small></div></div>)}</div>}
    </article>
  );
}
