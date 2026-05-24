import Link from "next/link";
import { AlertTriangle, Bot, Camera, ClipboardCheck, Download, FileWarning, MapPinned, Settings, ShieldAlert, UserCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

const adminActions = [
  { href: "/dashboard/admin/leads", label: "לידים", icon: UsersRound },
  { href: "/dashboard/admin/kindergartens", label: "גני ילדים", icon: ShieldAlert },
  { href: "/dashboard/admin/inspectors", label: "מפקחים", icon: UserCheck },
  { href: "/dashboard/admin/procedures", label: "נהלים", icon: ClipboardCheck },
  { href: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", icon: FileWarning },
  { href: "/dashboard/admin/ai-events", label: "אירועי AI", icon: Bot },
  { href: "/dashboard/admin/cameras", label: "מצלמות", icon: Camera },
  { href: "/dashboard/admin/reports", label: "דוחות", icon: Download },
  { href: "/dashboard/admin/settings", label: "הגדרות", icon: Settings }
];

async function countRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
  logSupabaseError("count " + table, error);
  return error ? 0 : count ?? 0;
}

export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin dashboard", async () => {
    const supabase = await createClient();
    const [gardens, leads, inspectors, violations, complaints, cameras, gardenList] = await Promise.all([
      countRows(supabase, "gardens"),
      countRows(supabase, "leads"),
      countRows(supabase, "inspectors"),
      countRows(supabase, "violations"),
      countRows(supabase, "complaints"),
      countRows(supabase, "camera_streams"),
      supabase.from("gardens" as any).select("id, name, city, safe_status, last_inspection_score, next_inspection_at").limit(8)
    ]);
    logSupabaseError("admin garden list", gardenList.error);
    return { gardens, leads, inspectors, violations, complaints, cameras, gardenList: (gardenList.data ?? []) as any[], queryError: gardenList.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { gardens: 0, leads: 0, inspectors: 0, violations: 0, complaints: 0, cameras: 0, gardenList: [] as any[], queryError: null as string | null });
  const data = result.data;

  return (
    <DashboardShell role="admin" title="מרכז שליטה ארצי">
      <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Admin Control Center</p><h1>מרכז שליטה אדמין לכל המערכת.</h1><p>כל כרטיס וקישור מוביל לדף UI אמיתי, עם טעינה בטוחה ו-empty state אם אין נתונים.</p></div><div className="map-card"><MapPinned /><strong>ניווט תקין</strong><span>לא נפתח API גולמי</span></div></div>
      <AdminDataError message={result.error ?? data.queryError} />
      <div className="grid cols-4 dashboard-kpis"><StatCard label="גנים" value={data.gardens} tone="good" /><StatCard label="פקחים" value={data.inspectors} /><StatCard label="לידים" value={data.leads} tone="warn" /><StatCard label="ליקויים" value={data.violations} tone="bad" /></div>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות אדמין</h2><p>קישורים מתוקנים לכל דפי האדמין המרכזיים.</p></div><div className="quick-actions-grid">{adminActions.map((action) => <Link className="quick-action" href={action.href} key={action.href}><action.icon /><strong>{action.label}</strong><span>פתיחת דף ניהול</span></Link>)}</div></section>
      <section className="grid cols-3 risk-board"><article className="card risk-card"><ShieldAlert /><strong>גנים</strong><b>{data.gardens}</b><span>ניהול וסטטוס בטיחות</span></article><article className="card risk-card"><Camera /><strong>מצלמות</strong><b>{data.cameras}</b><span>חיבור, בריאות והרשאות</span></article><article className="card risk-card"><AlertTriangle /><strong>תלונות</strong><b>{data.complaints}</b><span>מעקב וטיפול</span></article></section>
      <section className="dashboard-section"><div className="section-heading"><h2>גנים אחרונים</h2><p>כניסה לפרופיל גן מלא.</p></div><div className="procedure-list">{data.gardenList.length === 0 ? <div className="empty-mini">אין גנים להצגה.</div> : data.gardenList.map((garden: any) => <Link className="card procedure-card" href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><span className="pill">{garden.city}</span><h3>{garden.name}</h3><p>ציון אחרון: {garden.last_inspection_score ?? "-"}</p></div><div className="procedure-meta"><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status}</span><span>צפייה בפרופיל</span></div></Link>)}</div></section>
    </DashboardShell>
  );
}
