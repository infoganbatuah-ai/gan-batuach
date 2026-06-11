import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { cleanRiskReasons, predictiveRiskSafeguards, riskCategoryRows, riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";
import { preventionTone, warningTypeLabel } from "@/lib/domain/predictive-safety-prevention";

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
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="סיכון ומניעה">
      <div className="commercial-dashboard risk-intelligence-shell">
        <PremiumDashboardHero eyebrow="Prevention" title="מרכז מניעה של הגן" subtitle="איתור מוקדם של דפוסים: אירועים, פניות, צוות, ציות, מצלמות ותצפיתן. המלצות בלבד, בדיקה אנושית לפני פעולה." badge={`${risk.overall_risk_score}/100`} badgeTone={riskTone(Number(risk.overall_risk_score ?? 0))} actions={<Link className="button primary" href="/dashboard/garden/tasks">משימות</Link>}>
          <div className="setup-checklist"><span>{riskLevelLabel(risk.risk_level)}</span><span>{riskTrendLabel(risk.risk_trend)}</span><span>לא מוצג להורים</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="סיכון כללי" value={`${risk.overall_risk_score}/100`} tone={riskTone(Number(risk.overall_risk_score ?? 0))} />
          <RoleMetricCard label="מוכנות מניעה" value={`${data.readiness?.prevention_readiness_score ?? 0}/100`} tone={preventionTone(Number(data.readiness?.prevention_readiness_score ?? 0))} />
          <RoleMetricCard label="בטיחות" value={`${risk.safety_risk}/100`} tone={riskTone(Number(risk.safety_risk ?? 0))} />
          <RoleMetricCard label="צוות" value={`${risk.staffing_risk}/100`} tone={riskTone(Number(risk.staffing_risk ?? 0))} />
          <RoleMetricCard label="אזהרות" value={data.warnings.length} tone={data.warnings.length ? "warn" : "good"} />
        </section>

        <section className="risk-score-grid">
          {riskCategoryRows(risk).map((row) => <article key={row.key}><AlertTriangle /><span>{row.label}</span><strong>{row.value}/100</strong><small>{row.description}</small></article>)}
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><AlertTriangle size={20} /> מה מעלה סיכון</h2>{reasons.length === 0 ? <div className="empty-mini">אין דפוס חריג כרגע.</div> : reasons.map((reason) => <div className="list-item" key={reason}><div><strong>{reason}</strong><span>דורש בדיקה רגועה</span></div><StatusBadge tone="warn">פתוח</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> איך מורידים סיכון</h2>{improvements.length === 0 ? <div className="empty-mini">אין המלצות זמינות.</div> : improvements.map((item) => <div className="list-item" key={item}><div><strong>{item}</strong><span>פעולה מונעת</span></div><StatusBadge tone="good">מומלץ</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="אזהרות מוקדמות" subtitle="דפוסים חוזרים לבדיקה. אין מסקנה אוטומטית.">
          {data.warnings.length === 0 && data.signals.length === 0 ? <EmptyState title="אין אזהרות פתוחות" /> : <div className="risk-table">{data.warnings.map((warning) => <div className="risk-row" key={warning.id}><div><strong>{warningTypeLabel(warning.warning_type)}</strong><span>{warning.recommended_action}</span></div><StatusBadge tone={preventionTone(warning.severity)}>{warning.confidence_score}%</StatusBadge></div>)}{data.signals.map((signal) => <div className="risk-row" key={signal.id}><div><strong>{signal.title}</strong><span>{signal.explanation}</span></div><StatusBadge tone={riskTone(signal.severity)}>{signal.pattern_count}</StatusBadge></div>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><ClipboardCheck size={20} /> המלצות מניעה</h2>{data.recommendations.length === 0 && data.actions.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : <>{data.actions.map((rec) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.description}</span></div><StatusBadge tone={preventionTone(rec.priority)}>{rec.priority}</StatusBadge></div>)}{data.recommendations.map((rec) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.explanation}</span></div><StatusBadge tone={riskTone(rec.priority)}>{rec.priority}</StatusBadge></div>)}</>}</article>
          <article className="card action-panel"><h2><UsersRound size={20} /> גבול צוות וילדים</h2><div className="setup-checklist">{predictiveRiskSafeguards.map((item) => <span key={item}>{item}</span>)}</div></article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="צוות" text="שיבוץ ונוכחות" href="/dashboard/garden/staff" icon={UsersRound} />
          <ActionCard title="ציות" text="מסמכים ופעולות" href="/dashboard/garden/compliance" icon={ShieldCheck} />
          <ActionCard title="פיקוח" text="ליקויים וביקורות" href="/dashboard/garden/inspections" icon={ClipboardCheck} />
          <ActionCard title="מצלמות" text="כיסוי ובריאות" href="/dashboard/garden/camera-health" icon={Camera} />
        </section>
      </div>
    </DashboardShell>
  );
}
