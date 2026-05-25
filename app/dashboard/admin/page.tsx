import Link from "next/link";
import { Activity, AlertTriangle, BellRing, Bot, Camera, ClipboardCheck, Download, FileWarning, FileX2, HeartPulse, MapPinned, MessageSquareWarning, Settings, ShieldAlert, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
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
  { href: "/dashboard/admin/notifications", label: "התראות", icon: BellRing },
  { href: "/dashboard/admin/cameras", label: "מצלמות", icon: Camera },
  { href: "/dashboard/admin/reports", label: "דוחות", icon: Download },
  { href: "/dashboard/admin/settings", label: "הגדרות", icon: Settings }
];

async function countRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
  logSupabaseError("count " + table, error);
  return error ? 0 : count ?? 0;
}

async function countFiltered(supabase: Awaited<ReturnType<typeof createClient>>, table: string, apply: (query: any) => any) {
  const query = apply(supabase.from(table as any).select("*", { count: "exact", head: true }));
  const { count, error } = await query;
  logSupabaseError("count " + table, error);
  return error ? 0 : count ?? 0;
}

function statusTone(score: number): "good" | "warn" | "bad" {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function statusText(tone: "good" | "warn" | "bad") {
  return tone === "good" ? "תקין" : tone === "warn" ? "דורש תשומת לב" : "חריג";
}

export default async function AdminDashboard() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin dashboard", async () => {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const [gardens, activeGardens, children, leads, inspectors, violations, complaints, cameras, cameraIssues, aiAlerts, notifications, incidents, lateInspections, missingDocuments, staffTotal, staffApproved, gardenList, recentComplaints, recentInspections, recentDocuments, recentAiEvents, recentMessages] = await Promise.all([
      countRows(supabase, "gardens"),
      countFiltered(supabase, "gardens", (query) => query.eq("status", "active")),
      countRows(supabase, "children"),
      countRows(supabase, "leads"),
      countRows(supabase, "inspectors"),
      countRows(supabase, "violations"),
      countRows(supabase, "complaints"),
      countRows(supabase, "camera_streams"),
      countFiltered(supabase, "camera_streams", (query) => query.in("status", ["offline", "covered", "frozen", "black_frame", "error", "failed"])),
      countFiltered(supabase, "ai_events", (query) => query.in("status", ["open", "in_progress"]).in("severity", ["high", "critical"])),
      countRows(supabase, "notifications"),
      countRows(supabase, "incident_reports"),
      countFiltered(supabase, "required_inspections", (query) => query.lt("due_at", now).neq("status", "completed")),
      countFiltered(supabase, "documents", (query) => query.in("status", ["missing", "expired", "rejected"])),
      countRows(supabase, "staff"),
      countFiltered(supabase, "staff", (query) => query.eq("approved_to_work", true)),
      supabase.from("gardens" as any).select("id, name, city, safe_status, last_inspection_score, next_inspection_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("complaints" as any).select("id, subject, severity, status, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("inspections" as any).select("id, status, weighted_score, completed_at, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("documents" as any).select("id, name, status, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("ai_events" as any).select("id, event_type, severity, status, detected_at, gardens(name)").order("detected_at", { ascending: false }).limit(4),
      supabase.from("messages" as any).select("id, subject, treatment_status, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4)
    ]);
    logSupabaseError("admin garden list", gardenList.error);
    [recentComplaints, recentInspections, recentDocuments, recentAiEvents, recentMessages].forEach((query, index) => logSupabaseError("admin activity " + index, query.error));
    return { gardens, activeGardens, children, leads, inspectors, violations, complaints, cameras, cameraIssues, aiAlerts, notifications, incidents, lateInspections, missingDocuments, staffTotal, staffApproved, gardenList: (gardenList.data ?? []) as any[], recentComplaints: recentComplaints.data ?? [], recentInspections: recentInspections.data ?? [], recentDocuments: recentDocuments.data ?? [], recentAiEvents: recentAiEvents.data ?? [], recentMessages: recentMessages.data ?? [], queryError: gardenList.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { gardens: 0, activeGardens: 0, children: 0, leads: 0, inspectors: 0, violations: 0, complaints: 0, cameras: 0, cameraIssues: 0, aiAlerts: 0, notifications: 0, incidents: 0, lateInspections: 0, missingDocuments: 0, staffTotal: 0, staffApproved: 0, gardenList: [] as any[], recentComplaints: [] as any[], recentInspections: [] as any[], recentDocuments: [] as any[], recentAiEvents: [] as any[], recentMessages: [] as any[], queryError: null as string | null });
  const data = result.data;
  const staffCompliance = data.staffTotal > 0 ? Math.round((data.staffApproved / data.staffTotal) * 100) : 100;
  const issueLoad = data.lateInspections + data.aiAlerts + data.cameraIssues + data.missingDocuments + data.violations;
  const healthScore = Math.max(0, Math.min(100, 100 - data.lateInspections * 8 - data.aiAlerts * 6 - data.cameraIssues * 5 - data.missingDocuments * 2 - Math.max(0, 100 - staffCompliance) / 2));
  const tone = statusTone(healthScore);
  const onboardingCompleted = [data.activeGardens > 0, data.inspectors > 0, data.gardens === 0 || data.lateInspections === 0, data.cameraIssues === 0, data.missingDocuments === 0, staffCompliance >= 80].filter(Boolean).length;
  const onboardingPercent = Math.round((onboardingCompleted / 6) * 100);
  const activityItems = [
    ...data.recentComplaints.map((item: any) => ({ type: "פנייה", title: item.subject, meta: `${item.gardens?.name ?? "ללא גן"} · ${item.severity} · ${item.status}`, date: item.created_at, tone: item.severity === "critical" || item.severity === "high" ? "bad" : "warn" })),
    ...data.recentInspections.map((item: any) => ({ type: "פיקוח", title: item.gardens?.name ?? "ביקורת", meta: `סטטוס ${item.status} · ציון ${item.weighted_score ?? "-"}`, date: item.completed_at ?? item.created_at, tone: Number(item.weighted_score ?? 10) < 8 ? "bad" : "good" })),
    ...data.recentDocuments.map((item: any) => ({ type: "מסמך", title: item.name, meta: `${item.gardens?.name ?? "כללי"} · ${item.status}`, date: item.created_at, tone: item.status === "valid" ? "good" : "warn" })),
    ...data.recentAiEvents.map((item: any) => ({ type: "AI", title: item.event_type, meta: `${item.gardens?.name ?? "גן"} · ${item.severity} · ${item.status}`, date: item.detected_at, tone: item.severity === "critical" || item.severity === "high" ? "bad" : "warn" })),
    ...data.recentMessages.map((item: any) => ({ type: "הודעה", title: item.subject, meta: `${item.gardens?.name ?? "מערכת"} · ${item.treatment_status}`, date: item.created_at, tone: "default" }))
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()).slice(0, 10);

  return (
    <DashboardShell role="admin" title="מרכז שליטה ארצי">
      <div className="dashboard-hero-card admin-hero-card premium-control-hero"><div><p className="eyebrow">Admin Control Center</p><h1>מרכז שליטה חי לכל גן בטוח.</h1><p>תמונת מצב אחת לגנים פעילים, ילדים, פיקוחים, מצלמות, מסמכים, צוות ותצפיתן דיגיטלי.</p></div><div className="map-card"><MapPinned /><strong>{data.activeGardens}/{data.gardens} גנים פעילים</strong><span>ניווט UI מלא, ללא API גולמי</span></div></div>
      <AdminDataError message={result.error ?? data.queryError} />
      <section className={`system-status-banner status-${tone}`}><div><ShieldCheck /><strong>סטטוס מערכת: {statusText(tone)}</strong><span>ציון בריאות {Math.round(healthScore)}%. עומס חריגים פעיל: {issueLoad} פריטים לטיפול.</span></div><Link className="button secondary" href="/dashboard/admin/system-health">פתיחת בריאות מערכת</Link></section>
      <div className="grid cols-4 dashboard-kpis premium-kpis">
        <StatCard label="גנים פעילים" value={data.activeGardens} tone="good" />
        <StatCard label="ילדים במערכת" value={data.children} />
        <StatCard label="פיקוחים באיחור" value={data.lateInspections} tone={data.lateInspections > 0 ? "bad" : "good"} />
        <StatCard label="התראות AI חמורות" value={data.aiAlerts} tone={data.aiAlerts > 0 ? "bad" : "good"} />
        <StatCard label="בעיות מצלמה" value={data.cameraIssues} tone={data.cameraIssues > 0 ? "warn" : "good"} />
        <StatCard label="מסמכים חסרים/פגי תוקף" value={data.missingDocuments} tone={data.missingDocuments > 0 ? "warn" : "good"} />
        <StatCard label="ציות צוות" value={`${staffCompliance}%`} tone={staffCompliance >= 80 ? "good" : "warn"} />
        <StatCard label="סטטוס מערכת" value={`${Math.round(healthScore)}%`} tone={tone} />
      </div>
      <section className="grid cols-2 dashboard-panels">
        <article className="card control-progress-card"><div className="section-heading"><h2><HeartPulse size={20} /> התקדמות הפעלה</h2><p>מדד חי לפי גנים פעילים, פקחים, מצלמות, מסמכים, צוות ופיקוח.</p></div><div className="mega-progress"><strong>{onboardingPercent}%</strong><span><i style={{ width: `${onboardingPercent}%` }} /></span></div><div className="checklist-row"><label><input type="checkbox" checked={data.activeGardens > 0} readOnly /> יש גנים פעילים<span>לפחות גן אחד פעיל במערכת.</span></label></div><div className="checklist-row"><label><input type="checkbox" checked={data.inspectors > 0} readOnly /> יש פקחים<span>שיוך פקחים מאפשר פיקוח חודשי.</span></label></div><div className="checklist-row"><label><input type="checkbox" checked={data.missingDocuments === 0} readOnly /> אין מסמכים חסרים<span>מסמכים חסרים מורידים מוכנות.</span></label></div></article>
        <article className="card activity-center-card"><div className="section-heading"><h2><Activity size={20} /> מרכז פעילות</h2><p>פניות הורים, אירועי פיקוח, העלאות צוות, AI והודעות אחרונות.</p></div>{activityItems.length === 0 ? <div className="empty-state"><strong>אין פעילות אחרונה</strong><span>כאשר ייכנסו פניות, מסמכים, הודעות או אירועי AI, הם יופיעו כאן לפי זמן.</span></div> : <div className="activity-timeline">{activityItems.map((item, index) => <div className={`activity-item ${item.tone}`} key={`${item.type}-${item.title}-${index}`}><span>{item.type}</span><div><strong>{item.title}</strong><small>{item.meta} · {item.date ? new Date(item.date).toLocaleString("he-IL") : ""}</small></div></div>)}</div>}</article>
      </section>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות אדמין</h2><p>קישורים מתוקנים לכל דפי האדמין המרכזיים.</p></div><div className="quick-actions-grid">{adminActions.map((action) => <Link className="quick-action" href={action.href} key={action.href}><action.icon /><strong>{action.label}</strong><span>פתיחת דף ניהול</span></Link>)}</div></section>
      <section className="grid cols-3 risk-board"><article className="card risk-card"><ShieldAlert /><strong>גנים</strong><b>{data.gardens}</b><span>ניהול וסטטוס בטיחות</span></article><article className="card risk-card"><Camera /><strong>מצלמות</strong><b>{data.cameras}</b><span>חיבור, בריאות והרשאות</span></article><article className="card risk-card"><BellRing /><strong>התראות</strong><b>{data.notifications}</b><span>מסמכים, פיקוח, AI ומשימות</span></article></section>
      <section className="grid cols-3 dashboard-panels"><article className="card action-panel"><FileX2 /><h2>מסמכים</h2><p>{data.missingDocuments} מסמכים דורשים טיפול או בדיקה.</p><Link className="button secondary" href="/dashboard/admin/documents">בדיקת מסמכים</Link></article><article className="card action-panel"><MessageSquareWarning /><h2>פניות</h2><p>{data.complaints} פניות ותלונות נמצאות במרכז הדיווחים.</p><Link className="button secondary" href="/dashboard/admin/complaints">פתיחת פניות</Link></article><article className="card action-panel"><Bot /><h2>תצפיתן דיגיטלי</h2><p>ארכיטקטורת RTSP, HLS, WebRTC ו-AI מוכנה להגדרות. Live תלוי Gateway.</p><Link className="button secondary" href="/dashboard/admin/ai-observer">הגדרות AI</Link></article></section>
      <section className="dashboard-section"><div className="section-heading"><h2>גנים אחרונים</h2><p>כניסה לפרופיל גן מלא.</p></div><div className="procedure-list">{data.gardenList.length === 0 ? <div className="empty-mini">אין גנים להצגה.</div> : data.gardenList.map((garden: any) => <Link className="card procedure-card" href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><span className="pill">{garden.city}</span><h3>{garden.name}</h3><p>ציון אחרון: {garden.last_inspection_score ?? "-"}</p></div><div className="procedure-meta"><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status}</span><span>צפייה בפרופיל</span></div></Link>)}</div></section>
    </DashboardShell>
  );
}
