import Link from "next/link";
import { Activity, BrainCircuit, Camera, ClipboardCheck, Gauge, ShieldCheck, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculateObserverPilotReadiness, observerPilotSafetyRules, pct, scoreTone, statusTone } from "@/lib/domain/observer-pilot";

type Row = Record<string, any>;

async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, label: string) {
  const result = await promise;
  if (result.error) {
    console.error(`[observer-pilot] ${label}`, result.error.message);
    return { rows: [] as T[], error: result.error.message ?? label };
  }
  return { rows: result.data ?? [], error: null };
}

function eventLabel(value?: string | null) {
  const labels: Record<string, string> = {
    fall_suspected: "חשד לנפילה",
    inactivity_suspected: "חוסר תנועה לבדיקה",
    high_velocity_motion: "תנועה מהירה",
    crowding_suspected: "צפיפות לבדיקה",
    restricted_area_presence: "אזור מוגבל",
    person_down_suspected: "אדם/ילד במנח נמוך",
    unusual_motion_pattern: "תנועה חריגה",
    correct_detection: "זיהוי נכון",
    false_positive: "False positive",
    false_negative: "False negative",
    missed_detection: "פספוס",
    uncertain: "לא ודאי",
    needs_more_context: "צריך הקשר"
  };
  return labels[String(value ?? "")] ?? value ?? "לא ידוע";
}

