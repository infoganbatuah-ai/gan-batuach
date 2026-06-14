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

function eventLabel(value?: string | null) {
  const labels: Record<string, string> = {
    fall_suspected: "חשד לנפילה",
    inactivity_suspected: "חוסר תנועה לבדיקה",
    high_velocity_motion: "תנועה מהירה",
    crowding_suspected: "צפיפות לבדיקה",
    restricted_area_presence: "נוכחות באזור מוגבל",
    person_down_suspected: "אדם במנח נמוך",
    unusual_motion_pattern: "תנועה לא שגרתית"
  };
  return labels[String(value ?? "")] ?? value ?? "סימן לבדיקה";
}

export default async function InspectorObserverPilotPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();

  const assignedGardens = await safeQuery<Row>(
    supabase
      .from("gardens" as any)
      .select("id,name,city,inspector_id")
      .eq("inspector_id", profile.id)
      .order("name", { ascending: true })
      .limit(80)
  );

  const gardenIds = assignedGardens.map((garden) => garden.id).filter(Boolean);

  const [signals, reviews, calibration, cameras] = gardenIds.length
    ? await Promise.all([
        safeQuery<Row>(
          supabase
            .from("skeleton_observer_events" as any)
            .select("id,garden_id,event_type,severity,confidence,review_status,event_timestamp,camera_streams(name),camera_zones(name)")
            .in("garden_id", gardenIds)
            .order("event_timestamp", { ascending: false })
            .limit(100)
        ),
        safeQuery<Row>(
          supabase
            .from("observer_ground_truth_reviews" as any)
            .select("*")
            .in("kindergarten_id", gardenIds)
            .order("created_at", { ascending: false })
            .limit(100)
        ),
        safeQuery<Row>(
          supabase
            .from("observer_calibration_profiles" as any)
            .select("id,kindergarten_id,event_type,calibration_status,readiness_score,confidence_threshold,false_positive_count,false_negative_count,reviewed_events_count")
            .in("kindergarten_id", gardenIds)
            .order("updated_at", { ascending: false })
            .limit(60)
        ),
        safeQuery<Row>(
          supabase
            .from("camera_streams" as any)
            .select("id,garden_id,name,status,health_status,gateway_registration_status,observer_shadow_mode")
            .in("garden_id", gardenIds)
            .order("updated_at", { ascending: false })
            .limit(100)
        )
      ])
    : [[], [], [], []];

  const pendingReview = signals.filter((signal) => ["detected", "pending_review", "reviewing", "needs_followup"].includes(String(signal.review_status)));
  const falsePositive = reviews.filter((review) => review.outcome === "false_positive").length;
  const falseNegative = reviews.filter((review) => review.outcome === "false_negative" || review.outcome === "missed_detection").length;
  const stableCameras = cameras.filter((camera) => ["registered", "connected", "healthy"].includes(String(camera.gateway_registration_status ?? camera.status ?? camera.health_status))).length;
  const readiness = calculateObserverPilotReadiness({
    detections: signals.length,
    pendingReview: pendingReview.length,
    reviewed: reviews.length,
    falsePositive,
    falseNegative,
    uncertain: reviews.filter((review) => ["uncertain", "needs_more_context"].includes(String(review.outcome))).length,
    cameras: cameras.length,
    stableCameras
  });
  const precisionReadiness = Math.max(0, 100 - readiness.falsePositiveRate);

  return (
    <DashboardShell role="inspector" title="פיילוט תצפיתן">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Observer Pilot"
          title="תצפיתן AI לפיקוח"
          subtitle="סימני תנועה חוזרים מופיעים כאן כדי לעזור לתעדף בדיקה. כל פעולה פורמלית דורשת אישור אנושי ותהליך פיקוח רגיל."
          badge={`${readiness.readiness}/100`}
          badgeTone={scoreTone(readiness.readiness)}
          actions={<><Link className="button primary" href="/dashboard/inspector/inspections">ביקורות</Link><Link className="button secondary" href="/dashboard/inspector/cameras">מצלמות</Link></>}
        />

        <div className="premium-metric-grid">
          <RoleMetricCard label="גנים משויכים" value={assignedGardens.length} hint="בתחום הפיקוח שלך" tone={assignedGardens.length ? "good" : "warn"} />
          <RoleMetricCard label="סימנים לבדיקה" value={pendingReview.length} hint="ממתינים לאדם" tone={pendingReview.length ? "warn" : "good"} />
          <RoleMetricCard label="דיוק בבדיקה" value={`${precisionReadiness}%`} hint="לאחר ground truth" tone={scoreTone(precisionReadiness)} />
          <RoleMetricCard label="כיול" value={`${readiness.calibration}/100`} hint="בשלות לפי מצלמות וסקירות" tone={scoreTone(readiness.calibration)} />
        </div>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="סימנים שממתינים לעיון" subtitle="ללא האשמה וללא הסקת מסקנות אוטומטית.">
            {pendingReview.length ? (
              <div className="communication-log-list">
                {pendingReview.slice(0, 12).map((signal) => (
                  <article className="communication-log-row" key={signal.id}>
                    <div>
                      <strong>{eventLabel(signal.event_type)}</strong>
                      <span>{signal.camera_streams?.name ?? "מצלמה"} · {signal.camera_zones?.name ?? "אזור"} · {new Date(signal.event_timestamp).toLocaleString("he-IL")}</span>
                    </div>
                    <StatusBadge tone={statusTone(signal.review_status)}>{signal.review_status}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="אין סימנים שממתינים לעיון" text="כאשר תצטבר אינדיקציה רלוונטית בגנים המשויכים, היא תופיע כאן." />}
          </CleanSection>

          <CleanSection title="כיול לפי אזורים" subtitle="אזור לא יציב דורש עוד בדיקות לפני שימוש תפעולי.">
            {calibration.length ? (
              <div className="communication-log-list">
                {calibration.slice(0, 12).map((profile) => (
                  <article className="communication-log-row" key={profile.id}>
                    <div>
                      <strong>{eventLabel(profile.event_type)}</strong>
                      <span>{Number(profile.reviewed_events_count ?? 0)} סקירות · {Number(profile.false_positive_count ?? 0)} FP · {Number(profile.false_negative_count ?? 0)} FN</span>
                    </div>
                    <StatusBadge tone={statusTone(profile.calibration_status)}>{profile.calibration_status}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : <EmptyState title="אין עדיין פרופילי כיול" text="נדרש איסוף אירועים וסקירה אנושית כדי לבנות כיול." />}
          </CleanSection>
        </section>

        <CleanSection title="המלצות פיקוח" subtitle="המלצות בלבד, לא החלטות אוטומטיות.">
          <div className="communication-template-grid">
            <article className="communication-template-card">
              <div><strong>בדוק מצלמות עם FP גבוה</strong><span>זווית מצלמה, תאורה וצפיפות עלולים לייצר סימנים מיותרים.</span></div>
              <StatusBadge tone={falsePositive ? "warn" : "good"}>{falsePositive}</StatusBadge>
            </article>
            <article className="communication-template-card">
              <div><strong>בדוק אירועים שהוחמצו</strong><span>דיווח false negative עוזר לכייל ספים לפני כל הפעלה רחבה.</span></div>
              <StatusBadge tone={falseNegative ? "bad" : "good"}>{falseNegative}</StatusBadge>
            </article>
            <article className="communication-template-card">
              <div><strong>Shadow mode בלבד</strong><span>אין הודעות להורים ואין פתיחת אירוע פורמלי בלי אישור.</span></div>
              <StatusBadge tone="good">נאכף</StatusBadge>
            </article>
            <article className="communication-template-card">
              <div><strong>מצב ישראל</strong><span>שמע, זיהוי פנים וזיהוי ביומטרי אינם חלק מהפיילוט.</span></div>
              <StatusBadge tone="good">מוגבל</StatusBadge>
            </article>
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
