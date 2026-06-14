import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculateObserverPilotReadiness, scoreTone, statusTone } from "@/lib/domain/observer-pilot";

type Row = Record<string, any>;

async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>) {
  const result = await promise;
  return result.data ?? [];
}

function label(value?: string | null) {
  const labels: Record<string, string> = {
    fall_suspected: "חשד לנפילה",
    inactivity_suspected: "חוסר תנועה לבדיקה",
    high_velocity_motion: "תנועה מהירה",
    crowding_suspected: "צפיפות לבדיקה",
    restricted_area_presence: "אזור מוגבל",
    person_down_suspected: "מנח נמוך לבדיקה",
    unusual_motion_pattern: "תנועה חריגה"
  };
  return labels[String(value ?? "")] ?? value ?? "אירוע לבדיקה";
}

export default async function GardenObserverPilotPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;

  const [cameras, skeletonEvents, reviews, calibration] = await Promise.all([
    gardenId ? safeQuery<Row>(supabase.from("camera_streams" as any).select("id,name,area,status,health_status,gateway_registration_status,observer_shadow_mode,skeleton_analytics_ready,motion_anomaly_ready").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(80)) : Promise.resolve([]),
    gardenId ? safeQuery<Row>(supabase.from("skeleton_observer_events" as any).select("id,event_type,severity,confidence,review_status,event_timestamp,camera_streams(name),camera_zones(name)").eq("garden_id", gardenId).order("event_timestamp", { ascending: false }).limit(80)) : Promise.resolve([]),
    gardenId ? safeQuery<Row>(supabase.from("observer_ground_truth_reviews" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(80)) : Promise.resolve([]),
    gardenId ? safeQuery<Row>(supabase.from("observer_calibration_profiles" as any).select("id,scope_type,event_type,calibration_status,readiness_score,confidence_threshold").eq("kindergarten_id", gardenId).order("updated_at", { ascending: false }).limit(30)) : Promise.resolve([])
  ]);

  const pendingReview = skeletonEvents.filter((event) => ["detected", "pending_review", "reviewing", "needs_followup"].includes(String(event.review_status)));
  const falsePositive = reviews.filter((review) => review.outcome === "false_positive").length;
  const falseNegative = reviews.filter((review) => review.outcome === "false_negative" || review.outcome === "missed_detection").length;
  const stableCameras = cameras.filter((camera) => ["registered", "connected", "healthy"].includes(String(camera.gateway_registration_status ?? camera.status ?? camera.health_status))).length;
  const readiness = calculateObserverPilotReadiness({
    detections: skeletonEvents.length,
    pendingReview: pendingReview.length,
    reviewed: reviews.length,
    falsePositive,
    falseNegative,
    uncertain: reviews.filter((review) => ["uncertain", "needs_more_context"].includes(String(review.outcome))).length,
    cameras: cameras.length,
    stableCameras
  });

  return (
    <DashboardShell role="manager" title="פיילוט תצפיתן">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Observer Pilot"
          title="תצפיתן AI במצב בדיקה"
          subtitle="המערכת מציגה סימנים לבדיקה בלבד. אין הודעות להורים, אין מסקנות אוטומטיות ואין פעולה ללא החלטת אדם."
          badge={`${readiness.readiness}/100`}
          badgeTone={scoreTone(readiness.readiness)}
          actions={<><Link className="button primary" href="/dashboard/garden/cameras">מצלמות</Link><Link className="button secondary" href="/dashboard/garden/tasks">משימות</Link></>}
        />

        <div className="premium-metric-grid">
          <RoleMetricCard label="אירועים לבדיקה" value={pendingReview.length} hint="דורש review אנושי" tone={pendingReview.length ? "warn" : "good"} />
          <RoleMetricCard label="מצלמות מכוסות" value={`${stableCameras}/${cameras.length}`} hint="בריאות Gateway" tone={stableCameras === cameras.length && cameras.length ? "good" : "warn"} />
          <RoleMetricCard label="כיול" value={`${readiness.calibration}/100`} hint="מבוסס review" tone={scoreTone(readiness.calibration)} />
          <RoleMetricCard label="בדיקות שבוצעו" value={reviews.length} hint="Ground truth" tone={reviews.length ? "good" : "warn"} />
        </div>

        <CleanSection title="מה דורש בדיקה" subtitle="שפה זהירה: סימן תנועה, לא מסקנה.">
          {pendingReview.length ? (
            <div className="communication-log-list">
              {pendingReview.slice(0, 12).map((event) => (
                <article className="communication-log-row" key={event.id}>
                  <div>
                    <strong>{label(event.event_type)}</strong>
                    <span>{event.camera_streams?.name ?? "מצלמה"} · {event.camera_zones?.name ?? "אזור"} · {new Date(event.event_timestamp).toLocaleString("he-IL")}</span>
                  </div>
                  <StatusBadge tone={statusTone(event.review_status)}>{event.review_status}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין אירועים שממתינים לבדיקה" text="כאשר התצפיתן יזהה סימן תנועה, הוא יופיע כאן לבדיקה." />}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="כיסוי מצלמות" subtitle="מצלמות יציבות משפרות את איכות הפיילוט.">
            <div className="communication-log-list">
              {cameras.map((camera) => (
                <article className="communication-log-row" key={camera.id}>
                  <div><strong>{camera.name}</strong><span>{camera.area ?? "אזור"} · Shadow mode {camera.observer_shadow_mode ? "פעיל" : "כבוי"}</span></div>
                  <StatusBadge tone={statusTone(camera.gateway_registration_status ?? camera.health_status ?? camera.status)}>{camera.gateway_registration_status ?? camera.health_status ?? camera.status}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="כיול והמלצות" subtitle="אין צורך במונחים טכניים כדי לקבל החלטה.">
            {calibration.length ? calibration.map((profile) => (
              <article className="communication-log-row" key={profile.id}>
                <div><strong>{profile.event_type ?? "כל האירועים"}</strong><span>סף ביטחון {Math.round(Number(profile.confidence_threshold ?? 0) * 100)}%</span></div>
                <StatusBadge tone={statusTone(profile.calibration_status)}>{profile.calibration_status}</StatusBadge>
              </article>
            )) : <EmptyState title="כיול עדיין בתחילת הדרך" text="המערכת צריכה עוד בדיקות אנושיות כדי להשתפר." />}
          </CleanSection>
        </section>

        <CleanSection title="כללי בטיחות" subtitle="הפיילוט לא מפעיל שום פעולה לבד.">
          <div className="communication-template-grid">
            <article className="communication-template-card"><div><strong>בדיקת אדם חובה</strong><span>כל סימן צריך אישור מנהלת/אדמין/מפקח.</span></div><StatusBadge tone="good">פעיל</StatusBadge></article>
            <article className="communication-template-card"><div><strong>הורים לא רואים raw AI</strong><span>רק סיכום מאושר יכול להפוך להודעה.</span></div><StatusBadge tone="good">חסום</StatusBadge></article>
            <article className="communication-template-card"><div><strong>אין שמע או זיהוי פנים</strong><span>מצב ישראל לגני ילדים.</span></div><StatusBadge tone="good">נאכף</StatusBadge></article>
            <article className="communication-template-card"><div><strong>החלטה אנושית</strong><span>המערכת ממליצה בלבד.</span></div><StatusBadge tone="good">חובה</StatusBadge></article>
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