export default async function AdminObserverPilotPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [pilotRuns, cameras, skeletonEvents, aiEvents, reviews, calibration, quality, adapters, frameJobs, datasets, safetyRules] = await Promise.all([
    safeQuery<Row>(supabase.from("observer_pilot_runs" as any).select("*").order("created_at", { ascending: false }).limit(50), "pilot runs"),
    safeQuery<Row>(supabase.from("camera_streams" as any).select("id,name,garden_id,area,status,health_status,gateway_registration_status,observer_shadow_mode,skeleton_analytics_ready,motion_anomaly_ready,source_category,deployment_scope,test_site_type,gardens(name)").or("observer_shadow_mode.eq.true,skeleton_analytics_ready.eq.true,motion_anomaly_ready.eq.true").order("created_at", { ascending: false }).limit(120), "pilot cameras"),
    safeQuery<Row>(supabase.from("skeleton_observer_events" as any).select("id,event_type,severity,confidence,review_status,parent_visible,model_provider,model_version,model_mode,camera_id,garden_id,zone_id,event_timestamp,camera_streams(name),gardens(name)").order("event_timestamp", { ascending: false }).limit(160), "skeleton events"),
    safeQuery<Row>(supabase.from("ai_camera_events" as any).select("id,event_type,severity,status,confidence_score,review_outcome,shadow_mode,observer_shadow_mode,parent_visible,model_provider,model_version,model_mode,camera_id,created_at,camera_streams(name)").eq("shadow_mode", true).order("created_at", { ascending: false }).limit(120), "ai camera events"),
    safeQuery<Row>(supabase.from("observer_ground_truth_reviews" as any).select("*, camera_streams(name), gardens(name), profiles(full_name)").order("created_at", { ascending: false }).limit(180), "ground truth reviews"),
    safeQuery<Row>(supabase.from("observer_calibration_profiles" as any).select("*, camera_streams(name), camera_zones(name)").order("updated_at", { ascending: false }).limit(120), "calibration profiles"),
    safeQuery<Row>(supabase.from("observer_pilot_quality_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(60), "quality snapshots"),
    safeQuery<Row>(supabase.from("observer_pose_adapter_readiness" as any).select("*").order("provider"), "pose adapters"),
    safeQuery<Row>(supabase.from("observer_frame_sampling_jobs" as any).select("*, camera_streams(name)").order("created_at", { ascending: false }).limit(80), "frame sampling jobs"),
    safeQuery<Row>(supabase.from("observer_pilot_dataset_registry" as any).select("*").order("created_at", { ascending: false }).limit(40), "dataset registry"),
    safeQuery<Row>(supabase.from("observer_pilot_safety_rules" as any).select("*").order("rule_key"), "safety rules")
  ]);

  const allEvents = [...skeletonEvents.rows, ...aiEvents.rows];
  const pendingReview = allEvents.filter((event) => ["detected", "pending_review", "reviewing", "open"].includes(String(event.review_status ?? event.status)));
  const falsePositive = reviews.rows.filter((review) => review.outcome === "false_positive").length;
  const falseNegative = reviews.rows.filter((review) => review.outcome === "false_negative" || review.outcome === "missed_detection").length;
  const uncertain = reviews.rows.filter((review) => review.outcome === "uncertain" || review.outcome === "needs_more_context").length;
  const stableCameras = cameras.rows.filter((camera) => ["registered", "connected", "healthy"].includes(String(camera.gateway_registration_status ?? camera.status ?? camera.health_status))).length;
  const computed = calculateObserverPilotReadiness({
    detections: allEvents.length,
    pendingReview: pendingReview.length,
    reviewed: reviews.rows.length,
    falsePositive,
    falseNegative,
    uncertain,
    cameras: cameras.rows.length,
    stableCameras
  });
  const latestQuality = quality.rows[0];
  const readinessScore = Math.max(computed.readiness, Number(latestQuality?.readiness_score ?? 0));
  const calibrationScore = Math.max(computed.calibration, Number(latestQuality?.calibration_score ?? 0));
  const queryError = [pilotRuns.error, cameras.error, skeletonEvents.error, aiEvents.error, reviews.error, calibration.error, quality.error, adapters.error, frameJobs.error, datasets.error, safetyRules.error].filter(Boolean).join(" · ") || null;

  return (
    <DashboardShell role="admin" title="AI Observer Pilot">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Real AI Observer Pilot"
          title="פיילוט תצפיתן AI במצב Shadow"
          subtitle="בדיקת מצלמות אמיתיות או בדיקה, Pose/Skeleton, תנועה, review אנושי וכיול. אין פעולה אוטומטית ואין חשיפה להורים."
          badge={`${readinessScore}/100`}
          badgeTone={scoreTone(readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/camera-gateway">Camera Gateway</Link><Link className="button secondary" href="/dashboard/admin/skeleton-analytics">Skeleton Analytics</Link></>}
        >
          <div className="setup-checklist">
            {observerPilotSafetyRules.slice(0, 4).map((rule) => <span key={rule}>{rule}</span>)}
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="Pilot readiness" value={`${readinessScore}/100`} hint={computed.blockerReason ?? "מדד פיילוט"} tone={scoreTone(readinessScore)} />
          <RoleMetricCard label="Calibration" value={`${calibrationScore}/100`} hint="בשלות כיול" tone={scoreTone(calibrationScore)} />
          <RoleMetricCard label="Pilot cameras" value={cameras.rows.length} hint={`${stableCameras} יציבות`} tone={stableCameras ? "good" : "warn"} />
          <RoleMetricCard label="Detection volume" value={allEvents.length} hint="AI + Skeleton shadow" tone={allEvents.length ? "good" : "warn"} />
          <RoleMetricCard label="Review queue" value={pendingReview.length} hint="בדיקת אדם חובה" tone={pendingReview.length ? "warn" : "good"} />
          <RoleMetricCard label="False positives" value={falsePositive} hint={pct(computed.falsePositiveRate)} tone={computed.falsePositiveRate > 0.15 ? "bad" : "good"} />
          <RoleMetricCard label="False negatives" value={falseNegative} hint={pct(computed.falseNegativeRate)} tone={computed.falseNegativeRate > 0.1 ? "bad" : "good"} />
          <RoleMetricCard label="Reviewed" value={reviews.rows.length} hint={pct(computed.reviewedRatio)} tone={reviews.rows.length ? "good" : "warn"} />
        </div>

        <CleanSection title="Shadow Mode Enforcement" subtitle="כל זיהוי אמיתי נשאר פנימי עד review אנושי.">
          <div className="communication-template-grid">
            {observerPilotSafetyRules.map((rule) => (
              <article className="communication-template-card" key={rule}>
                <div><strong>{rule}</strong><span>נאכף כמדיניות פיילוט</span></div>
                <StatusBadge tone="good">enforced</StatusBadge>
              </article>
            ))}
          </div>
        </CleanSection>

        <CleanSection title="Pilot Cameras & Inputs" subtitle="מקורות מ־Camera Gateway, מצלמת בית, demo או גן בדיקה.">
          {cameras.rows.length ? (
            <div className="communication-log-list">
              {cameras.rows.slice(0, 12).map((camera) => (
                <article className="communication-log-row" key={camera.id}>
                  <div>
                    <strong>{camera.name ?? "מצלמה"} · {camera.gardens?.name ?? "בדיקה"}</strong>
                    <span>{camera.source_category ?? camera.deployment_scope ?? camera.test_site_type ?? "gateway"} · {camera.area ?? "אזור לא מוגדר"}</span>
                  </div>
                  <StatusBadge tone={statusTone(camera.gateway_registration_status ?? camera.health_status ?? camera.status)}>{camera.gateway_registration_status ?? camera.health_status ?? camera.status ?? "pending"}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין מצלמות פיילוט" text="חבר מצלמת בית או demo דרך Camera Gateway כדי להתחיל shadow pilot." />}
        </CleanSection>

        <CleanSection title="Human Review Queue" subtitle="detected → pending_review → dismissed / confirmed / needs_followup / uncertain → closed.">
          {pendingReview.length ? (
            <div className="communication-log-list">
              {pendingReview.slice(0, 14).map((event) => (
                <article className="communication-log-row" key={`${event.id}-${event.event_type}`}>
                  <div>
                    <strong>{eventLabel(event.event_type)}</strong>
                    <span>{event.camera_streams?.name ?? "מצלמה"} · confidence {Math.round(Number(event.confidence ?? event.confidence_score ?? 0) * 100)}% · {event.model_provider ?? "local_mock"}</span>
                  </div>
                  <StatusBadge tone={statusTone(event.review_status ?? event.status)}>{event.review_status ?? event.status}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין אירועים ממתינים" text="זיהויי shadow חדשים יופיעו כאן לבדיקה אנושית." />}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Ground Truth & Errors" subtitle="מעקב false positives, false negatives והקשר כיול.">
            {reviews.rows.length ? (
              <div className="communication-log-list">
                {reviews.rows.slice(0, 10).map((review) => (
                  <article className="communication-log-row" key={review.id}>
                    <div>
                      <strong>{eventLabel(review.outcome)} · {review.camera_streams?.name ?? review.event_source}</strong>
                      <span>{review.false_positive_reason ?? review.expected_event_type ?? review.reviewer_note ?? "review logged"}</span>
                    </div>
                    <StatusBadge tone={statusTone(review.outcome)}>{eventLabel(review.outcome)}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="עוד אין Ground Truth" text="תוצאות review יוצרות את בסיס הכיול." />}
          </CleanSection>

          <CleanSection title="Pose Adapters" subtitle="YOLOv8-Pose, MediaPipe, local HTTP ו-mock fallback.">
            <div className="communication-log-list">
              {adapters.rows.map((adapter) => (
                <article className="communication-log-row" key={adapter.id}>
                  <div><strong>{adapter.model_name}</strong><span>{adapter.provider} · {adapter.notes}</span></div>
                  <StatusBadge tone={statusTone(adapter.status)}>{adapter.status}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Calibration Profiles" subtitle="ספים לפי אתר, גן, מצלמה, אזור וסוג אירוע.">
            <div className="communication-log-list">
              {calibration.rows.slice(0, 10).map((profile) => (
                <article className="communication-log-row" key={profile.id}>
                  <div><strong>{profile.scope_type} · {profile.event_type ?? "all events"}</strong><span>threshold {pct(Number(profile.confidence_threshold ?? 0))} · inactivity {profile.inactivity_duration_threshold_seconds ?? 45}s</span></div>
                  <StatusBadge tone={statusTone(profile.calibration_status)}>{profile.calibration_status}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Production Blockers" subtitle="הפעלה אמיתית חסומה עד שהמדדים והחוק מוכנים.">
            <div className="communication-log-list">
              {safetyRules.rows.map((rule) => (
                <article className="communication-log-row" key={rule.id}>
                  <div><strong>{rule.title}</strong><span>{rule.notes}</span></div>
                  <StatusBadge tone={statusTone(rule.status)}>{rule.status}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Pipeline & Dataset Readiness" subtitle="Gateway → frame sample → pose → skeleton/motion → signal → human review.">
          <div className="premium-action-grid">
            <ActionCard title="Frame Sampling" text={`${frameJobs.rows.length} jobs · no raw frame persistence`} href="/dashboard/admin/camera-gateway" icon={Camera} />
            <ActionCard title="Dataset Registry" text={`${datasets.rows.length} safe reviewed metadata datasets`} href="/dashboard/admin/observer-calibration" icon={ClipboardCheck} />
            <ActionCard title="Skeleton Analytics" text="אנונימי, ללא פנים/שמע/זהות" href="/dashboard/admin/skeleton-analytics" icon={BrainCircuit} />
            <ActionCard title="AI Governance" text="DPIA, capability matrix, legal mode" href="/dashboard/admin/ai-governance" icon={ShieldCheck} />
          </div>
        </CleanSection>

        {computed.productionBlocked ? <div className="error-banner"><TriangleAlert size={16} /> Production observer mode חסום: {computed.blockerReason}</div> : <div className="success-banner"><Gauge size={16} /> הפיילוט נראה בשל, אך עדיין דורש אישור משפטי/אדמין לפני production.</div>}
      </div>
    </DashboardShell>
  );
}
