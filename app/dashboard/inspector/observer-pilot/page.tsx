import Link from "next/link";
import { Camera, Eye, Radar, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { calculateObserverPilotReadiness, scoreTone, statusTone } from "@/lib/domain/observer-pilot";
import {
  InspectorActionCard,
  InspectorActions,
  InspectorAppFrame,
  InspectorEmpty,
  InspectorHero,
  InspectorList,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorRow,
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

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

function toTone(value?: string | number | null) {
  const tone = typeof value === "number" ? scoreTone(value) : statusTone(value);
  return tone === "bad" ? "danger" : tone === "warn" ? "warning" : tone === "good" ? "success" : "primary";
}

export default async function InspectorObserverPilotPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, assignedGardens] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    safeQuery<Row>(
      supabase
        .from("gardens" as any)
        .select("id,name,city,inspector_id")
        .eq("inspector_id", profile.id)
        .order("name", { ascending: true })
        .limit(80)
    )
  ]);

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
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="פיילוט תצפיתן" subtitle="סימני תנועה לבדיקה אנושית" badge="AI" backHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="Observer Pilot"
        title="תצפיתן AI לפיקוח"
        subtitle="סימני תנועה חוזרים עוזרים לתעדף בדיקה. כל פעולה פורמלית דורשת אישור אנושי ותהליך פיקוח רגיל."
        artwork={<Radar />}
        action={<><Link className="inspector-action-button" href="/dashboard/inspector/inspections">ביקורות</Link><Link className="inspector-action-button secondary" href="/dashboard/inspector/cameras">מצלמות</Link></>}
        meta={<><span>Shadow mode בלבד</span><span>ללא מסקנות אוטומטיות</span></>}
      />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="גנים משויכים" value={assignedGardens.length} hint="בתחום הפיקוח שלך" icon={ShieldCheck} tone={assignedGardens.length ? "success" : "warning"} />
        <InspectorMetricCard label="סימנים לבדיקה" value={pendingReview.length} hint="ממתינים לאדם" icon={Eye} tone={pendingReview.length ? "warning" : "success"} />
        <InspectorMetricCard label="דיוק בבדיקה" value={`${precisionReadiness}%`} hint="לאחר ground truth" icon={Radar} tone={toTone(precisionReadiness)} />
        <InspectorMetricCard label="כיול" value={`${readiness.calibration}/100`} hint="בשלות לפי מצלמות" icon={SlidersHorizontal} tone={toTone(readiness.calibration)} />
      </InspectorMetricGrid>

      <InspectorSection title="סימנים שממתינים לעיון" subtitle="ללא האשמה וללא הסקת מסקנות אוטומטית" icon={Eye}>
        <InspectorList>
          {pendingReview.slice(0, 12).map((signal) => (
            <InspectorRow
              key={signal.id}
              title={eventLabel(signal.event_type)}
              subtitle={`${signal.camera_streams?.name ?? "מצלמה"} · ${signal.camera_zones?.name ?? "אזור"}`}
              meta={signal.event_timestamp ? new Date(signal.event_timestamp).toLocaleString("he-IL") : ""}
              status={<InspectorStatus tone={toTone(signal.review_status)}>{signal.review_status}</InspectorStatus>}
            />
          ))}
          {pendingReview.length === 0 ? <InspectorEmpty title="אין סימנים שממתינים לעיון" text="כאשר תצטבר אינדיקציה רלוונטית בגנים המשויכים, היא תופיע כאן." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="כיול לפי אזורים" subtitle="אזור לא יציב דורש עוד בדיקות לפני שימוש תפעולי" icon={SlidersHorizontal}>
        <InspectorList>
          {calibration.slice(0, 12).map((item) => (
            <InspectorRow
              key={item.id}
              title={eventLabel(item.event_type)}
              subtitle={`${Number(item.reviewed_events_count ?? 0)} סקירות · ${Number(item.false_positive_count ?? 0)} FP · ${Number(item.false_negative_count ?? 0)} FN`}
              meta={`סף ביטחון ${item.confidence_threshold ?? "-"}`}
              status={<InspectorStatus tone={toTone(item.calibration_status)}>{item.calibration_status}</InspectorStatus>}
            />
          ))}
          {calibration.length === 0 ? <InspectorEmpty title="אין עדיין פרופילי כיול" text="נדרש איסוף אירועים וסקירה אנושית כדי לבנות כיול." icon={SlidersHorizontal} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="גבולות הפיילוט" subtitle="המלצות בלבד, לא החלטות אוטומטיות" icon={ShieldCheck}>
        <InspectorList>
          <InspectorRow title="בדוק מצלמות עם FP גבוה" subtitle="זווית מצלמה, תאורה וצפיפות עלולים לייצר סימנים מיותרים." status={<InspectorStatus tone={falsePositive ? "warning" : "success"}>{falsePositive}</InspectorStatus>} />
          <InspectorRow title="בדוק אירועים שהוחמצו" subtitle="דיווח false negative עוזר לכייל ספים לפני הפעלה רחבה." status={<InspectorStatus tone={falseNegative ? "danger" : "success"}>{falseNegative}</InspectorStatus>} />
          <InspectorRow title="Shadow mode בלבד" subtitle="אין הודעות להורים ואין פתיחת אירוע פורמלי בלי אישור." status={<InspectorStatus tone="success">נאכף</InspectorStatus>} />
          <InspectorRow title="מצב ישראל" subtitle="שמע, זיהוי פנים וזיהוי ביומטרי אינם חלק מהפיילוט." status={<InspectorStatus tone="success">מוגבל</InspectorStatus>} />
        </InspectorList>
      </InspectorSection>

      <InspectorActions>
        <InspectorActionCard title="מצלמות" text="סטטוס ויציבות" href="/dashboard/inspector/cameras" icon={Camera} />
        <InspectorActionCard title="תור בדיקה" text="אירועי תצפיתן" href="/dashboard/inspector/ai-events" icon={Eye} />
        <InspectorActionCard title="ביקורות" text="פיקוח אנושי" href="/dashboard/inspector/inspections" icon={ShieldCheck} />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
