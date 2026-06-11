import Link from "next/link";
import { AlertTriangle, BarChart3, Brain, ClipboardCheck, Eye, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { predictiveRiskSafeguards, riskAssistantQuestions, riskCategoryRows, riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";

function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0));
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export default async function AdminRiskIntelligencePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("risk intelligence", async () => {
    const supabase = await createClient();
    const [profilesRes, signalsRes, recsRes, historyRes] = await Promise.all([
      supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(name,city,status)").order("overall_risk_score", { ascending: false }).limit(500),
      supabase.from("predictive_risk_signals" as any).select("*, gardens(name,city)").in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(200),
      supabase.from("risk_prevention_recommendations" as any).select("*, gardens(name,city)").eq("status", "open").order("created_at", { ascending: false }).limit(160),
      supabase.from("kindergarten_risk_history" as any).select("*").eq("snapshot_period", "daily").order("snapshot_date", { ascending: false }).limit(1200)
    ]);
    [profilesRes, signalsRes, recsRes, historyRes].forEach((query, index) => logSupabaseError(`risk intelligence query ${index}`, (query as any).error));
    const profiles = (profilesRes.data ?? []) as any[];
    const signals = (signalsRes.data ?? []) as any[];
    const recommendations = (recsRes.data ?? []) as any[];
    const history = (historyRes.data ?? []) as any[];
    return {
      profiles,
      signals,
      recommendations,
      history,
      averageRisk: avg(profiles, "overall_risk_score"),
      highRisk: profiles.filter((profile) => ["high", "critical"].includes(String(profile.risk_level))).slice(0, 10),
      rising: profiles.filter((profile) => profile.risk_trend === "rising").slice(0, 10),
      declining: profiles.filter((profile) => profile.risk_trend === "declining").slice(0, 10),
      predicted: profiles.filter((profile) => ["high", "critical"].includes(String(profile.predicted_risk_level))).slice(0, 10),
      queryError: [profilesRes.error, signalsRes.error].some(Boolean) ? "חלק מנתוני הסיכון לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, { profiles: [] as any[], signals: [] as any[], recommendations: [] as any[], history: [] as any[], averageRisk: 0, highRisk: [] as any[], rising: [] as any[], declining: [] as any[], predicted: [] as any[], queryError: null as string | null });

  const data = result.data;
  const sample = data.profiles[0] ?? {};
  return (
    <DashboardShell role="admin" title="Risk Intelligence">
      <div className="commercial-dashboard risk-intelligence-shell">
        <PremiumDashboardHero eyebrow="Predictive Safety" title="מרכז מודיעין סיכונים" subtitle="זיהוי דפוסים מוקדם: תלונות, אירועים, ציות, תצפיתן, מצלמות ונוכחות. הכל מייעץ, בדיקת אדם חובה." badge={`${data.averageRisk}/100`} badgeTone={riskTone(data.averageRisk)} actions={<><Link className="button primary" href="/dashboard/admin/national-inspections">פיקוח</Link><Link className="button secondary" href="/dashboard/admin/observer-network">תצפיתן</Link></>}>
          <div className="setup-checklist"><span>ללא האשמות</span><span>ללא אכיפה אוטומטית</span><span>ללא הודעות פאניקה להורים</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="סיכון ממוצע" value={`${data.averageRisk}/100`} tone={riskTone(data.averageRisk)} />
          <RoleMetricCard label="סיכון גבוה" value={data.highRisk.length} tone={data.highRisk.length ? "bad" : "good"} />
          <RoleMetricCard label="סיכון עולה" value={data.rising.length} tone={data.rising.length ? "warn" : "good"} />
          <RoleMetricCard label="חזוי גבוה" value={data.predicted.length} tone={data.predicted.length ? "bad" : "good"} />
          <RoleMetricCard label="אזהרות פתוחות" value={data.signals.length} tone={data.signals.length ? "warn" : "good"} />
          <RoleMetricCard label="המלצות" value={data.recommendations.length} tone={data.recommendations.length ? "warn" : "good"} />
          <RoleMetricCard label="סיכון יורד" value={data.declining.length} tone="good" />
          <RoleMetricCard label="היסטוריה" value={data.history.length} hint="מדידות" tone="good" />
        </section>

        <section className="risk-score-grid">
          {riskCategoryRows(sample).map((row) => <article key={row.key}><Brain /><span>{row.label}</span><strong>{avg(data.profiles, `${row.key}_risk`)}/100</strong><small>{row.description}</small></article>)}
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><AlertTriangle size={20} /> גנים בסיכון גבוה</h2>{data.highRisk.length === 0 ? <div className="empty-mini">אין גנים בסיכון גבוה.</div> : data.highRisk.map((profile: any) => <div className="list-item" key={profile.id}><div><strong>{profile.gardens?.name ?? "גן"}</strong><span>{profile.gardens?.city ?? ""} · {riskTrendLabel(profile.risk_trend)}</span></div><StatusBadge tone={riskTone(profile.overall_risk_score)}>{profile.overall_risk_score}/100</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><TrendingUp size={20} /> סיכון עולה</h2>{data.rising.length === 0 ? <div className="empty-mini">אין מגמת עלייה חריגה.</div> : data.rising.map((profile: any) => <div className="list-item" key={profile.id}><div><strong>{profile.gardens?.name ?? "גן"}</strong><span>{profile.prediction_summary ?? "ממתין לבדיקה"}</span></div><StatusBadge tone={riskTone(profile.predicted_risk_level)}>{riskLevelLabel(profile.predicted_risk_level)}</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="אזהרות מוקדמות" subtitle="דפוסים חוזרים שמחייבים בדיקה אנושית.">
          {data.signals.length === 0 ? <EmptyState title="אין אזהרות פתוחות" text="כשהמערכת תזהה דפוס חוזר, הוא יופיע כאן." /> : <div className="risk-table">{data.signals.slice(0, 12).map((signal: any) => <div className="risk-row" key={signal.id}><div><strong>{signal.title}</strong><span>{signal.gardens?.name ?? "גן"} · {signal.explanation}</span></div><StatusBadge tone={riskTone(signal.severity)}>{signal.pattern_count}</StatusBadge></div>)}</div>}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><ShieldCheck size={20} /> המלצות מניעה</h2>{data.recommendations.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : data.recommendations.slice(0, 8).map((rec: any) => <div className="list-item" key={rec.id}><div><strong>{rec.title}</strong><span>{rec.gardens?.name ?? "גן"} · {rec.explanation}</span></div><StatusBadge tone={riskTone(rec.priority)}>{rec.priority}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><Eye size={20} /> גבולות פרטיות</h2><div className="setup-checklist">{predictiveRiskSafeguards.map((item) => <span key={item}>{item}</span>)}</div></article>
        </section>

        <CleanSection title="שאלות עוזר סיכון" subtitle="מבוססות נתונים קיימים בלבד.">
          <div className="risk-question-grid">{riskAssistantQuestions.map((question) => <Link href="/dashboard/admin/risk-intelligence" key={question}>{question}</Link>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="פיקוח ארצי" text="ביקורת מונעת" href="/dashboard/admin/national-inspections" icon={ClipboardCheck} />
          <ActionCard title="רשת בטיחות" text="סימנים חוזרים" href="/dashboard/admin/observer-network" icon={Eye} />
          <ActionCard title="ציות" text="כשלים חוזרים" href="/dashboard/admin/compliance-center" icon={ShieldCheck} />
          <ActionCard title="דירוג" text="אמון ושיפור" href="/dashboard/admin/rating-system" icon={BarChart3} />
        </section>
      </div>
    </DashboardShell>
  );
}
