import Link from "next/link";
import { AlertTriangle, BarChart3, BellRing, Bot, Camera, CreditCard, FileText, HeartPulse, MessageSquareWarning, Rocket, Search, ShieldAlert, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

async function countRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count, error } = await supabase.from(table as any).select("*", { count: "exact", head: true });
  logSupabaseError(`count ${table}`, error);
  return error ? 0 : count ?? 0;
}

async function countFiltered(supabase: Awaited<ReturnType<typeof createClient>>, table: string, apply: (query: any) => any) {
  const { count, error } = await apply(supabase.from(table as any).select("*", { count: "exact", head: true }));
  logSupabaseError(`count ${table}`, error);
  return error ? 0 : count ?? 0;
}

function money(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

function healthTone(score: number): "good" | "warn" | "bad" {
  if (score >= 82) return "good";
  if (score >= 62) return "warn";
  return "bad";
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default async function AdminDashboard() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("national admin command center", async () => {
    const supabase = await createClient();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekStartIso = weekStart.toISOString();
    const nowIso = now.toISOString();

    const [
      gardens,
      activeGardens,
      onboardingGardens,
      suspendedGardens,
      children,
      staff,
      activeStaff,
      inspectors,
      parents,
      activeSubscriptions,
      expiringSubscriptions,
      overdueAccounts,
      requiredInspections,
      overdueInspections,
      completedInspections,
      violations,
      complaints,
      criticalComplaints,
      incidents,
      activeIncidents,
      observerAlerts,
      cameras,
      offlineCameras,
      unhealthyCameras,
      communicationFailures,
      deliveryLogs,
      launchBlockers,
      securityFindings,
      pilotPrograms,
      subscriptionRowsRes,
      gardenRowsRes,
      inspectorRowsRes,
      recentComplaintsRes,
      recentAiEventsRes,
      launchScoresRes
    ] = await Promise.all([
      countRows(supabase, "gardens"),
      countFiltered(supabase, "gardens", (query) => query.in("status", ["active", "safe", "approved"])),
      countFiltered(supabase, "gardens", (query) => query.in("approval_flow_status", ["lead_submitted", "credentials_sent", "onboarding_in_progress", "pending_final_approval", "correction_required"])),
      countFiltered(supabase, "gardens", (query) => query.in("status", ["suspended", "archived"])),
      countRows(supabase, "children"),
      countRows(supabase, "staff"),
      countFiltered(supabase, "staff", (query) => query.eq("approved_to_work", true)),
      countRows(supabase, "inspectors"),
      countFiltered(supabase, "profiles", (query) => query.eq("role", "parent")),
      countFiltered(supabase, "subscriptions", (query) => query.in("status", ["active", "trialing"])),
      countFiltered(supabase, "subscriptions", (query) => query.lte("current_period_end", new Date(Date.now() + 14 * 86400000).toISOString()).in("status", ["active", "trialing"])),
      countFiltered(supabase, "subscriptions", (query) => query.in("status", ["past_due", "unpaid", "payment_failed"])),
      countFiltered(supabase, "required_inspections", (query) => query.neq("status", "done")),
      countFiltered(supabase, "required_inspections", (query) => query.lt("due_at", nowIso).neq("status", "done")),
      countFiltered(supabase, "inspections", (query) => query.gte("completed_at", monthStart).in("status", ["done", "completed"])),
      countFiltered(supabase, "violations", (query) => query.in("status", ["open", "new", "in_progress", "overdue"])),
      countFiltered(supabase, "complaints", (query) => query.in("status", ["new", "open", "in_progress", "waiting_user"])),
      countFiltered(supabase, "complaints", (query) => query.in("severity", ["critical", "high", "urgent"]).in("status", ["new", "open", "in_progress", "waiting_user"])),
      countRows(supabase, "incident_reports"),
      countFiltered(supabase, "incident_reports", (query) => query.in("status", ["new", "open", "in_progress"])),
      countFiltered(supabase, "ai_events", (query) => query.in("status", ["open", "in_progress"]).in("severity", ["high", "critical"])),
      countRows(supabase, "camera_streams"),
      countFiltered(supabase, "camera_streams", (query) => query.in("status", ["offline", "failed", "error", "disabled", "pending_gateway"])),
      countFiltered(supabase, "camera_streams", (query) => query.in("health_status", ["warning", "unhealthy", "offline", "failed"])),
      countFiltered(supabase, "communication_delivery_logs", (query) => query.in("status", ["failed", "failed_mock", "bounced", "delivery_failed"])),
      countRows(supabase, "communication_delivery_logs"),
      countFiltered(supabase, "launch_blockers", (query) => query.not("status", "in", "(verified,accepted_risk)")),
      countFiltered(supabase, "security_findings", (query) => query.not("status", "in", "(resolved,false_positive,accepted_risk)")),
      countFiltered(supabase, "pilot_programs", (query) => query.in("pilot_status", ["active", "in_progress", "onboarding"])),
      supabase.from("subscriptions" as any).select("id,status,monthly_amount,amount,price,created_at,current_period_end").limit(500),
      supabase.from("gardens" as any).select("id,name,city,safe_status,status,last_inspection_score,next_inspection_at,inspection_required_status,created_at").order("created_at", { ascending: false }).limit(10),
      supabase.from("inspectors" as any).select("id,full_name,city,assigned_cities,status").limit(10),
      supabase.from("complaints" as any).select("id,subject,severity,status,created_at,gardens(name,city)").order("created_at", { ascending: false }).limit(6),
      supabase.from("ai_events" as any).select("id,event_type,severity,status,detected_at,gardens(name,city)").order("detected_at", { ascending: false }).limit(6),
      supabase.from("launch_readiness_scores" as any).select("category,score,status").limit(20)
    ]);

    [
      subscriptionRowsRes,
      gardenRowsRes,
      inspectorRowsRes,
      recentComplaintsRes,
      recentAiEventsRes,
      launchScoresRes
    ].forEach((query, index) => logSupabaseError(`national dashboard query ${index}`, (query as any).error));

    const subscriptionRows = (subscriptionRowsRes.data ?? []) as any[];
    const mrr = subscriptionRows
      .filter((row) => ["active", "trialing"].includes(String(row.status)))
      .reduce((sum, row) => sum + Number(row.monthly_amount ?? row.amount ?? row.price ?? 0), 0);
    const newThisWeek = await countFiltered(supabase, "gardens", (query) => query.gte("created_at", weekStartIso));
    const launchScores = (launchScoresRes.data ?? []) as any[];
    const launchReadiness = launchScores.length ? Math.round(launchScores.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / launchScores.length) : 0;

    return {
      gardens,
      activeGardens,
      onboardingGardens,
      suspendedGardens,
      children,
      staff,
      activeStaff,
      inspectors,
      parents,
      activeSubscriptions,
      expiringSubscriptions,
      overdueAccounts,
      requiredInspections,
      overdueInspections,
      completedInspections,
      violations,
      complaints,
      criticalComplaints,
      incidents,
      activeIncidents,
      observerAlerts,
      cameras,
      offlineCameras,
      unhealthyCameras,
      communicationFailures,
      deliveryLogs,
      launchBlockers,
      securityFindings,
      pilotPrograms,
      mrr,
      arr: mrr * 12,
      newThisWeek,
      launchReadiness,
      gardenRows: (gardenRowsRes.data ?? []) as any[],
      inspectorRows: (inspectorRowsRes.data ?? []) as any[],
      recentComplaints: (recentComplaintsRes.data ?? []) as any[],
      recentAiEvents: (recentAiEventsRes.data ?? []) as any[],
      queryError: [gardenRowsRes.error, inspectorRowsRes.error].some(Boolean) ? "חלק מנתוני מרכז השליטה לא נטענו" : null
    };
  }, {
    gardens: 0,
    activeGardens: 0,
    onboardingGardens: 0,
    suspendedGardens: 0,
    children: 0,
    staff: 0,
    activeStaff: 0,
    inspectors: 0,
    parents: 0,
    activeSubscriptions: 0,
    expiringSubscriptions: 0,
    overdueAccounts: 0,
    requiredInspections: 0,
    overdueInspections: 0,
    completedInspections: 0,
    violations: 0,
    complaints: 0,
    criticalComplaints: 0,
    incidents: 0,
    activeIncidents: 0,
    observerAlerts: 0,
    cameras: 0,
    offlineCameras: 0,
    unhealthyCameras: 0,
    communicationFailures: 0,
    deliveryLogs: 0,
    launchBlockers: 0,
    securityFindings: 0,
    pilotPrograms: 0,
    mrr: 0,
    arr: 0,
    newThisWeek: 0,
    launchReadiness: 0,
    gardenRows: [] as any[],
    inspectorRows: [] as any[],
    recentComplaints: [] as any[],
    recentAiEvents: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const staffReadiness = data.staff ? Math.round((data.activeStaff / data.staff) * 100) : 100;
  const inspectionCompletion = data.requiredInspections + data.completedInspections ? Math.round((data.completedInspections / (data.requiredInspections + data.completedInspections)) * 100) : 100;
  const communicationHealth = data.deliveryLogs ? clamp(100 - (data.communicationFailures / Math.max(data.deliveryLogs, 1)) * 100) : 100;
  const cameraHealth = data.cameras ? clamp(100 - ((data.offlineCameras + data.unhealthyCameras) / Math.max(data.cameras, 1)) * 100) : 100;
  const safetyPressure = data.criticalComplaints + data.activeIncidents + data.violations + data.observerAlerts;
  const systemHealth = clamp(
    100 -
    data.overdueInspections * 7 -
    data.criticalComplaints * 6 -
    data.observerAlerts * 5 -
    data.offlineCameras * 3 -
    data.launchBlockers * 6 -
    data.securityFindings * 4 -
    Math.max(0, 90 - staffReadiness) / 2
  );
  const tone = healthTone(systemHealth);
  const activeCustomers = data.activeGardens + data.onboardingGardens;
  const growthRate = data.gardens ? Math.round((data.newThisWeek / Math.max(data.gardens, 1)) * 100) : 0;
  const churnRisk = data.activeSubscriptions ? Math.round(((data.expiringSubscriptions + data.overdueAccounts) / Math.max(data.activeSubscriptions, 1)) * 100) : 0;

  const executiveQuestions = [
    { label: "אילו גנים דורשים טיפול?", href: "/dashboard/admin/kindergartens" },
    { label: "אילו מפקחים עמוסים?", href: "/dashboard/admin/inspectors" },
    { label: "אילו מנויים בסיכון?", href: "/dashboard/admin/subscriptions" },
    { label: "מה חששות הבטיחות החודש?", href: "/dashboard/admin/ai-events" }
  ];

  return (
    <DashboardShell role="admin" title="מרכז שליטה ארצי">
      <div className="super-admin-shell">
        <section className="national-command-hero">
          <div className={`national-health-score ${tone}`}>
            <span>בריאות מערכת</span>
            <strong>{systemHealth}</strong>
            <small>מתוך 100</small>
          </div>
          <div>
            <p className="eyebrow">שליטה ארצית</p>
            <h1>כל Gan Batuach במבט אחד.</h1>
            <p>{data.activeGardens} גנים פעילים, {data.inspectors} מפקחים, {data.children} ילדים, {data.staff} אנשי צוות ו-{safetyPressure} נושאי בטיחות פתוחים.</p>
            <div className="parent-status-row">
              <span className={`pill ${tone}`}>{tone === "good" ? "מערכת יציבה" : tone === "warn" ? "דורש תשומת לב" : "חריגים פתוחים"}</span>
              <span className={data.launchBlockers ? "pill bad" : "pill good"}>{data.launchBlockers} חסמי השקה</span>
              <span className={data.securityFindings ? "pill warn" : "pill good"}>{data.securityFindings} ממצאי אבטחה</span>
            </div>
          </div>
          <Link className="button primary" href="/dashboard/admin/users"><Search size={16} /> חיפוש ארצי</Link>
        </section>

        <section className="national-kpi-strip">
          <RoleMetricCard label="גנים פעילים" value={data.activeGardens} hint={`${data.gardens} סה״כ`} tone="good" href="/dashboard/admin/kindergartens" />
          <RoleMetricCard label="מפקחים" value={data.inspectors} hint="שיבוץ וביצוע" tone="good" href="/dashboard/admin/inspectors" />
          <RoleMetricCard label="ילדים" value={data.children} hint={`${data.parents} הורים`} tone="good" href="/dashboard/admin/users" />
          <RoleMetricCard label="צוות פעיל" value={`${data.activeStaff}/${data.staff}`} hint={`${staffReadiness}% מוכנות`} tone={staffReadiness >= 80 ? "good" : "warn"} href="/dashboard/admin/users" />
          <RoleMetricCard label="מנויים" value={data.activeSubscriptions} hint={`${data.overdueAccounts} בסיכון`} tone={data.overdueAccounts ? "warn" : "good"} href="/dashboard/admin/subscriptions" />
          <RoleMetricCard label="בריאות" value={`${systemHealth}%`} hint="פלטפורמה" tone={tone} href="/dashboard/admin/system-health" />
        </section>

        <section className="executive-kpi-center">
          <article><CreditCard /><span>MRR</span><strong>{money(data.mrr)}</strong><small>ARR {money(data.arr)}</small></article>
          <article><UsersRound /><span>לקוחות פעילים</span><strong>{activeCustomers}</strong><small>כולל קליטה</small></article>
          <article><BarChart3 /><span>צמיחה שבועית</span><strong>{growthRate}%</strong><small>{data.newThisWeek} גנים חדשים</small></article>
          <article><AlertTriangle /><span>סיכון נטישה</span><strong>{churnRisk}%</strong><small>מנויים באיחור/לקראת סיום</small></article>
          <article><Rocket /><span>מוכנות השקה</span><strong>{data.launchReadiness}%</strong><small>Readiness center</small></article>
          <article><ClipboardIcon /><span>פיקוח</span><strong>{inspectionCompletion}%</strong><small>{data.overdueInspections} באיחור</small></article>
        </section>

        <section className="national-two-column">
          <article className="national-panel">
            <div className="section-heading"><h2>בטיחות ארצית</h2><p>תלונות, אירועים, פיקוח ותצפיתן לפי חומרה.</p></div>
            <div className="national-safety-grid">
              <Link href="/dashboard/admin/complaints"><strong>{data.criticalComplaints}</strong><span>תלונות דחופות</span></Link>
              <Link href="/dashboard/admin/complaints"><strong>{data.activeIncidents}</strong><span>אירועים פתוחים</span></Link>
              <Link href="/dashboard/admin/inspections/late"><strong>{data.overdueInspections}</strong><span>פיקוחים באיחור</span></Link>
              <Link href="/dashboard/admin/ai-events"><strong>{data.observerAlerts}</strong><span>התראות תצפיתן</span></Link>
            </div>
            <div className="national-alert-feed">
              {[...data.recentComplaints, ...data.recentAiEvents].slice(0, 8).map((item: any) => <Link href={item.event_type ? "/dashboard/admin/ai-events" : "/dashboard/admin/complaints"} key={`${item.id}-${item.subject ?? item.event_type}`}><span className={["critical", "high", "urgent"].includes(String(item.severity)) ? "severity-dot critical" : "severity-dot medium"} /><div><strong>{item.subject ?? item.event_type}</strong><small>{item.gardens?.name ?? "גן"} · {item.created_at || item.detected_at ? new Date(item.created_at ?? item.detected_at).toLocaleString("he-IL") : ""}</small></div></Link>)}
            </div>
          </article>

          <article className="national-panel">
            <div className="section-heading"><h2>עוזר מנהלים</h2><p>שאלות שמובילות להחלטה מהירה.</p></div>
            <div className="national-assistant-list">{executiveQuestions.map((question) => <Link href={question.href} key={question.label}>{question.label}</Link>)}</div>
            <div className="national-health-list">
              <span>מצלמות תקינות <b>{cameraHealth}%</b></span>
              <span>תקשורת תקינה <b>{communicationHealth}%</b></span>
              <span>מוכנות צוות <b>{staffReadiness}%</b></span>
              <span>פיקוח החודש <b>{data.completedInspections}</b></span>
            </div>
          </article>
        </section>

        <section className="national-action-grid">
          <ActionCard title="גנים" text="פעילים, קליטה, מושעים וניסיון" href="/dashboard/admin/kindergartens" icon={ShieldAlert} tone="good" />
          <ActionCard title="מפקחים" text="שיבוץ, עומס וביצוע" href="/dashboard/admin/inspectors" icon={UsersRound} />
          <ActionCard title="תצפיתן" text="מוכנות, כיול והתראות" href="/dashboard/admin/observer-calibration" icon={Bot} tone={data.observerAlerts ? "warn" : "default"} />
          <ActionCard title="מצלמות" text="בריאות, Gateway ושידורים" href="/dashboard/admin/camera-deployment" icon={Camera} tone={data.offlineCameras ? "warn" : "default"} />
          <ActionCard title="תקשורת" text="Email, WhatsApp, SMS, Push" href="/dashboard/admin/communications" icon={BellRing} tone={data.communicationFailures ? "warn" : "default"} />
          <ActionCard title="הכנסות" text="מנויים, גבייה וסיכון" href="/dashboard/admin/subscriptions" icon={CreditCard} />
          <ActionCard title="השקה" text="פיילוט, אבטחה וציות" href="/dashboard/admin/launch-readiness" icon={Rocket} tone={data.launchBlockers ? "bad" : "good"} />
          <ActionCard title="דוחות" text="שבועי, חודשי, בטיחות והכנסות" href="/dashboard/admin/reports" icon={FileText} />
        </section>

        <section className="national-two-column">
          <article className="national-panel">
            <div className="section-heading"><h2>מרכז גנים</h2><p>סטטוס, בטיחות ופיקוח הבא.</p></div>
            <div className="national-garden-list">
              {data.gardenRows.length === 0 ? <div className="empty-state"><strong>אין גנים להצגה</strong><span>גנים שייווצרו יופיעו כאן.</span></div> : data.gardenRows.map((garden: any) => <Link href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><strong>{garden.name}</strong><span>{garden.city ?? ""} · {garden.status ?? "סטטוס חסר"}</span></div><span className={Number(garden.last_inspection_score ?? 100) < 70 ? "pill bad" : garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.last_inspection_score ?? garden.safe_status ?? "בדיקה"}</span></Link>)}
            </div>
          </article>
          <article className="national-panel">
            <div className="section-heading"><h2>מפקחים ועומס</h2><p>שיבוץ ומוכנות פיקוח.</p></div>
            <div className="national-garden-list">
              {data.inspectorRows.length === 0 ? <div className="empty-state"><strong>אין מפקחים להצגה</strong><span>מפקחים שייווצרו יופיעו כאן.</span></div> : data.inspectorRows.map((inspector: any) => <Link href="/dashboard/admin/inspectors" key={inspector.id}><div><strong>{inspector.full_name ?? "מפקח"}</strong><span>{Array.isArray(inspector.assigned_cities) ? inspector.assigned_cities.join(", ") : inspector.city ?? "אזור לא צוין"}</span></div><span className="pill good">{inspector.status ?? "פעיל"}</span></Link>)}
            </div>
          </article>
        </section>

        <section className="national-report-row">
          <span><ShieldCheck /> גנים פעילים <b>{data.activeGardens}</b></span>
          <span><HeartPulse /> בטיחות פתוחה <b>{safetyPressure}</b></span>
          <span><Camera /> מצלמות לא תקינות <b>{data.offlineCameras + data.unhealthyCameras}</b></span>
          <span><BellRing /> כשלי תקשורת <b>{data.communicationFailures}</b></span>
          <span><Rocket /> פיילוטים פעילים <b>{data.pilotPrograms}</b></span>
        </section>
      </div>
    </DashboardShell>
  );
}

function ClipboardIcon(props: { size?: number }) {
  return <BarChart3 {...props} />;
}
