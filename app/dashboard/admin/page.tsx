import Link from "next/link";
import { BarChart3, BellRing, Bot, Camera, ClipboardCheck, Download, FileWarning, FileX2, HeartPulse, MapPinned, MessageSquareWarning, Settings, ShieldAlert, ShieldCheck, Sparkles, TrendingUp, UserCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminActivityCenter, type AdminActivityItem } from "@/components/admin-activity-center";
import { GlobalAlertsCenter } from "@/components/global-alerts-center";
import { ActionCard, CleanSection, PremiumDashboardHero, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

const adminActions = [
  { href: "/dashboard/admin/leads", label: "לידים", icon: UsersRound },
  { href: "/dashboard/admin/kindergartens", label: "גני ילדים", icon: ShieldAlert },
  { href: "/dashboard/admin/inspectors", label: "מפקחים", icon: UserCheck },
  { href: "/dashboard/admin/procedures", label: "נהלים", icon: ClipboardCheck },
  { href: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", icon: FileWarning },
  { href: "/dashboard/admin/ai-events", label: "אירועי תצפיתן", icon: Bot },
  { href: "/dashboard/admin/notifications", label: "התראות", icon: BellRing },
  { href: "/dashboard/admin/cameras", label: "מצלמות", icon: Camera },
  { href: "/dashboard/admin/demo-control", label: "נתוני ניסיון", icon: Sparkles },
  { href: "/dashboard/admin/qa-checklist", label: "רשימת בדיקה", icon: ClipboardCheck },
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

async function countRange(supabase: Awaited<ReturnType<typeof createClient>>, table: string, column: string, from: string, to: string) {
  return countFiltered(supabase, table, (query) => query.gte(column, from).lt(column, to));
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
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("admin dashboard", async () => {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const weekStartIso = weekStart.toISOString();
    const previousWeekStartIso = previousWeekStart.toISOString();
    const [gardens, activeGardens, children, parents, leads, inspectors, openViolations, violations, openComplaints, complaints, cameras, cameraIssues, aiAlerts, notifications, incidents, activeIncidents, lateInspections, dueSoonInspections, missingDocuments, staffTotal, staffApproved, gardenList, riskyGardensQuery, inspectorProfilesQuery, inspectorHistoryQuery, weekComplaints, previousWeekComplaints, weekInspections, previousWeekInspections, weekAiEvents, previousWeekAiEvents, weekDocuments, previousWeekDocuments, recentComplaints, recentInspections, recentDocuments, recentAiEvents, recentMessages] = await Promise.all([
      countRows(supabase, "gardens"),
      countFiltered(supabase, "gardens", (query) => query.eq("status", "active")),
      countRows(supabase, "children"),
      countFiltered(supabase, "profiles", (query) => query.eq("role", "parent")),
      countRows(supabase, "leads"),
      countRows(supabase, "inspectors"),
      countFiltered(supabase, "violations", (query) => query.in("status", ["open", "in_progress", "new", "overdue"])),
      countRows(supabase, "violations"),
      countFiltered(supabase, "complaints", (query) => query.in("status", ["new", "open", "in_progress", "waiting_user"])),
      countRows(supabase, "complaints"),
      countRows(supabase, "camera_streams"),
      countFiltered(supabase, "camera_streams", (query) => query.in("status", ["offline", "covered", "frozen", "black_frame", "error", "failed"])),
      countFiltered(supabase, "ai_events", (query) => query.in("status", ["open", "in_progress"]).in("severity", ["high", "critical"])),
      countRows(supabase, "notifications"),
      countRows(supabase, "incident_reports"),
      countFiltered(supabase, "incident_reports", (query) => query.in("status", ["open", "in_progress", "new"])),
      countFiltered(supabase, "required_inspections", (query) => query.lt("due_at", now).neq("status", "completed")),
      countFiltered(supabase, "required_inspections", (query) => query.gte("due_at", now).lte("due_at", new Date(Date.now() + 5 * 86400000).toISOString()).neq("status", "completed")),
      countFiltered(supabase, "documents", (query) => query.in("status", ["missing", "expired", "rejected"])),
      countRows(supabase, "staff"),
      countFiltered(supabase, "staff", (query) => query.eq("approved_to_work", true)),
      supabase.from("gardens" as any).select("id, name, city, safe_status, last_inspection_score, next_inspection_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("gardens" as any).select("id, name, city, safe_status, last_inspection_score, next_inspection_at, inspection_required_status").order("last_inspection_score", { ascending: true, nullsFirst: false }).limit(5),
      supabase.from("inspectors" as any).select("id, full_name, city, assigned_cities, status").limit(12),
      supabase.from("inspections" as any).select("id, inspector_id, status, weighted_score, completed_at").not("inspector_id", "is", null).order("completed_at", { ascending: false }).limit(250),
      countRange(supabase, "complaints", "created_at", weekStartIso, now),
      countRange(supabase, "complaints", "created_at", previousWeekStartIso, weekStartIso),
      countRange(supabase, "inspections", "created_at", weekStartIso, now),
      countRange(supabase, "inspections", "created_at", previousWeekStartIso, weekStartIso),
      countRange(supabase, "ai_events", "detected_at", weekStartIso, now),
      countRange(supabase, "ai_events", "detected_at", previousWeekStartIso, weekStartIso),
      countRange(supabase, "documents", "created_at", weekStartIso, now),
      countRange(supabase, "documents", "created_at", previousWeekStartIso, weekStartIso),
      supabase.from("complaints" as any).select("id, subject, severity, status, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("inspections" as any).select("id, status, weighted_score, completed_at, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("documents" as any).select("id, name, status, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("ai_events" as any).select("id, event_type, severity, status, detected_at, gardens(name)").order("detected_at", { ascending: false }).limit(4),
      supabase.from("messages" as any).select("id, subject, treatment_status, created_at, gardens(name)").order("created_at", { ascending: false }).limit(4)
    ]);
    logSupabaseError("admin garden list", gardenList.error);
    [riskyGardensQuery, inspectorProfilesQuery, inspectorHistoryQuery, recentComplaints, recentInspections, recentDocuments, recentAiEvents, recentMessages].forEach((query, index) => logSupabaseError("admin dashboard query " + index, query.error));
    return { gardens, activeGardens, children, parents, leads, inspectors, openViolations, violations, openComplaints, complaints, cameras, cameraIssues, aiAlerts, notifications, incidents, activeIncidents, lateInspections, dueSoonInspections, missingDocuments, staffTotal, staffApproved, gardenList: (gardenList.data ?? []) as any[], riskyGardens: (riskyGardensQuery.data ?? []) as any[], inspectorProfiles: (inspectorProfilesQuery.data ?? []) as any[], inspectorHistory: (inspectorHistoryQuery.data ?? []) as any[], weekComplaints, previousWeekComplaints, weekInspections, previousWeekInspections, weekAiEvents, previousWeekAiEvents, weekDocuments, previousWeekDocuments, recentComplaints: recentComplaints.data ?? [], recentInspections: recentInspections.data ?? [], recentDocuments: recentDocuments.data ?? [], recentAiEvents: recentAiEvents.data ?? [], recentMessages: recentMessages.data ?? [], queryError: gardenList.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { gardens: 0, activeGardens: 0, children: 0, parents: 0, leads: 0, inspectors: 0, openViolations: 0, violations: 0, openComplaints: 0, complaints: 0, cameras: 0, cameraIssues: 0, aiAlerts: 0, notifications: 0, incidents: 0, activeIncidents: 0, lateInspections: 0, dueSoonInspections: 0, missingDocuments: 0, staffTotal: 0, staffApproved: 0, gardenList: [] as any[], riskyGardens: [] as any[], inspectorProfiles: [] as any[], inspectorHistory: [] as any[], weekComplaints: 0, previousWeekComplaints: 0, weekInspections: 0, previousWeekInspections: 0, weekAiEvents: 0, previousWeekAiEvents: 0, weekDocuments: 0, previousWeekDocuments: 0, recentComplaints: [] as any[], recentInspections: [] as any[], recentDocuments: [] as any[], recentAiEvents: [] as any[], recentMessages: [] as any[], queryError: null as string | null });
  const data = result.data;
  const staffCompliance = data.staffTotal > 0 ? Math.round((data.staffApproved / data.staffTotal) * 100) : 100;
  const issueLoad = data.lateInspections + data.aiAlerts + data.cameraIssues + data.missingDocuments + data.violations;
  const healthScore = Math.max(0, Math.min(100, 100 - data.lateInspections * 8 - data.aiAlerts * 6 - data.cameraIssues * 5 - data.missingDocuments * 2 - Math.max(0, 100 - staffCompliance) / 2));
  const tone = statusTone(healthScore);
  const onboardingCompleted = [data.activeGardens > 0, data.inspectors > 0, data.gardens === 0 || data.lateInspections === 0, data.cameraIssues === 0, data.missingDocuments === 0, staffCompliance >= 80].filter(Boolean).length;
  const onboardingPercent = Math.round((onboardingCompleted / 6) * 100);
  const activityItems: AdminActivityItem[] = [
    ...data.recentComplaints.map((item: any) => ({ type: "פנייה", title: item.subject, meta: `${item.gardens?.name ?? "ללא גן"} · ${item.severity} · ${item.status}`, date: item.created_at, severity: item.severity, tone: item.severity === "critical" || item.severity === "high" ? "bad" : "warn" })),
    ...data.recentInspections.map((item: any) => ({ type: "פיקוח", title: item.gardens?.name ?? "ביקורת", meta: `סטטוס ${item.status} · ציון ${item.weighted_score ?? "-"}`, date: item.completed_at ?? item.created_at, severity: Number(item.weighted_score ?? 10) < 8 ? "high" : "low", tone: Number(item.weighted_score ?? 10) < 8 ? "bad" : "good" })),
    ...data.recentDocuments.map((item: any) => ({ type: "מסמך", title: item.name, meta: `${item.gardens?.name ?? "כללי"} · ${item.status}`, date: item.created_at, severity: item.status === "valid" ? "low" : "medium", tone: item.status === "valid" ? "good" : "warn" })),
    ...data.recentAiEvents.map((item: any) => ({ type: "תצפיתן", title: item.event_type, meta: `${item.gardens?.name ?? "גן"} · ${item.severity} · ${item.status}`, date: item.detected_at, severity: item.severity, tone: item.severity === "critical" || item.severity === "high" ? "bad" : "warn" })),
    ...data.recentMessages.map((item: any) => ({ type: "הודעה", title: item.subject, meta: `${item.gardens?.name ?? "מערכת"} · ${item.treatment_status}`, date: item.created_at, severity: "low", tone: "default" }))
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime()).slice(0, 10);
  const riskCards = [
    { title: "סיכון פיקוח", value: Math.min(100, data.lateInspections * 25 + data.dueSoonInspections * 10), href: "/dashboard/admin/inspections/late" },
    { title: "סיכון צוות", value: Math.max(0, 100 - staffCompliance), href: "/dashboard/admin/users" },
    { title: "סיכון מצלמות", value: Math.min(100, data.cameraIssues * 20), href: "/dashboard/admin/cameras" },
    { title: "סיכון מסמכים", value: Math.min(100, data.missingDocuments * 8), href: "/dashboard/admin/documents" }
  ];
  const urgentAlerts = [
    ...(data.lateInspections > 0 ? [{ title: "פיקוחים באיחור", body: `${data.lateInspections} גנים עברו את מועד הפיקוח`, severity: "bad" as const, href: "/dashboard/admin/inspections/late", icon: "inspection" as const }] : []),
    ...(data.activeIncidents > 0 ? [{ title: "אירועים פתוחים", body: `${data.activeIncidents} אירועים דורשים טיפול`, severity: "bad" as const, href: "/dashboard/admin/complaints", icon: "incidents" as const }] : []),
    ...(data.openComplaints > 0 ? [{ title: "פניות פתוחות", body: `${data.openComplaints} פניות ותלונות פתוחות`, severity: "warn" as const, href: "/dashboard/admin/complaints", icon: "incidents" as const }] : []),
    ...(data.aiAlerts > 0 ? [{ title: "אירועי תצפיתן דחופים", body: `${data.aiAlerts} אירועים דורשים בדיקה`, severity: "bad" as const, href: "/dashboard/admin/ai-events", icon: "ai" as const }] : []),
    ...(data.cameraIssues > 0 ? [{ title: "תקלות מצלמה", body: `${data.cameraIssues} מצלמות דורשות בדיקה`, severity: "warn" as const, href: "/dashboard/admin/cameras", icon: "camera" as const }] : []),
    ...(data.missingDocuments > 0 ? [{ title: "מסמכים חסרים", body: `${data.missingDocuments} מסמכים חסרים/פגי תוקף`, severity: "warn" as const, href: "/dashboard/admin/documents", icon: "documents" as const }] : []),
    ...(staffCompliance < 80 ? [{ title: "ציות צוות נמוך", body: `ציות צוות ${staffCompliance}%`, severity: "warn" as const, href: "/dashboard/admin/users", icon: "staff" as const }] : [])
  ];
  const weekTrends = [
    { title: "פניות", now: data.weekComplaints, previous: data.previousWeekComplaints, href: "/dashboard/admin/complaints" },
    { title: "ביקורות", now: data.weekInspections, previous: data.previousWeekInspections, href: "/dashboard/admin/inspections" },
    { title: "אירועי תצפיתן", now: data.weekAiEvents, previous: data.previousWeekAiEvents, href: "/dashboard/admin/ai-events" },
    { title: "מסמכים", now: data.weekDocuments, previous: data.previousWeekDocuments, href: "/dashboard/admin/documents" }
  ];
  const inspectorCompletion = new Map<string, { done: number; avg: number; count: number }>();
  data.inspectorHistory.forEach((inspection: any) => {
    const id = String(inspection.inspector_id ?? "");
    if (!id) return;
    const current = inspectorCompletion.get(id) ?? { done: 0, avg: 0, count: 0 };
    const score = Number(inspection.weighted_score ?? 0);
    inspectorCompletion.set(id, { done: current.done + (inspection.status === "completed" ? 1 : 0), avg: current.avg + score, count: current.count + (score > 0 ? 1 : 0) });
  });
  const topInspectors = data.inspectorProfiles
    .map((inspector: any) => {
      const stats = inspectorCompletion.get(String(inspector.id)) ?? { done: 0, avg: 0, count: 0 };
      return { ...inspector, completed: stats.done, averageScore: stats.count ? Math.round((stats.avg / stats.count) * 10) / 10 : null };
    })
    .sort((a: any, b: any) => b.completed - a.completed)
    .slice(0, 5);
  const recommendedActions = [
    ...(data.dueSoonInspections > 0 ? [{ title: `${data.dueSoonInspections} גנים צריכים פיקוח בקרוב`, text: "שלחו תזכורת לפקחים ולמנהלות לפני איחור.", href: "/dashboard/admin/inspections/due", tone: "warn" }] : []),
    ...(data.lateInspections > 0 ? [{ title: `${data.lateInspections} גנים באיחור פיקוח`, text: "דרשו פיקוח או בצעו override מנומק עם Audit Log.", href: "/dashboard/admin/inspections/late", tone: "bad" }] : []),
    ...(data.cameraIssues > 0 ? [{ title: `${data.cameraIssues} מצלמות מנותקות או בתקלה`, text: "פתחו את מרכז המצלמות ובדקו חיבור והרשאות.", href: "/dashboard/admin/cameras", tone: "warn" }] : []),
    ...(data.missingDocuments > 0 ? [{ title: `${data.missingDocuments} מסמכים חסרים או לא תקינים`, text: "עברו למרכז המסמכים ושלחו דרישות השלמה.", href: "/dashboard/admin/documents", tone: "warn" }] : []),
    ...(data.aiAlerts > 0 ? [{ title: `${data.aiAlerts} אירועי תצפיתן דחופים`, text: "בדקו אירועים, סמנו טיפול או פתחו משימת המשך.", href: "/dashboard/admin/ai-events", tone: "bad" }] : [])
  ];

  return (
    <DashboardShell role="admin" title="מרכז שליטה ארצי">
      <div className="commercial-dashboard">
      <PremiumDashboardHero
        eyebrow="סקירת פלטפורמה"
        title={`שלום ${profile.full_name ?? "מנהל המערכת"}`}
        subtitle="גנים, משתמשים, בטיחות והשקה בתמונה אחת קצרה."
        badge={statusText(tone)}
        badgeTone={tone}
        actions={<><Link className="button primary" href="/dashboard/admin/leads">קליטת גנים</Link><Link className="button secondary" href="/dashboard/admin/launch-readiness">מוכנות השקה</Link></>}
      />
      <div className="premium-metric-grid">
        <RoleMetricCard label="גנים פעילים" value={data.activeGardens} hint={`${data.gardens} גנים במערכת`} tone="good" href="/dashboard/admin/gardens" />
        <RoleMetricCard label="משתמשים" value={data.parents + data.staffTotal + data.inspectors} hint="הורים, צוות ומפקחים" href="/dashboard/admin/users" />
        <RoleMetricCard label="בטיחות" value={data.openViolations + data.aiAlerts} hint="אירועים וליקויים" tone={data.openViolations + data.aiAlerts ? "bad" : "good"} href="/dashboard/admin/ai-events" />
        <RoleMetricCard label="השקה" value={`${Math.round(healthScore)}%`} hint="בריאות מערכת" tone={tone} href="/dashboard/admin/system-health" />
      </div>
      <CleanSection title="מרכזי ניהול" subtitle="הכל מחולק לפי תחום, בלי להציף את המסך הראשון.">
        <div className="premium-action-grid">
          <ActionCard title="גנים" text="קליטה, פרופילים וסטטוס" href="/dashboard/admin/gardens" icon={ShieldAlert} tone="good" />
          <ActionCard title="משתמשים" text="הרשאות וחשבונות" href="/dashboard/admin/users" icon={UsersRound} />
          <ActionCard title="בטיחות" text="פיקוח, מצלמות ודיווחים" href="/dashboard/admin/inspections" icon={ShieldCheck} tone={issueLoad ? "warn" : "default"} />
          <ActionCard title="תצפיתן" text="אירועים לבדיקה" href="/dashboard/admin/observer-intelligence" icon={Bot} />
          <ActionCard title="השקה" text="פיילוט, חסמים ומוכנות" href="/dashboard/admin/launch-readiness" icon={Sparkles} />
          <ActionCard title="הגדרות" text="מערכת ותקשורת" href="/dashboard/admin/settings" icon={Settings} />
        </div>
      </CleanSection>
      <div className="dashboard-hero-card admin-hero-card premium-control-hero"><div><p className="eyebrow">סקירת מערכת</p><h1>שלום {profile.full_name ?? "מנהל המערכת"}</h1><p>תמונת מצב אחת לגנים פעילים, ילדים, הורים, צוות, פיקוחים, מצלמות, מסמכים ותצפיתן דיגיטלי.</p></div><div className="map-card"><MapPinned /><strong>{data.activeGardens}/{data.gardens} גנים פעילים</strong><span>ניהול מלא, דיווחים והרשאות מערכת</span></div></div>
      <AdminDataError message={result.error ?? data.queryError} />
      <section className={`critical-alert-strip ${urgentAlerts.some((alert) => alert.severity === "bad") ? "bad" : urgentAlerts.length ? "warn" : "good"}`}>
        <strong>{urgentAlerts.some((alert) => alert.severity === "bad") ? "התראות קריטיות פתוחות" : urgentAlerts.length ? "יש אזהרות לטיפול" : "המערכת נראית בריאה"}</strong>
        <span>{urgentAlerts.length ? urgentAlerts.slice(0, 3).map((alert) => alert.title).join(" · ") : "אין כרגע פיקוח באיחור, אירועי תצפיתן דחופים או מצלמות קריטיות לפי הנתונים."}</span>
        <Link className="button tiny secondary" href="/dashboard/admin/system-health">מרכז בריאות</Link>
      </section>
      <section className={`system-status-banner status-${tone}`}><div><ShieldCheck /><strong>סטטוס מערכת: {statusText(tone)}</strong><span>ציון בריאות {Math.round(healthScore)}%. עומס חריגים פעיל: {issueLoad} פריטים לטיפול.</span></div><Link className="button secondary" href="/dashboard/admin/system-health">פתיחת בריאות מערכת</Link></section>
      <div className="grid cols-4 dashboard-kpis premium-kpis">
        <StatCard label="גנים פעילים" value={data.activeGardens} tone="good" />
        <StatCard label="ילדים במערכת" value={data.children} />
        <StatCard label="הורים במערכת" value={data.parents} />
        <StatCard label="אנשי צוות" value={data.staffTotal} />
        <StatCard label="מפקחים" value={data.inspectors} />
        <StatCard label="פניות פתוחות" value={data.openComplaints} tone={data.openComplaints > 0 ? "warn" : "good"} />
        <StatCard label="ליקויים פתוחים" value={data.openViolations} tone={data.openViolations > 0 ? "bad" : "good"} />
        <StatCard label="פיקוחים באיחור" value={data.lateInspections} tone={data.lateInspections > 0 ? "bad" : "good"} />
        <StatCard label="אירועי תצפיתן דחופים" value={data.aiAlerts} tone={data.aiAlerts > 0 ? "bad" : "good"} />
        <StatCard label="בעיות מצלמה" value={data.cameraIssues} tone={data.cameraIssues > 0 ? "warn" : "good"} />
        <StatCard label="מסמכים חסרים/פגי תוקף" value={data.missingDocuments} tone={data.missingDocuments > 0 ? "warn" : "good"} />
        <StatCard label="ציות צוות" value={`${staffCompliance}%`} tone={staffCompliance >= 80 ? "good" : "warn"} />
        <StatCard label="סטטוס מערכת" value={`${Math.round(healthScore)}%`} tone={tone} />
      </div>
      <GlobalAlertsCenter alerts={urgentAlerts} />
      <section className="grid cols-2 dashboard-panels">
        <article className="card admin-trend-panel"><div className="section-heading"><h2><TrendingUp size={20} /> שבוע מול שבוע</h2><p>השוואת עומס תפעולי השבוע לעומת השבוע הקודם.</p></div><div className="trend-grid">{weekTrends.map((trend) => { const delta = trend.now - trend.previous; const deltaTone = delta > 0 ? "warn" : delta < 0 ? "good" : "default"; return <Link className={`trend-card ${deltaTone}`} href={trend.href} key={trend.title}><span>{trend.title}</span><strong>{trend.now}</strong><small>{delta > 0 ? "+" : ""}{delta} מול שבוע קודם</small><i><b style={{ width: `${Math.min(100, Math.max(8, trend.previous ? (trend.now / Math.max(trend.previous, trend.now)) * 100 : trend.now ? 100 : 8))}%` }} /></i></Link>; })}</div></article>
        <article className="card recommended-actions-card"><div className="section-heading"><h2><Sparkles size={20} /> המלצות פעולה</h2><p>הצעדים הבאים לפי סיכונים אמיתיים במערכת.</p></div>{recommendedActions.length === 0 ? <div className="empty-state"><strong>אין פעולה דחופה כרגע</strong><span>המערכת תציג כאן המלצות כשנפתחים פיקוחים, מצלמות, מסמכים או אירועי תצפיתן.</span></div> : <div className="recommendation-list">{recommendedActions.map((action) => <Link className={`recommendation-item ${action.tone}`} href={action.href} key={action.title}><strong>{action.title}</strong><span>{action.text}</span></Link>)}</div>}</article>
      </section>
      <section className="grid cols-4 risk-score-grid">{riskCards.map((risk) => <Link className={risk.value > 65 ? "card risk-score-card bad" : risk.value > 30 ? "card risk-score-card warn" : "card risk-score-card good"} href={risk.href} key={risk.title}><strong>{risk.value}</strong><span>{risk.title}</span><i><b style={{ width: `${risk.value}%` }} /></i></Link>)}</section>
      <section className="card admin-chart-panel"><div className="section-heading"><h2>גרף סיכונים מהיר</h2><p>מדד יחסי לפי פיקוח, צוות, מצלמות ומסמכים.</p></div><div className="kpi-bar-chart">{riskCards.map((risk) => <div key={risk.title}><span>{risk.title}</span><i><b style={{ width: `${risk.value}%` }} /></i><strong>{risk.value}</strong></div>)}</div></section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><div className="section-heading"><h2><ShieldAlert size={20} /> גנים בסיכון גבוה</h2><p>לפי ציון ביקורת, סטטוס בטיחות ומועד פיקוח.</p></div>{data.riskyGardens.length === 0 ? <div className="empty-state"><strong>אין גנים בסיכון להצגה</strong><span>כאשר קיימים ציוני ביקורת או איחורים, הגנים הדחופים יופיעו כאן.</span></div> : <div className="procedure-list">{data.riskyGardens.map((garden: any) => <Link className="list-item risk-kindergarten-row" href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><strong>{garden.name}</strong><span>{garden.city} · {garden.inspection_required_status ?? "סטטוס פיקוח לא ידוע"}</span></div><span className={Number(garden.last_inspection_score ?? 10) < 8 ? "pill bad" : garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.last_inspection_score ?? garden.safe_status ?? "בדיקה"}</span></Link>)}</div>}</article><article className="card action-panel"><div className="section-heading"><h2><BarChart3 size={20} /> פקחים מובילים</h2><p>מדד ביצוע לפי ביקורות שבוצעו ושיוך פעיל.</p></div>{topInspectors.length === 0 ? <div className="empty-state"><strong>אין פקחים להצגה</strong><span>לאחר יצירת פקחים וביצוע ביקורות, המדדים יופיעו כאן.</span></div> : <div className="procedure-list">{topInspectors.map((inspector: any) => <Link className="list-item inspector-rank-row" href="/dashboard/admin/inspectors" key={inspector.id}><div><strong>{inspector.full_name ?? "פקח"}</strong><span>{Array.isArray(inspector.assigned_cities) ? inspector.assigned_cities.join(", ") : inspector.city ?? "אזור לא צוין"}</span></div><span className="pill good">{inspector.completed} ביקורות</span></Link>)}</div>}</article></section>
      <section className="grid cols-2 dashboard-panels">
        <article className="card control-progress-card"><div className="section-heading"><h2><HeartPulse size={20} /> התקדמות הפעלה</h2><p>מדד חי לפי גנים פעילים, פקחים, מצלמות, מסמכים, צוות ופיקוח.</p></div><div className="mega-progress"><strong>{onboardingPercent}%</strong><span><i style={{ width: `${onboardingPercent}%` }} /></span></div><div className="checklist-row"><label><input type="checkbox" checked={data.activeGardens > 0} readOnly /> יש גנים פעילים<span>לפחות גן אחד פעיל במערכת.</span></label></div><div className="checklist-row"><label><input type="checkbox" checked={data.inspectors > 0} readOnly /> יש פקחים<span>שיוך פקחים מאפשר פיקוח חודשי.</span></label></div><div className="checklist-row"><label><input type="checkbox" checked={data.missingDocuments === 0} readOnly /> אין מסמכים חסרים<span>מסמכים חסרים מורידים מוכנות.</span></label></div></article>
        <AdminActivityCenter items={activityItems} />
      </section>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות אדמין</h2><p>קישורים מתוקנים לכל דפי האדמין המרכזיים.</p></div><div className="quick-actions-grid">{adminActions.map((action) => <Link className="quick-action" href={action.href} key={action.href}><action.icon /><strong>{action.label}</strong><span>פתיחת דף ניהול</span></Link>)}</div></section>
      <section className="grid cols-3 risk-board"><article className="card risk-card"><ShieldAlert /><strong>גנים</strong><b>{data.gardens}</b><span>ניהול וסטטוס בטיחות</span></article><article className="card risk-card"><Camera /><strong>מצלמות</strong><b>{data.cameras}</b><span>חיבור, בריאות והרשאות</span></article><article className="card risk-card"><BellRing /><strong>התראות</strong><b>{data.notifications}</b><span>מסמכים, פיקוח, תצפיתן ומשימות</span></article></section>
      <section className="grid cols-3 dashboard-panels"><article className="card action-panel"><FileX2 /><h2>מסמכים</h2><p>{data.missingDocuments} מסמכים דורשים טיפול או בדיקה.</p><Link className="button secondary" href="/dashboard/admin/documents">בדיקת מסמכים</Link></article><article className="card action-panel"><MessageSquareWarning /><h2>פניות</h2><p>{data.complaints} פניות ותלונות נמצאות במרכז הדיווחים.</p><Link className="button secondary" href="/dashboard/admin/complaints">פתיחת פניות</Link></article><article className="card action-panel"><Bot /><h2>תצפיתן דיגיטלי</h2><p>מרכז בטיחות למצלמות, אירועים לבדיקה ותצוגת מצב חיבורים.</p><Link className="button secondary" href="/dashboard/admin/ai-observer">מרכז תצפיתן</Link></article></section>
      <section className="dashboard-section"><div className="section-heading"><h2>גנים אחרונים</h2><p>כניסה לפרופיל גן מלא.</p></div><div className="procedure-list">{data.gardenList.length === 0 ? <div className="empty-mini">אין גנים להצגה.</div> : data.gardenList.map((garden: any) => <Link className="card procedure-card" href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><span className="pill">{garden.city}</span><h3>{garden.name}</h3><p>ציון אחרון: {garden.last_inspection_score ?? "-"}</p></div><div className="procedure-meta"><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status}</span><span>צפייה בפרופיל</span></div></Link>)}</div></section>
      </div>
    </DashboardShell>
  );
}
