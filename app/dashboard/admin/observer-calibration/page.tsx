import Link from "next/link";
import { Activity, Bot, CheckCircle2, Gauge, RotateCcw, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverEventFeed, calculateObserverAccuracy, observerSafetyRules, pct, scoreTone, statusTone } from "@/lib/domain/observer-calibration";

function confidenceLabel(value: number) {
  if (value >= 0.8) return "גבוה";
  if (value >= 0.55) return "בינוני";
  if (value > 0) return "נמוך";
  return "אין מספיק מידע";
}

export default async function AdminObserverCalibrationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer calibration", async () => {
    const supabase = await createClient();
    const [profilesRes, reviewsRes, performanceRes, trainingRes, modelsRes, sessionsRes, aiEventsRes, audioEventsRes, correlatedRes, replayRes] = await Promise.all([
      supabase.from("observer_calibration_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("observer_ground_truth_reviews" as any).select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("observer_performance_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(120),
      supabase.from("observer_training_readiness" as any).select("*").order("dataset_readiness_score", { ascending: false }).limit(120),
      supabase.from("observer_model_readiness_catalog" as any).select("*").order("model_name"),
      supabase.from("observer_test_sessions" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("ai_camera_events" as any).select("id,event_type,description,severity,status,confidence_score,combined_confidence,observer_recommendation,recommended_action,ground_truth_outcome,observer_shadow_mode,created_at").eq("observer_shadow_mode", true).order("created_at", { ascending: false }).limit(160),
      supabase.from("audio_observer_events" as any).select("id,event_type,severity,confidence,review_status,created_at,metadata").order("created_at", { ascending: false }).limit(120),
      supabase.from("observer_correlated_events" as any).select("id,correlation_type,severity,status,confidence,created_at,confidence_factors").order("created_at", { ascending: false }).limit(120),
      supabase.from("observer_event_replay_logs" as any).select("*").order("created_at", { ascending: false }).limit(80)
    ]);
    [profilesRes, reviewsRes, performanceRes, trainingRes, modelsRes, sessionsRes, aiEventsRes, audioEventsRes, correlatedRes, replayRes].forEach((query, index) => logSupabaseError(`observer calibration query ${index}`, (query as any).error));
    const profiles = (profilesRes.data ?? []) as any[];
    const reviews = (reviewsRes.data ?? []) as any[];
    const events = buildObserverEventFeed({ aiEvents: (aiEventsRes.data ?? []) as any[], audioEvents: (audioEventsRes.data ?? []) as any[], correlatedEvents: (correlatedRes.data ?? []) as any[] });
    return {
      profiles,
      reviews,
      performance: (performanceRes.data ?? []) as any[],
      training: (trainingRes.data ?? []) as any[],
      models: (modelsRes.data ?? []) as any[],
      sessions: (sessionsRes.data ?? []) as any[],
      events,
      replayLogs: (replayRes.data ?? []) as any[],
      accuracy: calculateObserverAccuracy(reviews, events, profiles),
      queryError: [profilesRes.error, reviewsRes.error, performanceRes.error, trainingRes.error, modelsRes.error, sessionsRes.error, aiEventsRes.error, audioEventsRes.error, correlatedRes.error, replayRes.error].some(Boolean) ? "חלק מנתוני כיול התצפיתן לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, {
    profiles: [] as any[],
    reviews: [] as any[],
    performance: [] as any[],
    training: [] as any[],
    models: [] as any[],
    sessions: [] as any[],
    events: [] as any[],
    replayLogs: [] as any[],
    accuracy: calculateObserverAccuracy([], [], []),
    queryError: null as string | null
  });
  const { accuracy } = result.data;
  const calibrationReady = result.data.profiles.filter((profile: any) => ["review_ready", "production_candidate"].includes(profile.calibration_status)).length;
  const trainingReady = result.data.training.filter((item: any) => ["review_ready", "candidate"].includes(item.training_status)).length;
  const latestSnapshot = result.data.performance[0];

  return (
    <DashboardShell role="admin" title="כיול תצפיתן">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Observer Calibration"
          title="כיול, מדידה ואימון תצפיתן"
          subtitle="מרכז שליטה למדידת דיוק, יציבות, בשלות ומוכנות. התצפיתן נשאר ב-Shadow mode עם בדיקת אדם חובה."
          badge={`${accuracy.readinessScore}/100`}
          badgeTone={scoreTone(accuracy.readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/observer-replay">Replay</Link><Link className="button secondary" href="/dashboard/admin/observer-test-center">בדיקות תצפיתן</Link></>}
        >
          <div className="setup-checklist">
            {observerSafetyRules.slice(0, 3).map((rule) => <span key={rule}>{rule}</span>)}
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? result.data.queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="Readiness" value={`${accuracy.readinessScore}/100`} hint="מדד מוכנות כולל" tone={scoreTone(accuracy.readinessScore)} />
          <RoleMetricCard label="Maturity" value={`${accuracy.maturityScore}/100`} hint="בשלות למידה" tone={scoreTone(accuracy.maturityScore)} />
          <RoleMetricCard label="Confidence" value={pct(accuracy.confidenceAverage)} hint={confidenceLabel(accuracy.confidenceAverage)} tone={accuracy.confidenceAverage >= 0.7 ? "good" : "warn"} />
          <RoleMetricCard label="Stability" value={pct(accuracy.confidenceStability)} hint="יציבות ביטחון" tone={accuracy.confidenceStability >= 0.7 ? "good" : "warn"} />
          <RoleMetricCard label="Reviewed" value={accuracy.reviewed} hint="Ground truth" tone={accuracy.reviewed ? "good" : "warn"} />
          <RoleMetricCard label="Precision" value={pct(accuracy.precision)} hint="זיהויים נכונים מתוך חיוביים" tone={accuracy.precision >= 0.75 ? "good" : "warn"} />
          <RoleMetricCard label="Recall" value={pct(accuracy.recall)} hint="כמה זיהויים לא פוספסו" tone={accuracy.recall >= 0.7 ? "good" : "warn"} />
          <RoleMetricCard label="False positive" value={pct(accuracy.falsePositiveRate)} hint={`${accuracy.falsePositive} מקרים`} tone={accuracy.falsePositiveRate > 0.2 ? "bad" : "good"} />
        </div>

        <CleanSection title="מה נמדד" subtitle="דיוק, פספוסים, טעויות, יציבות ביטחון ומוכנות אימון.">
          <section className="grid cols-2 dashboard-panels">
            <article className="card action-panel">
              <h2><TrendingUp size={20} /> Accuracy engine</h2>
              <div className="risk-list">
                <div><CheckCircle2 /> Correct detection <b>{accuracy.correct}</b></div>
                <div><Activity /> Missed detection <b>{accuracy.missed}</b></div>
                <div><ShieldCheck /> False positive <b>{accuracy.falsePositive}</b></div>
                <div><ShieldCheck /> False negative <b>{accuracy.falseNegative}</b></div>
                <div><Gauge /> Uncertain <b>{accuracy.uncertain}</b></div>
              </div>
            </article>
            <article className="card action-panel">
              <h2><ShieldCheck size={20} /> כללי בטיחות</h2>
              <div className="setup-checklist">
                {observerSafetyRules.map((rule) => <span key={rule}>{rule}</span>)}
              </div>
            </article>
          </section>
        </CleanSection>

        <CleanSection title="פרופילי כיול" subtitle="רגישות תנועה, שמע, קהל, אזורים וספי ביטחון לפי אתר.">
          {result.data.profiles.length === 0 ? <EmptyState title="אין פרופילי כיול" text="לאחר הרצת המיגרציה יופיעו פרופילי home, business, kindergarten ו-demo." /> : (
            <div className="procedure-list">
              {result.data.profiles.map((profile: any) => (
                <article className="card procedure-card" key={profile.id}>
                  <div>
                    <StatusBadge tone={statusTone(profile.calibration_status)}>{profile.calibration_status}</StatusBadge>
                    <h3>{profile.scope_type} · {profile.observer_model ?? "local_shadow"}</h3>
                    <p>Motion {pct(Number(profile.motion_sensitivity ?? profile.sensitivity ?? 0))} · Audio {pct(Number(profile.audio_sensitivity ?? 0))} · Crowd {pct(Number(profile.crowd_sensitivity ?? 0))} · Zone {pct(Number(profile.zone_sensitivity ?? 0))}</p>
                    <small>Confidence threshold {pct(Number(profile.confidence_threshold ?? 0))} · Alert threshold {pct(Number(profile.alert_threshold ?? 0))}</small>
                  </div>
                  <div className="procedure-meta">
                    <strong>{profile.readiness_score ?? 0}/100</strong>
                    <span>{profile.learning_maturity}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Bot size={20} /> Training readiness</h2>
            {result.data.training.length === 0 ? <div className="empty-mini">אין מעקב אימון.</div> : result.data.training.map((item: any) => (
              <div className="list-item" key={item.id ?? item.readiness_key}>
                <div><strong>{item.readiness_key}</strong><span>{item.notes ?? "מוכנות אימון בלבד, לא dataset אמיתי."}</span></div>
                <StatusBadge tone={statusTone(item.training_status)}>{item.dataset_readiness_score}/100</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><SlidersHorizontal size={20} /> Status</h2>
            <div className="risk-list">
              <div>Calibration ready <b>{calibrationReady}/{result.data.profiles.length}</b></div>
              <div>Training ready <b>{trainingReady}/{result.data.training.length}</b></div>
              <div>Replay logs <b>{result.data.replayLogs.length}</b></div>
              <div>Latest snapshot <b>{latestSnapshot ? `${latestSnapshot.readiness_score}/100` : "אין"}</b></div>
              <div>Current training status <b>{accuracy.trainingStatus}</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="מודלים עתידיים" subtitle="ארכיטקטורה בלבד. אף מודל לא מופעל אוטומטית.">
          {result.data.models.length === 0 ? <EmptyState title="אין קטלוג מודלים" text="YOLO, OpenCV, TensorFlow, Gemini Vision, GPT Vision ו-custom יופיעו אחרי המיגרציה." /> : (
            <div className="premium-action-grid">
              {result.data.models.map((model: any) => (
                <article className="premium-action-card" key={model.model_key}>
                  <Bot size={22} />
                  <strong>{model.model_name}</strong>
                  <span>{model.notes}</span>
                  <StatusBadge tone={statusTone(model.activation_status)}>{model.activation_status}</StatusBadge>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="Replay Center" text="בדיקת אירועים, שמע, קורלציה וסיכומים" href="/dashboard/admin/observer-replay" icon={RotateCcw} tone="good" />
          <ActionCard title="Ground Truth" text="סיווג אנושי של תוצאות" href="/dashboard/admin/observer-test-center" icon={ShieldCheck} />
          <ActionCard title="Performance" text="מגמות דיוק ומוכנות" href="/dashboard/admin/observer-calibration" icon={TrendingUp} />
          <ActionCard title="תצפיתן" text="אירועים וסיכומים לבדיקה" href="/dashboard/admin/observer-intelligence" icon={Activity} />
        </section>
      </div>
    </DashboardShell>
  );
}
