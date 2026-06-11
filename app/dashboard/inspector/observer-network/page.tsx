import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, Eye, Radar, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverReadinessScore, observerNetworkTone, safeObserverRecommendations } from "@/lib/domain/observer-network";

export default async function InspectorObserverNetworkPage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector observer network", async () => {
    const supabase = await createClient();
    const gardensRes = await supabase.from("gardens" as any).select("id,name,city,last_inspection_score,safe_status").eq("inspector_id", profile.id).order("name");
    logSupabaseError("inspector observer network gardens", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden) => garden.id);

    const [signalsRes, recommendationsRes, camerasRes, reviewsRes] = gardenIds.length ? await Promise.all([
      supabase.from("observer_intelligence_signals" as any).select("id,signal_type,source_type,kindergarten_id,severity,confidence,review_status,recommended_action,risk_score,pattern_key,repeated_count,created_at,gardens(name,city)").in("kindergarten_id", gardenIds).in("review_status", ["needs_review", "reviewing", "escalated"]).order("risk_score", { ascending: false }).limit(120),
      supabase.from("observer_safety_recommendations" as any).select("id,signal_id,kindergarten_id,recommendation_type,recommendation_text,status,created_at,gardens(name,city)").in("kindergarten_id", gardenIds).eq("status", "open").order("created_at", { ascending: false }).limit(80),
      supabase.from("camera_streams" as any).select("id,garden_id,kindergarten_id,status,stream_status,health_status,active").or(`garden_id.in.(${gardenIds.join(",")}),kindergarten_id.in.(${gardenIds.join(",")})`).limit(600),
      supabase.from("observer_signal_reviews" as any).select("id,signal_id,review_status,created_at").order("created_at", { ascending: false }).limit(120)
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

    [signalsRes, recommendationsRes, camerasRes, reviewsRes].forEach((res, index) => logSupabaseError(`inspector observer network ${index}`, (res as any).error));
    const signals = (signalsRes.data ?? []) as any[];
    const recommendations = (recommendationsRes.data ?? []) as any[];
    const cameras = (camerasRes.data ?? []) as any[];
    const reviews = (reviewsRes.data ?? []) as any[];
    const unhealthy = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway", "unhealthy", "degraded"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status))).length;
    const readiness = buildObserverReadinessScore({
      totalCameras: cameras.length,
      activeCameras: cameras.filter((camera) => camera.active !== false).length,
      unhealthyCameras: unhealthy,
      totalSignals: signals.length,
      reviewedSignals: reviews.length,
      falsePositiveSignals: reviews.filter((review) => review.review_status === "dismissed").length,
      unresolvedSignals: signals.length,
      complianceSignals: signals.filter((signal) => signal.signal_type === "compliance").length
    });
    const highRiskGardens = gardens.map((garden) => {
      const gardenSignals = signals.filter((signal) => signal.kindergarten_id === garden.id);
      const maxRisk = Math.max(0, ...gardenSignals.map((signal) => Number(signal.risk_score ?? 0)));
      return { ...garden, signals: gardenSignals.length, maxRisk };
    }).filter((garden) => garden.signals).sort((a, b) => b.maxRisk - a.maxRisk);

    return { gardens, signals, recommendations, cameras, unhealthy, readiness, highRiskGardens, queryError: [signalsRes.error, recommendationsRes.error].some(Boolean) ? "חלק מנתוני רשת התצפיתן לא נטענו" : null };
  }, {
    gardens: [] as any[],
    signals: [] as any[],
    recommendations: [] as any[],
    cameras: [] as any[],
    unhealthy: 0,
    readiness: buildObserverReadinessScore({ totalCameras: 0, activeCameras: 0, unhealthyCameras: 0, totalSignals: 0, reviewedSignals: 0, falsePositiveSignals: 0, unresolvedSignals: 0, complianceSignals: 0 }),
    highRiskGardens: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  return (
    <DashboardShell role="inspector" title="רשת תצפיתן">
      <div className="commercial-dashboard observer-network-shell">
        <PremiumDashboardHero eyebrow="Observer Network" title="רשת בטיחות לגנים שבאחריותך" subtitle="מצלמות, תלונות, אירועים, ציות ודפוסים חוזרים במקום אחד. כל המלצה מחייבת בדיקת פקח לפני פעולה." badge={`${data.readiness.readinessScore}/100`} badgeTone={data.readiness.tone} actions={<Link className="button primary" href="/dashboard/inspector/inspections/due">ביקורות קרובות</Link>}>
          <div className="setup-checklist"><span>{data.gardens.length} גנים משויכים</span><span>בדיקת אדם חובה</span><span>ללא מסקנות אוטומטיות</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="גנים משויכים" value={data.gardens.length} tone="good" />
          <RoleMetricCard label="דורש בדיקה" value={data.signals.length} tone={data.signals.length ? "warn" : "good"} />
          <RoleMetricCard label="המלצות" value={data.recommendations.length} tone={data.recommendations.length ? "warn" : "good"} />
          <RoleMetricCard label="מצלמות לא יציבות" value={data.unhealthy} tone={data.unhealthy ? "warn" : "good"} />
        </section>

        <CleanSection title="תור בדיקה" subtitle="המערכת מצביעה על סימנים. הפקח מחליט מה נכון לעשות.">
          {data.signals.length === 0 ? <EmptyState title="אין סימנים פתוחים" text="כאשר יופיע אירוע בגנים שבאחריותך, הוא יופיע כאן." /> : <div className="observer-network-table">{data.signals.slice(0, 12).map((signal: any) => <Link href="/dashboard/inspector/ai-events" className="observer-network-row" key={signal.id}><div><strong>{signal.signal_type === "complaint" ? "תלונה לבדיקה" : signal.signal_type === "camera_health" ? "מצלמה לא יציבה" : signal.signal_type === "compliance" ? "פער ציות" : "אירוע תצפיתן"}</strong><span>{signal.gardens?.name ?? "גן"} · {signal.recommended_action ?? "בדיקה מומלצת"}</span></div><StatusBadge tone={observerNetworkTone(100 - Number(signal.risk_score ?? 0))}>{signal.risk_score}/100</StatusBadge></Link>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><AlertTriangle size={20} /> גנים עם סיכון עולה</h2>{data.highRiskGardens.length === 0 ? <div className="empty-mini">אין דפוס סיכון חריג.</div> : data.highRiskGardens.slice(0, 8).map((garden: any) => <div className="list-item" key={garden.id}><div><strong>{garden.name}</strong><span>{garden.city ?? ""} · {garden.signals} סימנים פתוחים</span></div><StatusBadge tone={observerNetworkTone(100 - garden.maxRisk)}>{garden.maxRisk}/100</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><Radar size={20} /> המלצות פיקוח</h2>{data.recommendations.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : data.recommendations.slice(0, 8).map((rec: any) => <div className="list-item" key={rec.id}><div><strong>{rec.recommendation_text}</strong><span>{rec.gardens?.name ?? "גן"} · {rec.recommendation_type}</span></div><StatusBadge tone="warn">{rec.status}</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="פעולות מותרות" subtitle="המלצות זהירות בלבד. אין האשמות ואין פעולה אוטומטית.">
          <div className="observer-question-grid">{safeObserverRecommendations.map((item) => <span key={item}>{item}</span>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="ביקורת המשך" text="תכנון ביקורת" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} />
          <ActionCard title="התראות תצפיתן" text="בדיקה אנושית" href="/dashboard/inspector/ai-events" icon={Eye} />
          <ActionCard title="ציות" text="פערים ואימות" href="/dashboard/inspector/compliance" icon={ShieldCheck} />
          <ActionCard title="מצלמות" text="יציבות וחיבור" href="/dashboard/inspector/ai-events" icon={Camera} />
        </section>
      </div>
    </DashboardShell>
  );
}
