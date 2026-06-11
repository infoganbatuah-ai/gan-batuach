import Link from "next/link";
import { AlertTriangle, BarChart3, Camera, ClipboardCheck, Eye, Radar, ShieldCheck, Siren, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverReadinessScore, observerNetworkTone, parentObserverBoundary, safeObserverRecommendations } from "@/lib/domain/observer-network";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countFiltered(supabase: SupabaseServerClient, table: string, apply: (query: any) => any) {
  const { count, error } = await apply(supabase.from(table as any).select("*", { count: "exact", head: true }));
  logSupabaseError(`observer network count ${table}`, error);
  return error ? 0 : count ?? 0;
}

function groupCount(rows: any[], key: string) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, row) => {
    const value = String(row[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {})).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export default async function AdminObserverNetworkPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer network", async () => {
    const supabase = await createClient();
    const [
      activeSites,
      activeCameras,
      totalCameras,
      unhealthyCameras,
      observerAlerts,
      unresolvedSignals,
      signalsRes,
      recommendationsRes,
      sitesRes,
      gardensRes,
      camerasRes,
      reviewsRes,
      complianceRes
    ] = await Promise.all([
      countFiltered(supabase, "observer_sites", (query) => query.eq("active", true)),
      countFiltered(supabase, "camera_streams", (query) => query.eq("active", true).not("status", "in", "(offline,failed,error,disabled,pending_gateway)")),
      countFiltered(supabase, "camera_streams", (query) => query.eq("active", true)),
      countFiltered(supabase, "camera_streams", (query) => query.or("status.in.(offline,failed,error,disabled,pending_gateway),health_status.in.(offline,failed,unhealthy,degraded)")),
      countFiltered(supabase, "observer_intelligence_signals", (query) => query.in("review_status", ["needs_review", "reviewing", "escalated"]).in("severity", ["high", "urgent", "critical"])),
      countFiltered(supabase, "observer_intelligence_signals", (query) => query.in("review_status", ["needs_review", "reviewing", "escalated"])),
      supabase.from("observer_intelligence_signals" as any).select("id,signal_type,source_type,kindergarten_id,observer_site_id,severity,confidence,review_status,recommended_action,risk_score,pattern_key,repeated_count,created_at,gardens(name,city),observer_sites(name,site_type)").order("risk_score", { ascending: false }).limit(300),
      supabase.from("observer_safety_recommendations" as any).select("id,signal_id,kindergarten_id,observer_site_id,recommendation_type,recommendation_text,status,created_at,gardens(name,city),observer_sites(name)").order("created_at", { ascending: false }).limit(120),
      supabase.from("observer_sites" as any).select("id,name,site_type,garden_id,active,monitoring_enabled,gardens(name,city)").limit(300),
      supabase.from("gardens" as any).select("id,name,city,last_inspection_score,safe_status").limit(500),
      supabase.from("camera_streams" as any).select("id,garden_id,observer_site_id,status,stream_status,health_status,active").limit(1000),
      supabase.from("observer_signal_reviews" as any).select("id,signal_id,review_status,reviewer_role,created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("compliance_score_snapshots" as any).select("garden_id,score,calculated_at").order("calculated_at", { ascending: false }).limit(300)
    ]);
    [signalsRes, recommendationsRes, sitesRes, gardensRes, camerasRes, reviewsRes, complianceRes].forEach((query, index) => logSupabaseError(`observer network query ${index}`, (query as any).error));
    const signals = (signalsRes.data ?? []) as any[];
    const recommendations = (recommendationsRes.data ?? []) as any[];
    const sites = (sitesRes.data ?? []) as any[];
    const gardens = (gardensRes.data ?? []) as any[];
    const cameras = (camerasRes.data ?? []) as any[];
    const reviews = (reviewsRes.data ?? []) as any[];
    const compliance = (complianceRes.data ?? []) as any[];
    const reviewedSignals = signals.filter((signal) => ["confirmed", "dismissed", "resolved"].includes(String(signal.review_status))).length + reviews.length;
    const falsePositiveSignals = reviews.filter((review) => ["dismissed"].includes(String(review.review_status))).length + signals.filter((signal) => signal.review_status === "dismissed").length;
    const complianceSignals = signals.filter((signal) => signal.signal_type === "compliance").length || compliance.length;
    const readiness = buildObserverReadinessScore({ totalCameras, activeCameras, unhealthyCameras, totalSignals: signals.length, reviewedSignals, falsePositiveSignals, unresolvedSignals, complianceSignals });
    const highRiskGardens = gardens.map((garden) => {
      const gardenSignals = signals.filter((signal) => signal.kindergarten_id === garden.id);
      const gardenCameras = cameras.filter((camera) => camera.garden_id === garden.id);
      const unhealthy = gardenCameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway", "unhealthy", "degraded"].includes(String(camera.status ?? camera.health_status ?? camera.stream_status))).length;
      const maxRisk = Math.max(0, ...gardenSignals.map((signal) => Number(signal.risk_score ?? 0)));
      return { ...garden, signals: gardenSignals.length, unresolved: gardenSignals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status))).length, unhealthy, maxRisk };
    }).filter((garden) => garden.signals || garden.unhealthy).sort((a, b) => b.maxRisk - a.maxRisk);
    return { activeSites, activeCameras, totalCameras, unhealthyCameras, observerAlerts, unresolvedSignals, signals, recommendations, sites, reviews, readiness, highRiskGardens, signalTypes: groupCount(signals, "signal_type"), patterns: groupCount(signals.filter((signal) => Number(signal.repeated_count ?? 1) > 1), "pattern_key"), queryError: [signalsRes.error, recommendationsRes.error].some(Boolean) ? "חלק מנתוני רשת התצפיתן לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null };
  }, { activeSites: 0, activeCameras: 0, totalCameras: 0, unhealthyCameras: 0, observerAlerts: 0, unresolvedSignals: 0, signals: [] as any[], recommendations: [] as any[], sites: [] as any[], reviews: [] as any[], readiness: buildObserverReadinessScore({ totalCameras: 0, activeCameras: 0, unhealthyCameras: 0, totalSignals: 0, reviewedSignals: 0, falsePositiveSignals: 0, unresolvedSignals: 0, complianceSignals: 0 }), highRiskGardens: [] as any[], signalTypes: [] as any[], patterns: [] as any[], queryError: null as string | null });

  const data = result.data;
  return (
    <DashboardShell role="admin" title="Observer Network">
      <div className="commercial-dashboard observer-network-shell">
        <PremiumDashboardHero eyebrow="Digital Observer Network" title="רשת מודיעין בטיחות מאוחדת" subtitle="חיבור מצלמות, אירועי תצפיתן, שמע, תלונות, פיקוח, ציות ובריאות מצלמות לשכבת תיעדוף אחת עם בדיקת אדם חובה." badge={`${data.readiness.readinessScore}/100`} badgeTone={data.readiness.tone} actions={<><Link className="button primary" href="/dashboard/admin/observer-calibration">כיול</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח</Link></>}>
          <div className="setup-checklist"><span>ללא האשמות אוטומטיות</span><span>ללא הודעות פאניקה להורים</span><span>בדיקת אדם חובה</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />
        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="אתרים פעילים" value={data.activeSites} hint="Observer sites" tone="good" />
          <RoleMetricCard label="מצלמות פעילות" value={`${data.activeCameras}/${data.totalCameras}`} hint={`${data.unhealthyCameras} לא תקינות`} tone={data.unhealthyCameras ? "warn" : "good"} />
          <RoleMetricCard label="התראות" value={data.observerAlerts} hint="גבוה/דחוף/קריטי" tone={data.observerAlerts ? "bad" : "good"} />
          <RoleMetricCard label="סימנים פתוחים" value={data.unresolvedSignals} hint="ממתין לבדיקה" tone={data.unresolvedSignals ? "warn" : "good"} />
          <RoleMetricCard label="כיסוי מצלמות" value={`${data.readiness.cameraCoverageScore}%`} tone={observerNetworkTone(data.readiness.cameraCoverageScore)} />
          <RoleMetricCard label="בריאות מצלמות" value={`${data.readiness.cameraHealthScore}%`} tone={observerNetworkTone(data.readiness.cameraHealthScore)} />
          <RoleMetricCard label="קצב Review" value={`${data.readiness.reviewRateScore}%`} tone={observerNetworkTone(data.readiness.reviewRateScore)} />
          <RoleMetricCard label="ציות משולב" value={`${data.readiness.complianceIntegrationScore}%`} tone={observerNetworkTone(data.readiness.complianceIntegrationScore)} />
        </section>

        <section className="observer-network-score-grid">
          <article><Camera /><span>כיסוי</span><strong>{data.readiness.cameraCoverageScore}%</strong></article>
          <article><ShieldCheck /><span>בריאות</span><strong>{data.readiness.cameraHealthScore}%</strong></article>
          <article><Eye /><span>בדיקת אדם</span><strong>{data.readiness.reviewRateScore}%</strong></article>
          <article><AlertTriangle /><span>פתוחים</span><strong>{data.readiness.unresolvedSignalScore}%</strong></article>
          <article><ClipboardCheck /><span>ציות</span><strong>{data.readiness.complianceIntegrationScore}%</strong></article>
        </section>

        <CleanSection title="תור בדיקה אנושי" subtitle="כל סימן הוא אינדיקציה בלבד. אין מסקנות אוטומטיות.">
          {data.signals.length === 0 ? <EmptyState title="אין סימנים פתוחים" text="כשתיווצר אינדיקציה שדורשת בדיקה, היא תופיע כאן." /> : <div className="observer-network-table">{data.signals.slice(0, 12).map((signal: any) => <Link href="/dashboard/admin/observer-replay" className="observer-network-row" key={signal.id}><div><strong>{signal.metadata?.title ?? signal.signal_type}</strong><span>{signal.gardens?.name ?? signal.observer_sites?.name ?? "אתר"} · {signal.source_type}</span></div><span>{signal.recommended_action ?? "בדיקה מומלצת"}</span><StatusBadge tone={observerNetworkTone(100 - Number(signal.risk_score ?? 0))}>{signal.risk_score}/100</StatusBadge></Link>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><Siren size={20} /> גנים בסיכון</h2>{data.highRiskGardens.length === 0 ? <div className="empty-mini">אין גנים בסיכון גבוה.</div> : data.highRiskGardens.slice(0, 8).map((garden: any) => <div className="list-item" key={garden.id}><div><strong>{garden.name}</strong><span>{garden.city} · {garden.unresolved} סימנים פתוחים · {garden.unhealthy} מצלמות</span></div><StatusBadge tone={observerNetworkTone(100 - garden.maxRisk)}>{garden.maxRisk}/100</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><BarChart3 size={20} /> דפוסים חוזרים</h2>{data.patterns.length === 0 ? <div className="empty-mini">אין דפוסים חוזרים מספיקים.</div> : data.patterns.slice(0, 8).map((pattern: any) => <div className="list-item" key={pattern.label}><div><strong>{pattern.label}</strong><span>חזרות ב-30 ימים</span></div><StatusBadge tone={pattern.count > 3 ? "warn" : "good"}>{pattern.count}</StatusBadge></div>)}</article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><Radar size={20} /> המלצות בטיחות</h2>{data.recommendations.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : data.recommendations.slice(0, 8).map((rec: any) => <div className="list-item" key={rec.id}><div><strong>{rec.recommendation_text}</strong><span>{rec.gardens?.name ?? rec.observer_sites?.name ?? "אתר"} · {rec.recommendation_type}</span></div><StatusBadge tone="warn">{rec.status}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><UsersRound size={20} /> גבול הורים</h2><div className="setup-checklist">{parentObserverBoundary.map((rule) => <span key={rule}>{rule}</span>)}</div></article>
        </section>

        <CleanSection title="שאלות למנהל/פקח" subtitle="שאלות מבוססות נתונים קיימים בלבד.">
          <div className="observer-question-grid">{["אילו גנים דורשים תשומת לב?", "אילו סימנים חוזרים על עצמם?", "אילו מצלמות לא יציבות?", "אילו אירועי תצפיתן ממתינים לבדיקה?"].map((question) => <Link href="/dashboard/admin/observer-network" key={question}>{question}</Link>)}</div>
        </CleanSection>

        <CleanSection title="פעולות מותרות" subtitle="המלצות זהירות בלבד, באישור אדם.">
          <div className="observer-question-grid">{safeObserverRecommendations.map((item) => <span key={item}>{item}</span>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="שחזור אירוע" text="הבנת ההקשר" href="/dashboard/admin/observer-replay" icon={Eye} />
          <ActionCard title="כיול" text="דיוק ו-false positive" href="/dashboard/admin/observer-calibration" icon={Radar} />
          <ActionCard title="פיקוח" text="ביקורת המשך" href="/dashboard/admin/national-inspections" icon={ClipboardCheck} />
          <ActionCard title="מצלמות" text="בריאות ושער וידאו" href="/dashboard/admin/camera-deployment" icon={Camera} />
        </section>
      </div>
    </DashboardShell>
  );
}
