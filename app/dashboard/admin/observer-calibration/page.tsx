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

async function safeRows<T>(run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
  try {
    const result = await run();
    return { data: result.error ? [] : result.data ?? [], error: result.error, failed: Boolean(result.error) };
  } catch (error) {
    return { data: [], error, failed: true };
  }
}

export default async function AdminObserverCalibrationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer calibration", async () => {
    const supabase = await createClient();
    const [profilesRes, reviewsRes, performanceRes, trainingRes, modelsRes, sessionsRes, aiEventsRes, audioEventsRes, correlatedRes, replayRes] = await Promise.all([
      safeRows(() => supabase.from("observer_calibration_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(200)),
      safeRows(() => supabase.from("observer_ground_truth_reviews" as any).select("*").order("created_at", { ascending: false }).limit(500)),
      safeRows(() => supabase.from("observer_performance_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(120)),
      safeRows(() => supabase.from("observer_training_readiness" as any).select("*").order("dataset_readiness_score", { ascending: false }).limit(120)),
      safeRows(() => supabase.from("observer_model_readiness_catalog" as any).select("*").order("model_name")),
      safeRows(() => supabase.from("observer_test_sessions" as any).select("*").order("created_at", { ascending: false }).limit(100)),
      safeRows(() => supabase.from("ai_camera_events" as any).select("id,event_type,description,severity,status,confidence_score,combined_confidence,observer_recommendation,recommended_action,ground_truth_outcome,observer_shadow_mode,created_at").eq("observer_shadow_mode", true).order("created_at", { ascending: false }).limit(160)),
      safeRows(() => supabase.from("audio_observer_events" as any).select("id,event_type,severity,confidence,review_status,created_at,metadata").order("created_at", { ascending: false }).limit(120)),
      safeRows(() => supabase.from("observer_correlated_events" as any).select("id,correlation_type,severity,status,confidence,created_at,confidence_factors").order("created_at", { ascending: false }).limit(120)),
      safeRows(() => supabase.from("observer_event_replay_logs" as any).select("*").order("created_at", { ascending: false }).limit(80))
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
      errors: [profilesRes, reviewsRes, performanceRes, trainingRes, modelsRes, sessionsRes, aiEventsRes, audioEventsRes, correlatedRes, replayRes].map((query) => query.failed)
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
    errors: Array(10).fill(true) as boolean[]
  });
  const { accuracy } = result.data;
  const errors = result.data.errors;
  const reviewAvailable = !errors[1];
  const confidenceAvailable = [1, 6, 7, 8].every((index) => !errors[index]);
  const readinessAvailable = confidenceAvailable && !errors[0];
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
          badge={readinessAvailable ? `${accuracy.readinessScore}/100` : "לא זמין"}
          badgeTone={readinessAvailable ? scoreTone(accuracy.readinessScore) : "warn"}
          actions={<><Link className="button primary" href="/dashboard/admin/observer-replay">Replay</Link><Link className="button secondary" href="/dashboard/admin/observer-test-center">בדיקות תצפיתן</Link></>}
        >
          <div className="setup-checklist">
            {observerSafetyRules.slice(0, 3).map((rule) => <span key={rule}>{rule}</span>)}
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? (errors.some(Boolean) ? "חלק מנתוני הכיול אינם זמינים כרגע" : null)} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="Readiness" value={readinessAvailable ? `${accuracy.readinessScore}/100` : "לא זמין"} hint="מדד מוכנות כולל" tone={readinessAvailable ? scoreTone(accuracy.readinessScore) : "warn"} />
          <RoleMetricCard label="Maturity" value={readinessAvailable ? `${accuracy.maturityScore}/100` : "לא זמין"} hint="בשלות למידה" tone={readinessAvailable ? scoreTone(accuracy.maturityScore) : "warn"} />
          <RoleMetricCard label="Confidence" value={confidenceAvailable ? pct(accuracy.confidenceAverage) : "לא זמין"} hint={confidenceAvailable ? confidenceLabel(accuracy.confidenceAverage) : "לא זמין"} tone={confidenceAvailable && accuracy.confidenceAverage >= 0.7 ? "good" : "warn"} />
          <RoleMetricCard label="Stability" value={confidenceAvailable ? pct(accuracy.confidenceStability) : "לא זמין"} hint="יציבות ביטחון" tone={confidenceAvailable && accuracy.confidenceStability >= 0.7 ? "good" : "warn"} />
          <RoleMetricCard label="Reviewed" value={reviewAvailable ? accuracy.reviewed : "לא זמין"} hint="Ground truth" tone={reviewAvailable && accuracy.reviewed ? "good" : "warn"} />
          <RoleMetricCard label="Precision" value={reviewAvailable ? pct(accuracy.precision) : "לא זמין"} hint="זיהויים נכונים מתוך חיוביים" tone={reviewAvailable && accuracy.precision >= 0.75 ? "good" : "warn"} />
          <RoleMetricCard label="Recall" value={reviewAvailable ? pct(accuracy.recall) : "לא זמין"} hint="כמה זיהויים לא פוספסו" tone={reviewAvailable && accuracy.recall >= 0.7 ? "good" : "warn"} />
          <RoleMetricCard label="False positive" value={reviewAvailable ? pct(accuracy.falsePositiveRate) : "לא זמין"} hint={reviewAvailable ? `${accuracy.falsePositive} מקרים` : "לא זמין"} tone={reviewAvailable ? accuracy.falsePositiveRate > 0.2 ? "bad" : "good" : "warn"} />
        </div>

        <CleanSection title="מה נמדד" subtitle="דיוק, פספוסים, טעויות, יציבות ביטחון ומוכנות אימון.">
          <section className="grid cols-2 dashboard-panels">
            <article className="card action-panel">
              <h2><TrendingUp size={20} /> Accuracy engine</h2>
              <div className="risk-list">
                <div><CheckCircle2 /> Correct detection <b>{reviewAvailable ? accuracy.correct : "לא זמין"}</b></div>
                <div><Activity /> Missed detection <b>{reviewAvailable ? accuracy.missed : "לא זמין"}</b></div>
                <div><ShieldCheck /> False positive <b>{reviewAvailable ? accuracy.falsePositive : "לא זמין"}</b></div>
                <div><ShieldCheck /> False negative <b>{reviewAvailable ? accuracy.falseNegative : "לא זמין"}</b></div>
                <div><Gauge /> Uncertain <b>{reviewAvailable ? accuracy.uncertain : "לא זמין"}</b></div>
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
          {errors[0] ? <div className="empty-state">נתוני הפרופילים אינם זמינים כרגע</div> : result.data.profiles.length === 0 ? <EmptyState title="אין פרופילי כיול" text="לאחר הרצת המיגרציה יופיעו פרופילי home, business, kindergarten ו-demo." /> : (
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
            {errors[3] ? <div className="empty-mini">נתוני מוכנות האימון אינם זמינים כרגע</div> : result.data.training.length === 0 ? <div className="empty-mini">אין מעקב אימון.</div> : result.data.training.map((item: any) => (
              <div className="list-item" key={item.id ?? item.readiness_key}>
                <div><strong>{item.readiness_key}</strong><span>{item.notes ?? "מוכנות אימון בלבד, לא dataset אמיתי."}</span></div>
                <StatusBadge tone={statusTone(item.training_status)}>{item.dataset_readiness_score}/100</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><SlidersHorizontal size={20} /> Status</h2>
            <div className="risk-list">
              <div>Calibration ready <b>{errors[0] ? "לא זמין" : `${calibrationReady}/${result.data.profiles.length}`}</b></div>
              <div>Training ready <b>{errors[3] ? "לא זמין" : `${trainingReady}/${result.data.training.length}`}</b></div>
              <div>Replay logs <b>{errors[9] ? "לא זמין" : result.data.replayLogs.length}</b></div>
              <div>Latest snapshot <b>{errors[2] ? "לא זמין" : latestSnapshot ? `${latestSnapshot.readiness_score}/100` : "אין"}</b></div>
              <div>Current training status <b>{reviewAvailable ? accuracy.trainingStatus : "לא זמין"}</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="מודלים עתידיים" subtitle="ארכיטקטורה בלבד. אף מודל לא מופעל אוטומטית.">
          {errors[4] ? <div className="empty-state">נתוני המודלים אינם זמינים כרגע</div> : result.data.models.length === 0 ? <EmptyState title="אין קטלוג מודלים" text="YOLO, OpenCV, TensorFlow, Gemini Vision, GPT Vision ו-custom יופיעו אחרי המיגרציה." /> : (
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
