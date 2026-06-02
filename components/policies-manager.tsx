"use client";

import { useState, type FormEvent } from "react";

type Policy = Record<string, any>;
type Acceptance = Record<string, any>;

const labels: Record<string, string> = {
  kindergarten: "תקנון גני ילדים",
  parent: "תקנון הורים",
  inspector: "תקנון מפקחים",
  staff: "תקנון צוות"
};

export function PoliciesManager({ policies, acceptances }: { policies: Policy[]; acceptances: Acceptance[] }) {
  const [rows, setRows] = useState(policies);
  const [activeType, setActiveType] = useState("kindergarten");
  const current = rows.find((policy) => policy.policy_type === activeType && policy.active) ?? rows.find((policy) => policy.policy_type === activeType);
  const accepted = acceptances.filter((item) => item.policy_type === activeType);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/admin/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policy_type: activeType, title: String(data.title), body: String(data.body) }) });
    const body = await response.json();
    if (response.ok) setRows((existing) => [body.data, ...existing.map((p) => p.policy_type === activeType ? { ...p, active: false } : p)]);
  }
  return <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>תקנונים</h2><div className="admin-tabs">{Object.entries(labels).map(([type, label]) => <button className={activeType === type ? "tab active" : "tab"} key={type} onClick={() => setActiveType(type)}>{label}</button>)}</div><form className="form" onSubmit={publish}><label>כותרת<input name="title" defaultValue={current?.title ?? labels[activeType]} required /></label><label>טקסט<textarea name="body" rows={12} defaultValue={current?.body ?? ""} required /></label><button className="button primary">פרסום גרסה חדשה</button></form></article><article className="card action-panel"><h2>גרסה וקבלות</h2><div className="list-item"><div><strong>{current?.title ?? labels[activeType]}</strong><span>גרסה {current?.version ?? 1} · {current?.published_at ? new Date(current.published_at).toLocaleString("he-IL") : "טיוטה"}</span></div><span className="pill good">{current?.active ? "פעיל" : "לא פעיל"}</span></div><h3>רשימת אישורים</h3>{accepted.length === 0 ? <div className="empty-mini">אין אישורים עדיין.</div> : accepted.map((item) => <div className="list-item" key={item.id}><div><strong>{item.profiles?.full_name ?? item.user_id}</strong><span>גרסה {item.version} · {new Date(item.accepted_at).toLocaleString("he-IL")}</span></div><span className="pill">אושר</span></div>)}</article></section>;
}
