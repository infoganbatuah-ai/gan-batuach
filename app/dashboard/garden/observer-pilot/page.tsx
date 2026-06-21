import Link from "next/link";
import { Activity, Camera, ClipboardCheck, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
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
    <DashboardShell role="manager" title="פיילוט תצפיתן" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`}
        subtitle="פיילוט תצפיתן"
        avatarUrl={(profile as any).avatar_url ?? null}
        active="more"
      >
        <TeacherPageTitle
          icon={Activity}
          title="תצפיתן AI במצב בדיקה"
          subtitle="סימנים לבדיקה בלבד. אין הודעות להורים ואין פעולה ללא החלטת אדם."
          action={<Link className="teacher-soft-button purple" href="/dashboard/garden/cameras">מצלמות</Link>}
        />

        <TeacherStatsGrid>
          <TeacherStatCard title="אירועים לבדיקה" value={pendingReview.length} hint="בדיקה אנושית" icon={Activity} tone={pendingReview.length ? "orange" : "green"} />
          <TeacherStatCard title="מצלמות מכוסות" value={`${stableCameras}/${cameras.length}`} hint="בריאות Gateway" icon={Camera} tone={stableCameras === cameras.length && cameras.length ? "green" : "orange"} />
          <TeacherStatCard title="כיול" value={`${readiness.calibration}/100`} hint="מבוסס review" icon={ClipboardCheck} tone={readiness.calibration >= 80 ? "green" : "orange"} />
          <TeacherStatCard title="בדיקות שבוצעו" value={reviews.length} hint="Ground truth" icon={ShieldCheck} tone={reviews.length ? "green" : "orange"} />
        </TeacherStatsGrid>

        <TeacherSection title="מה דורש בדיקה" subtitle="שפה זהירה: סימן תנועה, לא מסקנה.">
          {pendingReview.length ? (
            <TeacherCompactList>
              {pendingReview.slice(0, 12).map((event) => (
                <TeacherCompactItem
                  key={event.id}
                  title={label(event.event_type)}
                  subtitle={`${event.camera_streams?.name ?? "מצלמה"} · ${event.camera_zones?.name ?? "אזור"} · ${new Date(event.event_timestamp).toLocaleString("he-IL")}`}
                  meta={event.review_status}
                  tone={statusTone(event.review_status) === "good" ? "green" : "orange"}
                />
              ))}
            </TeacherCompactList>
          ) : <TeacherEmptyState title="אין אירועים שממתינים לבדיקה" text="כאשר התצפיתן יזהה סימן תנועה, הוא יופיע כאן לבדיקה." />}
        </TeacherSection>

        <TeacherSection title="כיסוי מצלמות" subtitle="מצלמות יציבות משפרות את איכות הפיילוט.">
          <TeacherCompactList>
            {cameras.map((camera) => (
              <TeacherCompactItem
                key={camera.id}
                title={camera.name}
                subtitle={`${camera.area ?? "אזור"} · Shadow mode ${camera.observer_shadow_mode ? "פעיל" : "כבוי"}`}
                meta={camera.gateway_registration_status ?? camera.health_status ?? camera.status}
                tone={statusTone(camera.gateway_registration_status ?? camera.health_status ?? camera.status) === "good" ? "green" : "orange"}
              />
            ))}
          </TeacherCompactList>
        </TeacherSection>

        <TeacherSection title="כללי בטיחות" subtitle="הפיילוט לא מפעיל שום פעולה לבד.">
          <TeacherCompactList>
            <TeacherCompactItem title="בדיקת אדם חובה" subtitle="כל סימן צריך אישור מנהלת/אדמין/מפקח." tone="green" />
            <TeacherCompactItem title="הורים לא רואים raw AI" subtitle="רק סיכום מאושר יכול להפוך להודעה." tone="green" />
            <TeacherCompactItem title="אין שמע או זיהוי פנים" subtitle="מצב ישראל לגני ילדים." tone="green" />
          </TeacherCompactList>
        </TeacherSection>

        <TeacherQuickActions title="פעולות פיילוט">
          <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Camera} tone="blue" />
          <TeacherActionTile title="משימות" href="/dashboard/garden/tasks" icon={ClipboardCheck} tone="purple" />
          <TeacherActionTile title="סיכומי תצפיתן" href="/dashboard/garden/observer-intelligence" icon={Activity} tone="orange" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
