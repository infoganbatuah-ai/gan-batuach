import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Eye, ShieldCheck, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { predictiveRiskSafeguards, riskCategoryRows, riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";
import { preventionTone, warningTypeLabel } from "@/lib/domain/predictive-safety-prevention";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0));
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export default async function InspectorRiskPage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector risk", async () => {
    const supabase = await createClient();
    const gardensRes = await supabase.from("gardens" as any).select("id,name,city").eq("inspector_id", profile.id).order("name");
    logSupabaseError("inspector risk gardens", gardensRes.error);
    const gardens = (gardensRes.data ?? []) as any[];
    const gardenIds = gardens.map((garden) => garden.id);
    const [profilesRes, signalsRes, recsRes, warningsRes, actionsRes] = gardenIds.length ? await Promise.all([
      supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).order("overall_risk_score", { ascending: false }).limit(200),
      supabase.from("predictive_risk_signals" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(120),
      supabase.from("risk_prevention_recommendations" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).eq("status", "open").order("created_at", { ascending: false }).limit(120),
      supabase.from("early_warning_signals" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).in("review_status", ["needs_review", "reviewing", "confirmed", "escalated"]).order("created_at", { ascending: false }).limit(120),
      supabase.from("prevention_recommendation_actions" as any).select("*, gardens(name,city)").in("garden_id", gardenIds).in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(120)
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    [profilesRes, signalsRes, recsRes, warningsRes, actionsRes].forEach((query, index) => logSupabaseError(`inspector risk query ${index}`, (query as any).error));
    return { gardens, profiles: (profilesRes.data ?? []) as any[], signals: (signalsRes.data ?? []) as any[], recommendations: (recsRes.data ?? []) as any[], warnings: (warningsRes.data ?? []) as any[], actions: (actionsRes.data ?? []) as any[], queryError: profilesRes.error ? "חלק מנתוני הסיכון לא נטענו" : null };
  }, { gardens: [] as any[], profiles: [] as any[], signals: [] as any[], recommendations: [] as any[], warnings: [] as any[], actions: [] as any[], queryError: null as string | null });

  const data = result.data;
  const average = avg(data.profiles, "overall_risk_score");
  const highRisk = data.profiles.filter((item) => ["high", "critical"].includes(String(item.risk_level)));
  const rising = data.profiles.filter((item) => item.risk_trend === "rising");
  const sample = data.profiles[0] ?? {};

  return (
    <DashboardShell role="inspector" title="מודיעין סיכון">
      <div className="commercial-dashboard risk-intelligence-shell">
        <PremiumDashboardHero eyebrow="Inspection Risk" title="סיכון מונע בגנים שבאחריותך" subtitle="תיעדוף ביקורות לפי דפוסים חוזרים, סיכון עולה והמלצות מניעה. אין אכיפה אוטומטית." badge={`${average}/100`} badgeTone={riskTone(average)} actions={<Link className="button primary" href="/dashboard/inspector/inspections/due">ביקורות</Link>}>
          <div className="setup-checklist"><span>{data.gardens.length} גנים</span><span>{highRisk.length} בסיכון גבוה</span><span>פקח מאשר פעולה</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="סיכון ממוצע" value={`${average}/100`} tone={riskTone(average)} />
          <RoleMetricCard label="סיכון גבוה" value={highRisk.length} tone={highRisk.length ? "bad" : "good"} />
          <RoleMetricCard label="סיכון עולה" value={rising.length} tone={rising.length ? "warn" : "good"} />
          <RoleMetricCard label="אזהרות מוקדמות" value={data.warnings.length} tone={data.warnings.length ? "warn" : "good"} />
          <RoleMetricCard label="המלצות פתוחות" value={data.recommendations.length + data.actions.length} tone={data.recommendations.length || data.actions.length ? "warn" : "good"} />
        </section>

        <section className="risk-score-grid">
          {riskCategoryRows(sample).map((row) => <article key={row.key}><AlertTriangle /><span>{row.label}</span><strong>{avg(data.profiles, `${row.key}_risk`)}/100</strong><small>{row.description}</small></article>)}
        </section>

        <CleanSection title="תיעדוף גנים" subtitle="הסיכון הגבוה ביותר מופיע ראשון.">
          {data.profiles.length === 0 ? <EmptyState title="אין פרופילי סיכון להצגה" /> : <div className="risk-table">{data.profiles.map((risk) => <Link className="risk-row" href={`/dashboard/inspector/inspections?garden=${risk.garden_id}`} key={risk.id}><div><strong>{risk.gardens?.name ?? "גן"}</strong><span>{risk.gardens?.city ?? ""} · {riskTrendLabel(risk.risk_trend)} · חזוי {riskLevelLabel(risk.predicted_risk_level)}</span></div><StatusBadge tone={riskTone(risk.overall_risk_score)}>{risk.overall_risk_score}/100</StatusBadge></Link>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><TrendingUp size={20} /> סיכון עולה</h2>{rising.length === 0 ? <div className="empty-mini">אין מגמת עלייה חריגה.</div> : rising.slice(0, 8).map((risk) => <div className="list-item" key={risk.id}><div><strong>{risk.gardens?.name ?? "גן"}</strong><span>{risk.prediction_summary ?? "מומלץ לבדוק"}</span></div><StatusBadge tone={riskTone(risk.predicted_risk_level)}>{riskLevelLabel(risk.predicted_risk_level)}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> המלצות פקח</h2>{data.recommendations.length === 0 && data.actions.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : <>{data.actions.slice(0, 8).map((rec) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.gardens?.name ?? "גן"} · {rec.description}</span></div><StatusBadge tone={preventionTone(rec.priority)}>{rec.priority}</StatusBadge></div>)}{data.recommendations.slice(0, 8).map((rec) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.gardens?.name ?? "גן"} · {rec.explanation}</span></div><StatusBadge tone={riskTone(rec.priority)}>{rec.priority}</StatusBadge></div>)}</>}</article>
        </section>

        <CleanSection title="אזהרות מוקדמות" subtitle="דפוסים חוזרים לבדיקה.">
          {data.signals.length === 0 && data.warnings.length === 0 ? <EmptyState title="אין אזהרות פתוחות" /> : <div className="risk-table">{data.warnings.slice(0, 10).map((warning) => <div className="risk-row" key={warning.id}><div><strong>{warningTypeLabel(warning.warning_type)}</strong><span>{warning.gardens?.name ?? "גן"} · {warning.recommended_action}</span></div><StatusBadge tone={preventionTone(warning.severity)}>{warning.confidence_score}%</StatusBadge></div>)}{data.signals.slice(0, 10).map((signal) => <div className="risk-row" key={signal.id}><div><strong>{signal.title}</strong><span>{signal.gardens?.name ?? "גן"} · {signal.explanation}</span></div><StatusBadge tone={riskTone(signal.severity)}>{signal.pattern_count}</StatusBadge></div>)}</div>}
        </CleanSection>

        <CleanSection title="גבולות בטיחות" subtitle="המערכת ממליצה, אדם מחליט.">
          <div className="risk-question-grid">{predictiveRiskSafeguards.map((item) => <span key={item}>{item}</span>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="ביקורת המשך" text="תכנון וביצוע" href="/dashboard/inspector/inspections/due" icon={ClipboardCheck} />
          <ActionCard title="רשת תצפיתן" text="סימנים חוזרים" href="/dashboard/inspector/observer-network" icon={Eye} />
          <ActionCard title="ציות" text="פערים ואימות" href="/dashboard/inspector/compliance" icon={ShieldCheck} />
        </section>
      </div>
    </DashboardShell>
  );
}
