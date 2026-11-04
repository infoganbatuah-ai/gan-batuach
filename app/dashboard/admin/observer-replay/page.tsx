import Link from "next/link";
import { createHash } from "node:crypto";
import { Activity, Bot, FileText, Headphones, RotateCcw, ShieldCheck, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { ObserverTestCenterReviewPanel } from "@/components/observer-test-center-review-panel";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverEventFeed, calculateObserverAccuracy, observerSafetyRules, statusTone } from "@/lib/domain/observer-calibration";

function sourceIcon(source: string) {
  if (source === "audio_observer_event") return <Headphones size={18} />;
  if (source === "observer_correlated_event") return <Activity size={18} />;
  if (source === "observer_summary") return <FileText size={18} />;
  return <Video size={18} />;
}

async function safeRows(query: PromiseLike<{ data: unknown; error: unknown }>, index: number) {
  try {
    const result = await query;
    logSupabaseError(`observer replay query ${index}`, result.error);
    return { data: result.error ? [] : (result.data ?? []), failed: Boolean(result.error) };
  } catch {
    logSupabaseError(`observer replay query ${index}`, true);
    return { data: [], failed: true };
  }
}

export default async function AdminObserverReplayPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer replay", async () => {
    const supabase = await createClient();
    const [aiEventsRes, audioEventsRes, correlatedRes, summariesRes, replayLogsRes, reviewsRes, profilesRes] = await Promise.all([
      safeRows(supabase.from("ai_camera_events" as any).select("id,event_type,description,severity,status,confidence_score,combined_confidence,observer_recommendation,recommended_action,ground_truth_outcome,observer_shadow_mode,created_at,metadata").eq("observer_shadow_mode", true).order("created_at", { ascending: false }).limit(120), 0),
      safeRows(supabase.from("audio_observer_events" as any).select("id,event_type,severity,confidence,review_status,created_at,metadata").order("created_at", { ascending: false }).limit(100), 1),
      safeRows(supabase.from("observer_correlated_events" as any).select("id,correlation_type,severity,status,confidence,created_at,confidence_factors").order("created_at", { ascending: false }).limit(100), 2),
      safeRows(supabase.from("observer_situation_summaries" as any).select("id,summary_type,title,summary_text,severity,confidence_score,generated_at,created_at,metadata").order("created_at", { ascending: false }).limit(80), 3),
      safeRows(supabase.from("observer_event_replay_logs" as any).select("*").order("created_at", { ascending: false }).limit(120), 4),
      safeRows(supabase.from("observer_ground_truth_reviews" as any).select("*").order("created_at", { ascending: false }).limit(300), 5),
      safeRows(supabase.from("observer_calibration_profiles" as any).select("*").order("updated_at", { ascending: false }).limit(120), 6)
    ]);
    const failures = [aiEventsRes.failed, audioEventsRes.failed, correlatedRes.failed, summariesRes.failed, replayLogsRes.failed, reviewsRes.failed, profilesRes.failed];
    const events = buildObserverEventFeed({
      aiEvents: (aiEventsRes.data ?? []) as any[],
      audioEvents: (audioEventsRes.data ?? []) as any[],
      correlatedEvents: (correlatedRes.data ?? []) as any[],
      summaries: (summariesRes.data ?? []) as any[]
    });
    const reviews = (reviewsRes.data ?? []) as any[];
    const profiles = (profilesRes.data ?? []) as any[];
    return {
      events,
      replayableEvents: events.filter((event) => event.event_source !== "observer_summary"),
      summaries: (summariesRes.data ?? []) as any[],
      replayLogs: (replayLogsRes.data ?? []) as any[],
      reviews,
      accuracy: calculateObserverAccuracy(reviews, events, profiles),
      failures,
      queryError: failures.some(Boolean) ? "חלק מנתוני Replay לא נטענו" : null
    };
  }, {
    events: [] as any[],
    replayableEvents: [] as any[],
    summaries: [] as any[],
    replayLogs: [] as any[],
    reviews: [] as any[],
    accuracy: calculateObserverAccuracy([], [], []),
    failures: Array(7).fill(true) as boolean[],
    queryError: null as string | null
  });
  const latestReplay = result.data.replayLogs[0];
  const failures = result.data.failures;
  const replayableAvailable = ![0, 1, 2].some((index) => failures[index]);
  const readinessAvailable = ![0, 1, 2, 3, 5, 6].some((index) => failures[index]);
  const panelEvents = result.data.replayableEvents.slice(0, 50);
  const panelKey = createHash("sha256").update(JSON.stringify(panelEvents)).digest("hex");
  const replayBySource = result.data.replayLogs.reduce<Record<string, number>>((acc: Record<string, number>, replay: any) => {
    const source = replay.event_source ?? "unknown";
    acc[source] = (acc[source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardShell role="admin" title="Replay תצפיתן">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Observer Replay"
          title="Replay והבנת אירועים"
          subtitle="בדיקה אנושית של אירועי מצלמה, שמע, קורלציה וסיכומי תצפיתן. אין חשיפת מדיה גולמית ואין פעולה אוטומטית."
          badge="Human review"
          badgeTone="warn"
          actions={<><Link className="button primary" href="/dashboard/admin/observer-calibration">כיול</Link><Link className="button secondary" href="/dashboard/admin/observer-test-center">Ground truth</Link></>}
        >
          <div className="setup-checklist">
            {observerSafetyRules.slice(0, 3).map((rule) => <span key={rule}>{rule}</span>)}
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? result.data.queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="אירועים ל-Replay" value={replayableAvailable ? result.data.replayableEvents.length : "לא זמין"} hint="מצלמה, שמע, קורלציה" tone={replayableAvailable && result.data.replayableEvents.length ? "good" : "warn"} />
          <RoleMetricCard label="Replay logs" value={failures[4] ? "לא זמין" : result.data.replayLogs.length} hint="בדיקות שנשמרו" />
          <RoleMetricCard label="Ground truth" value={failures[5] ? "לא זמין" : result.data.reviews.length} hint="סיווגים אנושיים" tone={!failures[5] && result.data.reviews.length ? "good" : "warn"} />
          <RoleMetricCard label="Readiness" value={readinessAvailable ? `${result.data.accuracy.readinessScore}/100` : "לא זמין"} hint="לפי דיוק ויציבות" tone={readinessAvailable && result.data.accuracy.readinessScore >= 80 ? "good" : "warn"} />
        </div>

        <CleanSection title="Replay workflow" subtitle="האירוע מוצג עם גורמי הביטחון והמלצת התצפיתן. הבודק מסווג, והכיול מתעדכן.">
          {!replayableAvailable && <div className="status-banner">רשימת האירועים חלקית או אינה זמינה כרגע.</div>}
          {panelEvents.length === 0 ? (
            replayableAvailable ? <EmptyState title="אין אירועים ל-Replay" text="אירועי Shadow mode יופיעו כאן לאחר יצירתם." /> : <EmptyState title="אירועי Replay אינם זמינים" text="לא ניתן להציג רשימת אירועים מלאה כרגע." />
          ) : (
            <ObserverTestCenterReviewPanel key={panelKey} events={panelEvents} />
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><RotateCcw size={20} /> Replay אחרונים</h2>
            {failures[4] ? <div className="empty-mini">נתוני Replay אינם זמינים כרגע.</div> : result.data.replayLogs.length === 0 ? <div className="empty-mini">אין Replay שנשמרו.</div> : result.data.replayLogs.slice(0, 8).map((replay: any) => (
              <div className="list-item" key={replay.id}>
                <div><strong>{replay.event_source}</strong><span>{replay.replay_reason ?? "בדיקה אנושית"} · {replay.created_at ? new Date(replay.created_at).toLocaleString("he-IL") : ""}</span></div>
                <StatusBadge tone={statusTone(replay.replay_status)}>{replay.replay_status}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> בטיחות Replay</h2>
            <div className="risk-list">
              <div>Raw media <b>לא נחשף</b></div>
              <div>Human review <b>חובה</b></div>
              <div>Automatic action <b>חסום</b></div>
              <div>Last replay <b>{failures[4] ? "לא זמין" : latestReplay ? latestReplay.replay_status : "אין"}</b></div>
              <div>AI / Audio / Correlation <b>{failures[4] ? "לא זמין" : Object.values(replayBySource).reduce((sum: number, value: any) => sum + Number(value), 0)}</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="סיכומי תצפיתן" subtitle="סיכומים מוצגים להבנה בלבד. הם לא יוצרים החלטה או האשמה.">
          {failures[3] ? <EmptyState title="סיכומי תצפיתן אינם זמינים" text="לא ניתן לטעון את הסיכומים כרגע." /> : result.data.summaries.length === 0 ? <EmptyState title="אין סיכומים" text="כאשר ייווצרו סיכומי תצפיתן, הם יופיעו כאן כחומר לבדיקה." /> : (
            <div className="procedure-list">
              {result.data.summaries.slice(0, 12).map((summary: any) => (
                <article className="card procedure-card" key={summary.id}>
                  <div>
                    <span className="pill warn"><Bot size={14} /> לבדיקה</span>
                    <h3>{summary.title ?? summary.summary_type ?? "סיכום תצפיתן"}</h3>
                    <p>{summary.summary_text ?? "סיכום קצר לבדיקה אנושית."}</p>
                    <small>Confidence {Math.round(Number(summary.confidence_score ?? 0) * 100)}% · {summary.created_at ? new Date(summary.created_at).toLocaleString("he-IL") : ""}</small>
                  </div>
                  <div className="procedure-meta"><StatusBadge tone="warn">No action</StatusBadge></div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="מקורות אירועים" subtitle="מבט מהיר על סוגי המידע שנבדקים.">
          <div className="premium-action-grid">
            {["ai_camera_event", "audio_observer_event", "observer_correlated_event", "observer_summary"].map((source, index) => (
              <article className="premium-action-card" key={source}>
                {sourceIcon(source)}
                <strong>{source}</strong>
                <span>{failures[index] ? "לא זמין" : <>{result.data.events.filter((event: any) => event.event_source === source).length} אירועים</>}</span>
              </article>
            ))}
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
