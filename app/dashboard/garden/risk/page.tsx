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

function teacherTone(tone: string) {
  if (tone === "bad") return "red";
  if (tone === "warn") return "orange";
  if (tone === "good") return "green";
  return "purple";
}

export default async function GardenRiskPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden risk", async () => {
    const supabase = await createClient();
    const [profileRes, signalsRes, recsRes, historyRes, warningsRes, actionsRes, readinessRes] = await Promise.all([
      supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle(),
      supabase.from("predictive_risk_signals" as any).select("*").eq("garden_id", gardenId).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(40),
      supabase.from("risk_prevention_recommendations" as any).select("*").eq("garden_id", gardenId).eq("status", "open").order("created_at", { ascending: false }).limit(30),
      supabase.from("kindergarten_risk_history" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(30),
      supabase.from("early_warning_signals" as any).select("*").eq("garden_id", gardenId).in("review_status", ["needs_review", "reviewing", "confirmed", "escalated"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("prevention_recommendation_actions" as any).select("*").eq("garden_id", gardenId).in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("prevention_readiness_scores" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(1).maybeSingle()
    ]);
    [profileRes, signalsRes, recsRes, historyRes, warningsRes, actionsRes, readinessRes].forEach((query, index) => logSupabaseError(`garden risk query ${index}`, (query as any).error));
    return { profile: profileRes.data as any, signals: (signalsRes.data ?? []) as any[], recommendations: (recsRes.data ?? []) as any[], history: (historyRes.data ?? []) as any[], warnings: (warningsRes.data ?? []) as any[], actions: (actionsRes.data ?? []) as any[], readiness: readinessRes.data as any, queryError: profileRes.error ? "נתוני הסיכון עדיין לא נטענו" : null };
  }, { profile: null as any, signals: [] as any[], recommendations: [] as any[], history: [] as any[], warnings: [] as any[], actions: [] as any[], readiness: null as any, queryError: null as string | null });

  const data = result.data;
  const risk = data.profile ?? { overall_risk_score: 0, safety_risk: 0, compliance_risk: 0, operational_risk: 0, staffing_risk: 0, observer_risk: 0, risk_level: "low", risk_trend: "new", predicted_risk_level: "low", explanation: {} };
  const reasons = cleanRiskReasons(risk.explanation?.why_increased);
  const improvements = cleanRiskReasons(risk.explanation?.how_to_improve);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="סיכון ומניעה" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="מרכז מניעה ובטיחות" avatarUrl={(profile as any).avatar_url ?? null} active="more">
        <TeacherPageTitle icon={AlertTriangle} title="מרכז מניעה של הגן" subtitle="דפוסים מוקדמים לבדיקה אנושית לפני פעולה" action={<Link className="button primary" href="/dashboard/garden/tasks">משימות</Link>} />
        <AdminDataError message={result.error ?? data.queryError} />

        <TeacherStatsGrid>
          <TeacherStatCard title="סיכון כללי" value={`${risk.overall_risk_score}/100`} hint={riskLevelLabel(risk.risk_level)} icon={AlertTriangle} tone={teacherTone(riskTone(Number(risk.overall_risk_score ?? 0))) as any} />
          <TeacherStatCard title="מוכנות מניעה" value={`${data.readiness?.prevention_readiness_score ?? 0}/100`} hint="readiness" icon={ShieldCheck} tone={teacherTone(preventionTone(Number(data.readiness?.prevention_readiness_score ?? 0))) as any} />
          <TeacherStatCard title="אזהרות" value={data.warnings.length} hint={riskTrendLabel(risk.risk_trend)} icon={ClipboardCheck} tone={data.warnings.length ? "orange" : "green"} />
          <TeacherStatCard title="צוות" value={`${risk.staffing_risk}/100`} hint="שיבוץ ואישורים" icon={UsersRound} tone={teacherTone(riskTone(Number(risk.staffing_risk ?? 0))) as any} />
        </TeacherStatsGrid>

        <TeacherSection title="קטגוריות סיכון">
          <TeacherCompactList>
            {riskCategoryRows(risk).map((row) => <TeacherCompactItem key={row.key} title={row.label} subtitle={row.description} tone={teacherTone(riskTone(Number(row.value ?? 0))) as any} meta={`${row.value}/100`} />)}
          </TeacherCompactList>
        </TeacherSection>

        <section className="teacher-children-layout">
          <TeacherSection title="מה מעלה סיכון">
            {reasons.length === 0 ? <TeacherEmptyState title="אין דפוס חריג כרגע" /> : <TeacherCompactList>{reasons.map((reason) => <TeacherCompactItem key={reason} title={reason} subtitle="דורש בדיקה רגועה" tone="orange" meta="פתוח" />)}</TeacherCompactList>}
          </TeacherSection>
          <TeacherSection title="איך מורידים סיכון">
            {improvements.length === 0 ? <TeacherEmptyState title="אין המלצות זמינות" /> : <TeacherCompactList>{improvements.map((item) => <TeacherCompactItem key={item} title={item} subtitle="פעולה מונעת" tone="green" meta="מומלץ" />)}</TeacherCompactList>}
          </TeacherSection>
        </section>

        <TeacherSection title="אזהרות מוקדמות">
          {data.warnings.length === 0 && data.signals.length === 0 ? <TeacherEmptyState title="אין אזהרות פתוחות" text="אם יתגלה דפוס לבדיקה הוא יופיע כאן." /> : (
            <TeacherCompactList>
              {data.warnings.map((warning: any) => <TeacherCompactItem key={warning.id} title={warningTypeLabel(warning.warning_type)} subtitle={warning.recommended_action} tone={teacherTone(preventionTone(warning.severity)) as any} meta={`${warning.confidence_score}%`} />)}
              {data.signals.map((signal: any) => <TeacherCompactItem key={signal.id} title={signal.title} subtitle={signal.explanation} tone={teacherTone(riskTone(signal.severity)) as any} meta={signal.pattern_count} />)}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherSection title="המלצות מניעה">
          {data.recommendations.length === 0 && data.actions.length === 0 ? <TeacherEmptyState title="אין המלצות פתוחות" /> : (
            <TeacherCompactList>
              {data.actions.map((rec: any) => <TeacherCompactItem key={rec.id} title={rec.title} subtitle={rec.description} tone={teacherTone(preventionTone(rec.priority)) as any} meta={rec.priority} />)}
              {data.recommendations.map((rec: any) => <TeacherCompactItem key={rec.id} title={rec.title} subtitle={rec.explanation} tone={teacherTone(riskTone(rec.priority)) as any} meta={rec.priority} />)}
            </TeacherCompactList>
          )}
        </TeacherSection>

        <TeacherAiInsight metric={riskLevelLabel(risk.risk_level)}>
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
