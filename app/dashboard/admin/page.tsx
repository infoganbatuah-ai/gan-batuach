import Link from "next/link";
import { AlertTriangle, Bot, Building2, Camera, ClipboardCheck, Download, FileWarning, MapPinned, Megaphone, ShieldAlert, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const adminActions = [
  { href: "/api/tasks", label: "יצירת משימה", icon: ClipboardCheck },
  { href: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", icon: FileWarning },
  { href: "/api/admin/procedures", label: "נהלים מחייבים", icon: ShieldAlert },
  { href: "/api/admin/push-notices", label: "הודעה ארצית", icon: Megaphone },
  { href: "/api/admin/reports", label: "ייצוא דוחות", icon: Download },
  { href: "/dashboard/admin/ai-observer", label: "תצפיתן AI", icon: Bot }
];

export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [gardens, leads, complaints, violations, inspectors, unsafe, cameras, aiAlerts, docs] = await Promise.all([
    supabase.from("gardens").select("*", { count: "exact", head: true }),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("complaints").select("*", { count: "exact", head: true }).neq("status", "closed"),
    supabase.from("violations").select("*", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("inspectors").select("*", { count: "exact", head: true }),
    supabase.from("unsafe_gardens" as any).select("name, city, last_inspection_score, safe_status, open_violations_count").limit(8),
    supabase.from("camera_streams").select("*", { count: "exact", head: true }).neq("status", "online"),
    supabase.from("ai_alerts").select("title, body, recipient_role, created_at, ai_events(event_type, severity)").order("created_at", { ascending: false }).limit(6),
    supabase.from("documents").select("name, document_type, expires_at, status, gardens(name, city)").limit(6)
  ]);

  return (
    <DashboardShell role="admin" title="מרכז שליטה ארצי">
      <div className="dashboard-hero-card admin-hero-card">
        <div><p className="eyebrow">Private Ministry of Education</p><h1>תמונת מצב ארצית לגנים פרטיים.</h1><p>פיקוח, לידים, תקלות מצלמה, AI, תלונות, מסמכים, ליקויים ומשימות במקום אחד.</p></div>
        <div className="map-card"><MapPinned /><strong>פריסה לפי ערים</strong><span>חיבור לפילטר עירוני ורשימת גנים בסיכון</span></div>
      </div>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="גנים במערכת" value={gardens.count ?? 0} tone="good" />
        <StatCard label="פקחים" value={inspectors.count ?? 0} />
        <StatCard label="לידים" value={leads.count ?? 0} tone="warn" />
        <StatCard label="ליקויים פתוחים" value={violations.count ?? 0} tone="bad" />
      </div>

      <section className="dashboard-section"><div className="section-heading"><h2>פעולות אדמין</h2><p>יצירת משימות, נהלים, קמפיינים, טפסי פיקוח ודוחות.</p></div><div className="quick-actions-grid">{adminActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>פתיחה, מעקב, צפייה, תיעוד והסלמה.</span></Link>)}</div></section>

      <section className="grid cols-3 risk-board">
        <article className="card risk-card"><ShieldAlert /><strong>גנים לא בטוחים</strong><b>{((unsafe.data as any[]) ?? []).length}</b><span>מתחת לציון 8 או עם ליקויים קריטיים</span></article>
        <article className="card risk-card"><Camera /><strong>בעיות מצלמה</strong><b>{cameras.count ?? 0}</b><span>Offline, covered, frozen, black frame</span></article>
        <article className="card risk-card"><AlertTriangle /><strong>תלונות פתוחות</strong><b>{complaints.count ?? 0}</b><span>מעקב SLA לפי חומרה</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>גנים בסיכון</h2><p>רשימת Drill-down לפי עיר, ציון וליקויים פתוחים.</p></div>{(((unsafe.data as any[]) ?? []).length === 0) ? <div className="empty-mini">אין גנים בסיכון כרגע.</div> : ((unsafe.data as any[]) ?? []).map((garden) => <div className="list-item" key={garden.name}><div><strong>{garden.name}</strong><span>{garden.city} · ציון {garden.last_inspection_score ?? "-"}</span></div><span className="pill bad">{garden.open_violations_count} ליקויים</span></div>)}</article>
        <article className="card action-panel"><div className="section-heading"><h2>התראות AI ומצלמות</h2><p>אירועים שדורשים טיפול, אישור או סימון false positive.</p></div>{(aiAlerts.data ?? []).length === 0 ? <div className="empty-mini">אין התראות AI חדשות.</div> : (aiAlerts.data ?? []).map((alert: any) => <div className="list-item" key={`${alert.title}-${alert.created_at}`}><div><strong>{alert.title}</strong><span>{alert.ai_events?.event_type ?? alert.body}</span></div><span className="pill bad">{alert.ai_events?.severity ?? alert.recipient_role}</span></div>)}</article>
      </section>

      <section className="dashboard-section"><div className="section-heading"><h2>מסמכים ותאימות</h2><p>מעקב אחרי תוקף מסמכים, בדיקות רקע, תעודות יושר ונהלי חובה.</p></div><div className="document-strip">{(docs.data ?? []).length === 0 ? <div className="empty-mini">אין מסמכים להצגה.</div> : (docs.data ?? []).map((doc: any) => <div className="document-chip" key={`${doc.name}-${doc.expires_at}`}><strong>{doc.name}</strong><span>{doc.gardens?.name ?? "גן"} · {doc.status ?? doc.document_type}</span></div>)}</div></section>
    </DashboardShell>
  );
}
