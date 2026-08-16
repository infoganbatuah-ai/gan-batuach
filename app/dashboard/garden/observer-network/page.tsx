import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, Eye, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
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
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildObserverReadinessScore, observerNetworkTone } from "@/lib/domain/observer-network";

export default async function GardenObserverNetworkPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden observer network", async () => {
    const supabase = await createClient();
    const [signalsRes, recommendationsRes, camerasRes, complianceRes] = await Promise.all([
      supabase.from("observer_intelligence_signals" as any).select("*").eq("kindergarten_id", gardenId).in("review_status", ["needs_review", "reviewing", "escalated"]).order("risk_score", { ascending: false }).limit(80),
      supabase.from("observer_safety_recommendations" as any).select("*").eq("kindergarten_id", gardenId).eq("status", "open").order("created_at", { ascending: false }).limit(60),
      supabase.from("camera_streams" as any).select("id,status,stream_status,health_status,active").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).limit(250),
      supabase.from("compliance_alerts" as any).select("id,severity,alert_status").eq("garden_id", gardenId).in("alert_status", ["open", "in_progress"]).limit(80)
    ]);
    [signalsRes, recommendationsRes, camerasRes, complianceRes].forEach((res, index) => logSupabaseError(`garden observer network ${index}`, (res as any).error));
    const signals = (signalsRes.data ?? []) as any[];
    const recommendations = (recommendationsRes.data ?? []) as any[];
    const cameras = (camerasRes.data ?? []) as any[];
    const unhealthy = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway", "unhealthy", "degraded"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status))).length;
    const reviewedSignals = signals.filter((signal) => ["confirmed", "dismissed", "resolved"].includes(String(signal.review_status))).length;
    const readiness = buildObserverReadinessScore({ totalCameras: cameras.length, activeCameras: cameras.filter((camera) => camera.active !== false).length, unhealthyCameras: unhealthy, totalSignals: signals.length, reviewedSignals, falsePositiveSignals: signals.filter((signal) => signal.review_status === "dismissed").length, unresolvedSignals: signals.length, complianceSignals: (complianceRes.data ?? []).length });
    return { signals, recommendations, cameras, unhealthy, compliance: complianceRes.data ?? [], readiness, queryError: [signalsRes.error, recommendationsRes.error].some(Boolean) ? "חלק מנתוני תקציר הבטיחות לא נטענו" : null };
  }, { signals: [] as any[], recommendations: [] as any[], cameras: [] as any[], unhealthy: 0, compliance: [] as any[], readiness: buildObserverReadinessScore({ totalCameras: 0, activeCameras: 0, unhealthyCameras: 0, totalSignals: 0, reviewedSignals: 0, falsePositiveSignals: 0, unresolvedSignals: 0, complianceSignals: 0 }), queryError: null as string | null });
  const data = result.data;
  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="תקציר בטיחות" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`}
        subtitle="תקציר בטיחות"
        avatarUrl={(profile as any).profile_image_url ?? null}
        active="more"
      >
        <TeacherPageTitle
          icon={ShieldCheck}
          title="מה דורש תשומת לב היום"
          subtitle="מצלמות, ציות, אירועים פתוחים והמלצות בדיקה. שום דבר לא נשלח להורים בלי אישור."
          action={<Link className="teacher-soft-button purple" href="/dashboard/garden/observer-intelligence">סיכומי תצפיתן</Link>}
        />
        <AdminDataError message={result.error ?? data.queryError} />
        <TeacherStatsGrid>
          <TeacherStatCard title="דורש בדיקה" value={data.signals.length} icon={AlertTriangle} tone={data.signals.length ? "orange" : "green"} />
          <TeacherStatCard title="מצלמות" value={`${data.cameras.length - data.unhealthy}/${data.cameras.length}`} hint={`${data.unhealthy} דורשות טיפול`} icon={Camera} tone={data.unhealthy ? "orange" : "green"} />
          <TeacherStatCard title="ציות" value={data.compliance.length} hint="פערים פתוחים" icon={ClipboardCheck} tone={data.compliance.length ? "orange" : "green"} />
          <TeacherStatCard title="המלצות" value={data.recommendations.length} icon={ShieldCheck} tone={data.recommendations.length ? "orange" : "green"} />
        </TeacherStatsGrid>
        <TeacherSection title="נושאים לטיפול" subtitle="אינדיקציות בלבד. בודקים לפני שפועלים.">
          {data.signals.length === 0 ? <TeacherEmptyState title="אין נושאים פתוחים" text="כשהמערכת תזהה משהו לבדיקה, הוא יופיע כאן." /> : (
            <TeacherCompactList>
              {data.signals.slice(0, 8).map((signal: any) => (
                <TeacherCompactItem
                  key={signal.id}
                  title={signal.signal_type === "camera_health" ? "מצלמה דורשת בדיקה" : signal.signal_type === "compliance" ? "פער ציות" : "אירוע לבדיקה"}
                  subtitle={signal.recommended_action ?? "בדיקה מומלצת"}
                  meta={`${signal.risk_score ?? 0}/100`}
                  tone={observerNetworkTone(100 - Number(signal.risk_score ?? 0)) === "good" ? "green" : "orange"}
                  href="/dashboard/garden/observer-intelligence"
                />
              ))}
            </TeacherCompactList>
          )}
        </TeacherSection>
        <TeacherSection title="המלצות">
          {data.recommendations.length === 0 ? <TeacherEmptyState title="אין המלצות פתוחות" /> : (
            <TeacherCompactList>
              {data.recommendations.slice(0, 6).map((rec: any) => (
                <TeacherCompactItem key={rec.id} title={rec.recommendation_text} subtitle={rec.recommendation_type} meta={rec.status} tone="purple" />
              ))}
            </TeacherCompactList>
          )}
        </TeacherSection>
        <TeacherQuickActions title="פעולות בטיחות">
          <TeacherActionTile title="מצלמות" href="/dashboard/garden/camera-health" icon={Camera} tone="blue" />
          <TeacherActionTile title="תצפיתן" href="/dashboard/garden/observer-intelligence" icon={Eye} tone="purple" />
          <TeacherActionTile title="ציות" href="/dashboard/garden/compliance" icon={ClipboardCheck} tone="green" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
