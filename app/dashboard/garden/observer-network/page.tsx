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

type ObserverRow = Record<string, unknown>;

export default async function GardenObserverNetworkPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const unavailableData = {
    signals: [] as ObserverRow[], recommendations: [] as ObserverRow[], cameras: [] as ObserverRow[],
    unhealthy: 0, compliance: [] as ObserverRow[], readiness: null as ReturnType<typeof buildObserverReadinessScore> | null,
    available: [false, false, false, false], queryError: "לא ניתן לטעון את נתוני תקציר הבטיחות כרגע" as string | null
  };
  const result = await safeAdminData("garden observer network", async () => {
    if (!gardenId) return unavailableData;
    const supabase = await createClient();
    const query = async <T,>(label: string, run: () => PromiseLike<{ data: T | null; error: unknown }>) => {
      try {
        const response = await run();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, available: !response.error };
      } catch (error) {
        logSupabaseError(label, error);
        return { data: null, available: false };
      }
    };
    const [signalsRes, recommendationsRes, camerasRes, complianceRes] = await Promise.all([
      query("garden observer network signals", () => supabase.from("observer_intelligence_signals" as any).select("*").eq("kindergarten_id", gardenId).in("review_status", ["needs_review", "reviewing", "escalated"]).order("risk_score", { ascending: false }).limit(80)),
      query("garden observer network recommendations", () => supabase.from("observer_safety_recommendations" as any).select("*").eq("kindergarten_id", gardenId).eq("status", "open").order("created_at", { ascending: false }).limit(60)),
      query("garden observer network cameras", () => supabase.from("camera_streams" as any).select("id,status,stream_status,health_status,active").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).limit(250)),
      query("garden observer network compliance", () => supabase.from("compliance_alerts" as any).select("id,severity,alert_status").eq("garden_id", gardenId).in("alert_status", ["open", "in_progress"]).limit(80))
    ]);
    const signals = (signalsRes.data ?? []) as ObserverRow[];
    const recommendations = (recommendationsRes.data ?? []) as ObserverRow[];
    const cameras = (camerasRes.data ?? []) as ObserverRow[];
    const compliance = (complianceRes.data ?? []) as ObserverRow[];
    const available = [signalsRes.available, recommendationsRes.available, camerasRes.available, complianceRes.available];
    const unhealthy = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway", "unhealthy", "degraded"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status))).length;
    const reviewedSignals = signals.filter((signal) => ["confirmed", "dismissed", "resolved"].includes(String(signal.review_status))).length;
    const readiness = available[0] && available[2] && available[3] ? buildObserverReadinessScore({ totalCameras: cameras.length, activeCameras: cameras.filter((camera) => camera.active !== false).length, unhealthyCameras: unhealthy, totalSignals: signals.length, reviewedSignals, falsePositiveSignals: signals.filter((signal) => signal.review_status === "dismissed").length, unresolvedSignals: signals.length, complianceSignals: compliance.length }) : null;
    return { signals, recommendations, cameras, unhealthy, compliance, readiness, available, queryError: available.some((value) => !value) ? "חלק מנתוני תקציר הבטיחות לא נטענו" : null };
  }, unavailableData);
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
          <TeacherStatCard title="דורש בדיקה" value={data.available[0] ? data.signals.length : "לא זמין"} icon={AlertTriangle} tone={!data.available[0] ? "neutral" : data.signals.length ? "orange" : "green"} />
          <TeacherStatCard title="מצלמות" value={data.available[2] ? `${data.cameras.length - data.unhealthy}/${data.cameras.length}` : "לא זמין"} hint={data.available[2] ? `${data.unhealthy} דורשות טיפול` : "לא זמין"} icon={Camera} tone={!data.available[2] ? "neutral" : data.unhealthy ? "orange" : "green"} />
          <TeacherStatCard title="ציות" value={data.available[3] ? data.compliance.length : "לא זמין"} hint="פערים פתוחים" icon={ClipboardCheck} tone={!data.available[3] ? "neutral" : data.compliance.length ? "orange" : "green"} />
          <TeacherStatCard title="המלצות" value={data.available[1] ? data.recommendations.length : "לא זמין"} icon={ShieldCheck} tone={!data.available[1] ? "neutral" : data.recommendations.length ? "orange" : "green"} />
        </TeacherStatsGrid>
        <TeacherSection title="נושאים לטיפול" subtitle="אינדיקציות בלבד. בודקים לפני שפועלים.">
          {!data.available[0] ? <TeacherEmptyState title="נתוני הנושאים אינם זמינים כרגע" text="לא ניתן לטעון את הנתונים לבדיקה." /> : data.signals.length === 0 ? <TeacherEmptyState title="אין נושאים פתוחים" text="כשהמערכת תזהה משהו לבדיקה, הוא יופיע כאן." /> : (
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
          {!data.available[1] ? <TeacherEmptyState title="נתוני ההמלצות אינם זמינים כרגע" /> : data.recommendations.length === 0 ? <TeacherEmptyState title="אין המלצות פתוחות" /> : (
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
