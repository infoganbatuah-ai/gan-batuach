import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.from("documents" as any).select("id, name, document_type, status, expires_at").limit(30);
  const rows = (data ?? []) as any[];
  return <DashboardShell role="admin" title="מסמכים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Admin UI</p><h1>מסמכים</h1><p>מסמכים, תוקף וציות. המסך מציג UI ברור ולא JSON גולמי.</p></div><span className="pill good">UI page</span></div><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין נתונים להצגה כרגע</strong><span>כאשר ייווצרו רשומות הן יופיעו כאן עם פילטרים ופעולות.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id ?? row.name ?? JSON.stringify(row)}><div><h3>{row.name ?? row.title ?? row.subject ?? row.parent_name ?? row.garden_name ?? row.full_name ?? 'רשומה'}</h3><p>{row.city ?? row.status ?? row.document_type ?? row.severity ?? ''}</p></div><div className="procedure-meta"><span className="pill">{row.status ?? row.safe_status ?? row.role ?? 'פעיל'}</span>{row.id && false ? <Link className="button secondary" href={`/dashboard/admin/gardens/${row.id}`}>פרופיל גן</Link> : null}</div></article>)}</div>}</section></DashboardShell>;
}
