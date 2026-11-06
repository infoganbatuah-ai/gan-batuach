import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { cleanRiskReasons, predictiveRiskSafeguards, riskCategoryRows, riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";
import { preventionTone, warningTypeLabel } from "@/lib/domain/predictive-safety-prevention";
import {
  TeacherActionTile,
  TeacherAiInsight,
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

function teacherTone(tone: string): "red" | "orange" | "green" | "purple" {
  if (tone === "bad") return "red";
  if (tone === "warn") return "orange";
  if (tone === "good") return "green";
  return "purple";
}

type RiskCompactItemProps = Parameters<typeof TeacherCompactItem>[0];

type RiskProfile = {
  overall_risk_score?: number | string | null;
  safety_risk?: number | string | null;
  compliance_risk?: number | string | null;
  operational_risk?: number | string | null;
  staffing_risk?: number | string | null;
  observer_risk?: number | string | null;
  risk_level?: string | null;
  risk_trend?: string | null;
  predicted_risk_level?: string | null;
  explanation?: { why_increased?: unknown; how_to_improve?: unknown } | null;
};
type RiskSignal = { id: string; title: string; explanation?: string | null; severity: number | string; pattern_count?: number | string | null };
type RiskRecommendation = { id: string; title: string; explanation?: string | null; priority: number | string };
type EarlyWarning = { id: string; warning_type?: string | null; recommended_action?: string | null; severity: number | string; confidence_score?: number | string | null };
type PreventionAction = { id: string; title: string; description?: string | null; priority: number | string };
type PreventionReadiness = { prevention_readiness_score?: number | string | null };

async function riskQuery(label: string, run: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const response = await run();
    logSupabaseError(label, response.error);
    return { data: response.error ? null : response.data, available: !response.error };
  } catch (error) {
    logSupabaseError(label, error);
    return { data: null, available: false };
  }
}

export default async function GardenRiskPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const unavailable = { profile: null as RiskProfile | null, signals: [] as RiskSignal[], recommendations: [] as RiskRecommendation[], history: [] as unknown[], warnings: [] as EarlyWarning[], actions: [] as PreventionAction[], readiness: null as PreventionReadiness | null, available: [false, false, false, false, false, false, false], queryError: "נתוני הסיכון אינם זמינים" as string | null };
  const result = await safeAdminData("garden risk", async () => {
    if (!gardenId) return { ...unavailable, queryError: "נדרש הקשר גן תקף כדי לטעון את נתוני הסיכון" };
    const supabase = await createClient();
    const [profileRes, signalsRes, recsRes, historyRes, warningsRes, actionsRes, readinessRes] = await Promise.all([
      riskQuery("garden risk profile", () => supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle()),
      riskQuery("garden risk signals", () => supabase.from("predictive_risk_signals" as any).select("*").eq("garden_id", gardenId).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(40)),
      riskQuery("garden risk recommendations", () => supabase.from("risk_prevention_recommendations" as any).select("*").eq("garden_id", gardenId).eq("status", "open").order("created_at", { ascending: false }).limit(30)),
      riskQuery("garden risk history", () => supabase.from("kindergarten_risk_history" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(30)),
      riskQuery("garden risk warnings", () => supabase.from("early_warning_signals" as any).select("*").eq("garden_id", gardenId).in("review_status", ["needs_review", "reviewing", "confirmed", "escalated"]).order("created_at", { ascending: false }).limit(30)),
      riskQuery("garden risk actions", () => supabase.from("prevention_recommendation_actions" as any).select("*").eq("garden_id", gardenId).in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(30)),
      riskQuery("garden risk readiness", () => supabase.from("prevention_readiness_scores" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle())
    ]);
    const available = [profileRes, signalsRes, recsRes, historyRes, warningsRes, actionsRes, readinessRes].map((query) => query.available);
    return { profile: profileRes.data as RiskProfile | null, signals: (signalsRes.data ?? []) as RiskSignal[], recommendations: (recsRes.data ?? []) as RiskRecommendation[], history: (historyRes.data ?? []) as unknown[], warnings: (warningsRes.data ?? []) as EarlyWarning[], actions: (actionsRes.data ?? []) as PreventionAction[], readiness: readinessRes.data as PreventionReadiness | null, available, queryError: !profileRes.available ? "נתוני הסיכון עדיין לא נטענו" : available.every(Boolean) ? null : "חלק מנתוני הסיכון לא נטענו" };
  }, unavailable);

  const data = result.data;
  const [profileAvailable, signalsAvailable, recommendationsAvailable, , warningsAvailable, actionsAvailable, readinessAvailable] = data.available;
  const risk: RiskProfile | null = profileAvailable ? data.profile ?? { overall_risk_score: 0, safety_risk: 0, compliance_risk: 0, operational_risk: 0, staffing_risk: 0, observer_risk: 0, risk_level: "low", risk_trend: "new", predicted_risk_level: "low", explanation: {} } : null;
  const reasons = risk ? cleanRiskReasons(risk.explanation?.why_increased) : [];
  const improvements = risk ? cleanRiskReasons(risk.explanation?.how_to_improve) : [];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="סיכון ומניעה" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="מרכז מניעה ובטיחות" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={AlertTriangle} title="מרכז מניעה של הגן" subtitle="דפוסים מוקדמים לבדיקה אנושית לפני פעולה" action={<Link className="button primary" href="/dashboard/garden/tasks">משימות</Link>} />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="סיכון כללי" value={risk ? `${risk.overall_risk_score}/100` : "לא זמין"} hint={risk ? riskLevelLabel(risk.risk_level) : "לא זמין"} icon={AlertTriangle} tone={risk ? teacherTone(riskTone(Number(risk.overall_risk_score ?? 0))) : "neutral"} />
          <TeacherStatCard title="מוכנות מניעה" value={readinessAvailable ? `${data.readiness?.prevention_readiness_score ?? 0}/100` : "לא זמין"} hint="readiness" icon={ShieldCheck} tone={readinessAvailable ? teacherTone(preventionTone(Number(data.readiness?.prevention_readiness_score ?? 0))) : "neutral"} />
          <TeacherStatCard title="אזהרות" value={warningsAvailable ? data.warnings.length : "לא זמין"} hint={risk ? riskTrendLabel(risk.risk_trend) : "לא זמין"} icon={ClipboardCheck} tone={warningsAvailable ? data.warnings.length ? "orange" : "green" : "neutral"} />
          <TeacherStatCard title="צוות" value={risk ? `${risk.staffing_risk}/100` : "לא זמין"} hint="שיבוץ ואישורים" icon={UsersRound} tone={risk ? teacherTone(riskTone(Number(risk.staffing_risk ?? 0))) : "neutral"} />
        </TeacherStatsGrid>

        <TeacherSection title="קטגוריות סיכון">
          {risk ? <TeacherCompactList>
            {riskCategoryRows(risk).map((row) => <TeacherCompactItem key={row.key} title={row.label} subtitle={row.description} tone={teacherTone(riskTone(Number(row.value ?? 0)))} meta={`${row.value}/100`} />)}
          </TeacherCompactList> : <TeacherEmptyState title="נתוני קטגוריות הסיכון אינם זמינים" />}
        </TeacherSection>

        <section className="teacher-children-layout">
          <TeacherSection title="מה מעלה סיכון">
            {!risk ? <TeacherEmptyState title="גורמי הסיכון אינם זמינים" /> : reasons.length === 0 ? <TeacherEmptyState title="אין דפוס חריג כרגע" /> : <TeacherCompactList>{reasons.map((reason) => <TeacherCompactItem key={reason} title={reason} subtitle="דורש בדיקה רגועה" tone="orange" meta="פתוח" />)}</TeacherCompactList>}
          </TeacherSection>
          <TeacherSection title="איך מורידים סיכון">
            {!risk ? <TeacherEmptyState title="המלצות לשיפור הסיכון אינן זמינות" /> : improvements.length === 0 ? <TeacherEmptyState title="אין המלצות זמינות" /> : <TeacherCompactList>{improvements.map((item) => <TeacherCompactItem key={item} title={item} subtitle="פעולה מונעת" tone="green" meta="מומלץ" />)}</TeacherCompactList>}
          </TeacherSection>
        </section>

        <TeacherSection title="אזהרות מוקדמות">
          {(!signalsAvailable || !warningsAvailable) && <TeacherEmptyState title="חלק מנתוני האזהרות אינם זמינים" text="מוצגים רק סימנים ואזהרות שמקורם נטען בהצלחה." />}
          {signalsAvailable && warningsAvailable && data.warnings.length === 0 && data.signals.length === 0 ? <TeacherEmptyState title="אין אזהרות פתוחות" text="אם יתגלה דפוס לבדיקה הוא יופיע כאן." /> : (
            <TeacherCompactList>
              {data.warnings.map((warning) => <TeacherCompactItem key={warning.id} title={warningTypeLabel(warning.warning_type)} subtitle={warning.recommended_action as RiskCompactItemProps["subtitle"]} tone={teacherTone(preventionTone(warning.severity))} meta={`${warning.confidence_score}%`} />)}
              {data.signals.map((signal) => <TeacherCompactItem key={signal.id} title={signal.title} subtitle={signal.explanation as RiskCompactItemProps["subtitle"]} tone={teacherTone(riskTone(signal.severity))} meta={signal.pattern_count} />)}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherSection title="המלצות מניעה">
          {(!recommendationsAvailable || !actionsAvailable) && <TeacherEmptyState title="חלק מנתוני המלצות המניעה אינם זמינים" text="מוצגות רק המלצות ופעולות שמקורן נטען בהצלחה." />}
          {recommendationsAvailable && actionsAvailable && data.recommendations.length === 0 && data.actions.length === 0 ? <TeacherEmptyState title="אין המלצות פתוחות" /> : (
            <TeacherCompactList>
              {data.actions.map((rec) => <TeacherCompactItem key={rec.id} title={rec.title} subtitle={rec.description as RiskCompactItemProps["subtitle"]} tone={teacherTone(preventionTone(rec.priority))} meta={rec.priority} />)}
              {data.recommendations.map((rec) => <TeacherCompactItem key={rec.id} title={rec.title} subtitle={rec.explanation as RiskCompactItemProps["subtitle"]} tone={teacherTone(riskTone(rec.priority))} meta={rec.priority} />)}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherAiInsight metric={risk ? riskLevelLabel(risk.risk_level) : "לא זמין"}>
          {predictiveRiskSafeguards.join(" · ")}. המידע אינו מוצג להורים ואינו מחליף בדיקה אנושית.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות מניעה">
          <TeacherActionTile title="צוות" href="/dashboard/garden/staff" icon={UsersRound} tone="blue" />
          <TeacherActionTile title="ציות" href="/dashboard/garden/compliance" icon={ShieldCheck} tone="purple" />
          <TeacherActionTile title="פיקוח" href="/dashboard/garden/inspections" icon={ClipboardCheck} tone="green" />
          <TeacherActionTile title="מצלמות" href="/dashboard/garden/camera-health" icon={Camera} tone="orange" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
