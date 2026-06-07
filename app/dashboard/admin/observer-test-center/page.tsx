import Link from "next/link";
import { Activity, Bot, CheckCircle2, FlaskConical, Gauge, RotateCcw, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ObserverTestCenterReviewPanel } from "@/components/observer-test-center-review-panel";
import { ActionCard, CleanSection, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function readinessScore({ reviewed, falsePositiveRate, falseNegativeRate, avgConfidence, calibrationCount }: { reviewed: number; falsePositiveRate: number; falseNegativeRate: number; avgConfidence: number; calibrationCount: number }) {
  return clampScore(
    Math.min(reviewed, 60)
    + Math.min(calibrationCount * 8, 20)
    + avgConfidence * 20
    - falsePositiveRate * 25
    - falseNegativeRate * 25
  );
}

export default async function ObserverTestCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer test center", async () => {
    const supabase = await createClient();
    const [sessions, calibrations, reviews, aiEvents, audioEvents, correlatedEvents, providers, diagnostics, replayLogs, cameras] = await Promise.all([
      supabase.from("observer_test_sessions" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("observer_calibration_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(100),
      supabase.from("observer_ground_truth_reviews" as any).select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("ai_camera_events" as any).select("id,event_type,description,severity,status,confidence_score,combined_confidence,observer_recommendation,recommended_action,ground_truth_outcome,created_at").eq("observer_shadow_mode", true).order("created_at", { ascending: false }).limit(120),
      supabase.from("audio_observer_events" as any).select("id,event_type,severity,confidence,review_status,created_at,metadata").order("created_at", { ascending: false }).limit(80),
      supabase.from("observer_correlated_events" as any).select("id,correlation_type,severity,status,confidence,created_at,confidence_factors").order("created_at", { ascending: false }).limit(80),
      supabase.from("vision_provider_registry" as any).select("*").order("provider_name").limit(100),
      supabase.from("vision_diagnostics" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("observer_event_replay_logs" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("camera_streams" as any).select("id,name,test_site_type,deployment_scope,status").in("test_site_type", ["home_test","business_test","kindergarten_test"]).limit(120)
    ]);
    [sessions, calibrations, reviews, aiEvents, audioEvents, correlatedEvents, providers, diagnostics, replayLogs, cameras].forEach((query, index) => logSupabaseError(`observer test center query ${index}`, (query as any).error));
    return {
      sessions: sessions.data ?? [],
      calibrations: calibrations.data ?? [],
      reviews: reviews.data ?? [],
      aiEvents: aiEvents.data ?? [],
      audioEvents: audioEvents.data ?? [],
      correlatedEvents: correlatedEvents.data ?? [],
      providers: providers.data ?? [],
      diagnostics: diagnostics.data ?? [],
      replayLogs: replayLogs.data ?? [],
      cameras: cameras.data ?? [],
      queryError: [sessions.error, calibrations.error, reviews.error, aiEvents.error, audioEvents.error, correlatedEvents.error].some(Boolean) ? "חלק מנתוני מרכז הבדיקה לא נטענו" : null
    };
  }, { sessions: [] as any[], calibrations: [] as any[], reviews: [] as any[], aiEvents: [] as any[], audioEvents: [] as any[], correlatedEvents: [] as any[], providers: [] as any[], diagnostics: [] as any[], replayLogs: [] as any[], cameras: [] as any[], queryError: null as string | null });

  const reviews = result.data.reviews;
  const reviewed = reviews.length;
  const falsePositive = reviews.filter((review: any) => review.outcome === "false_positive").length;
  const falseNegative = reviews.filter((review: any) => review.outcome === "false_negative").length;
  const falsePositiveRate = reviewed ? falsePositive / reviewed : 0;
  const falseNegativeRate = reviewed ? falseNegative / reviewed : 0;
  const allEvents = [
    ...result.data.aiEvents.map((event: any) => ({ ...event, event_source: "ai_camera_event", confidence: event.combined_confidence ?? event.confidence_score })),
    ...result.data.audioEvents.map((event: any) => ({ ...event, event_source: "audio_observer_event" })),
    ...result.data.correlatedEvents.map((event: any) => ({ ...event, event_source: "observer_correlated_event" }))
  ].sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const avgConfidence = allEvents.length ? allEvents.reduce((sum: number, event: any) => sum + Number(event.confidence ?? event.confidence_score ?? 0), 0) / allEvents.length : 0;
  const score = readinessScore({ reviewed, falsePositiveRate, falseNegativeRate, avgConfidence, calibrationCount: result.data.calibrations.length });
  const readinessTone = score >= 80 ? "good" : score >= 55 ? "warn" : "bad";

  return (
    <DashboardShell role="admin" title="Observer Test Center">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Observer Test Center"
          title="בדיקה וכיול לתצפיתן"
          subtitle="Shadow mode בלבד. המלצות לבדיקה אנושית, ללא פעולה אוטומטית וללא האשמות."
          badge={`Readiness ${score}/100`}
          badgeTone={readinessTone}
          actions={<><Link className="button primary" href="#ground-truth-review">Ground truth</Link><Link className="button secondary" href="/dashboard/admin/ai-observer">Worker</Link></>}
        />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <div className="premium-metric-grid">
          <RoleMetricCard label="Test sessions" value={result.data.sessions.length} hint="home, business, demo" />
          <RoleMetricCard label="Reviewed" value={reviewed} hint="בדיקות אנושיות" tone={reviewed ? "good" : "warn"} />
          <RoleMetricCard label="False positive" value={pct(falsePositiveRate)} hint={`${falsePositive} מתוך ${reviewed}`} tone={falsePositiveRate > 0.2 ? "bad" : "good"} />
          <RoleMetricCard label="False negative" value={pct(falseNegativeRate)} hint={`${falseNegative} מתוך ${reviewed}`} tone={falseNegativeRate > 0.15 ? "bad" : "good"} />
        </div>

        <CleanSection title="Shadow mode" subtitle="התצפיתן מנתח וממליץ, אבל לא מפעיל פעולה אמיתית.">
          <div className="premium-action-grid">
            <ActionCard title="Human review" text="כל אירוע דורש בודק אנושי" href="#ground-truth-review" icon={ShieldCheck} tone="good" />
            <ActionCard title="Event replay" text="Replay ללא חשיפת מדיה גולמית" href="#ground-truth-review" icon={RotateCcw} />
            <ActionCard title="Calibration" text="סף ביטחון, רגישות ורעש" href="#calibration" icon={SlidersHorizontal} />
            <ActionCard title="Future models" text="YOLO, OpenCV, TensorFlow, Gemini, GPT" href="#models" icon={Bot} />
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels" id="calibration">
          <article className="card action-panel">
            <h2><Gauge size={20} /> Calibration status</h2>
            {result.data.calibrations.length === 0 ? <div className="empty-mini">אין פרופילי כיול.</div> : result.data.calibrations.map((profile: any) => (
              <div className="list-item" key={profile.id}>
                <div><strong>{profile.scope_type}</strong><span>threshold {profile.confidence_threshold} · sensitivity {profile.sensitivity} · audio {profile.audio_sensitivity}</span></div>
                <StatusBadge tone={profile.learning_maturity === "ready" ? "good" : "warn"}>{profile.learning_maturity}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Activity size={20} /> Performance analytics</h2>
            <div className="risk-list">
              <div><CheckCircle2 /> Accuracy estimate <b>{pct(Math.max(0, 1 - falsePositiveRate - falseNegativeRate))}</b></div>
              <div><FlaskConical /> Avg confidence <b>{pct(avgConfidence)}</b></div>
              <div><ShieldCheck /> Maturity score <b>{score}/100</b></div>
              <div><RotateCcw /> Replay logs <b>{result.data.replayLogs.length}</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="Test groups" subtitle="קבוצות בדיקה מבודדות מנתוני ייצור.">
          <div className="premium-metric-grid">
            <RoleMetricCard label="Home test" value={result.data.cameras.filter((camera: any) => camera.test_site_type === "home_test").length} hint="מצלמות פרטיות לבדיקה" />
            <RoleMetricCard label="Kindergarten test" value={result.data.cameras.filter((camera: any) => camera.test_site_type === "kindergarten_test").length} hint="גן ניסיון" />
            <RoleMetricCard label="Business test" value={result.data.cameras.filter((camera: any) => camera.test_site_type === "business_test").length} hint="עסק ניסיון" />
            <RoleMetricCard label="Demo events" value={allEvents.length} hint="AI, audio, correlated" />
          </div>
        </CleanSection>

        <div id="ground-truth-review">
          <ObserverTestCenterReviewPanel events={allEvents.slice(0, 40)} />
        </div>

        <CleanSection title="Future model readiness" subtitle="מוכן לתשתית, לא מופעל בפרודקשן." action={<StatusBadge tone="warn">Shadow only</StatusBadge>}>
          <div className="procedure-list">
            {result.data.providers.length === 0 ? <div className="empty-state"><strong>אין ספקי מודלים</strong><span>מיגרציות vision מוסיפות ספקי mock/local.</span></div> : result.data.providers.map((provider: any) => (
              <article className="card procedure-card" key={provider.id ?? provider.provider_key}>
                <div><span className="pill warn">Human review required</span><h3>{provider.provider_name}</h3><p>{provider.provider_type} · {provider.endpoint_required ? "דורש endpoint" : "ללא endpoint כרגע"}</p></div>
                <div className="procedure-meta"><StatusBadge tone={provider.active ? "good" : "default"}>{provider.shadow_mode_required ? "Shadow required" : "Configured"}</StatusBadge></div>
              </article>
            ))}
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
