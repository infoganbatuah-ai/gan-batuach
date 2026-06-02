import Link from "next/link";

export function ModuleListPage({ title, eyebrow, description, rows, emptyTitle, emptyText, primaryAction }: { title: string; eyebrow: string; description: string; rows: any[]; emptyTitle: string; emptyText: string; primaryAction?: { href: string; label: string } }) {
  return (
    <>
      <div className="dashboard-hero-card">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
        {primaryAction ? <Link className="button primary" href={primaryAction.href}>{primaryAction.label}</Link> : <span className="pill good">UI פעיל</span>}
      </div>
      <section className="dashboard-section">
        {rows.length === 0 ? <div className="empty-state"><strong>{emptyTitle}</strong><span>{emptyText}</span>{primaryAction ? <Link className="button secondary" href={primaryAction.href}>{primaryAction.label}</Link> : null}</div> : <div className="procedure-list">{rows.map((row, index) => <article className="card procedure-card" key={row.id ?? index}><div><span className="pill">{row.status ?? row.role ?? row.document_type ?? row.category ?? "פעיל"}</span><h3>{row.title ?? row.full_name ?? row.name ?? row.subject ?? row.report_type ?? "רשומה"}</h3><p>{row.description ?? row.city ?? row.email ?? row.document_type ?? row.severity ?? ""}</p><small>{row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : row.due_at ? new Date(row.due_at).toLocaleString("he-IL") : ""}</small></div><div className="procedure-meta">{row.href ? <Link className="button secondary" href={row.href}>פתיחה</Link> : null}<span className="pill">{row.priority ?? row.safe_status ?? row.status ?? "מעקב"}</span></div></article>)}</div>}
      </section>
    </>
  );
}
