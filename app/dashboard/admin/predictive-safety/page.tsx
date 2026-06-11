import Link from "next/link";
import { AlertTriangle, BarChart3, Camera, ClipboardCheck, Eye, MapPinned, Radar, ShieldCheck, Sparkles, TrendingUp, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { accuracyLabel, avg, parentSafetyBoundary, pct, preventionSafeguards, preventionTone, recommendationLabel, regionalRisk, warningTypeLabel } from "@/lib/domain/predictive-safety-prevention";
import { riskLevelLabel, riskTone, riskTrendLabel } from "@/lib/domain/predictive-risk";
import { createClient } from "@/lib/supabase/server";

function confidenceAverage(rows: any[]) {
  const values = rows.map((row) => Number(row.confidence_score ?? row.confidence_at_prediction ?? 0)).filter(Boolean);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export default async function AdminPredictiveSafetyPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("predictive safety", async () => {
    const supabase = await createClient();
    const [riskRes, warningRes, actionRes, accuracyRes, readinessRes, historyRes] = await Promise.all([
      supabase.from("kindergarten_risk_profiles" as any).select("*, gardens(id,name,city,region,status)").order("overall_risk_score", { ascending: false }).limit(500),
      supabase.from("early_warning_signals" as any).select("*, gardens(id,name,city,region,status)").in("review_status", ["needs_review", "reviewing", "confirmed", "escalated"]).order("created_at", { ascending: false }).limit(250),
      supabase.from("prevention_recommendation_actions" as any).select("*, gardens(id,name,city,region,status)").in("status", ["open", "in_progress", "approved"]).order("created_at", { ascending: false }).limit(200),
      supabase.from("prediction_accuracy_reviews" as any).select("*, gardens(id,name,city,region,status)").order("prediction_made_at", { ascending: false }).limit(300),
      supabase.from("prevention_readiness_scores" as any).select("*, gardens(id,name,city,region,status)").order("snapshot_date", { ascending: false }).limit(500),
      supabase.from("kindergarten_risk_history" as any).select("*").eq("snapshot_period", "daily").order("snapshot_date", { ascending: false }).limit(1200)
    ]);
    [riskRes, warningRes, actionRes, accuracyRes, readinessRes, historyRes].forEach((query, index) => logSupabaseError(`predictive safety query ${index}`, (query as any).error));
    const risks = (riskRes.data ?? []) as any[];
    const warnings = (warningRes.data ?? []) as any[];
    const actions = (actionRes.data ?? []) as any[];
    const accuracy = (accuracyRes.data ?? []) as any[];
    const readiness = (readinessRes.data ?? []) as any[];
    const history = (historyRes.data ?? []) as any[];
    const predictedHigh = risks.filter((risk) => ["high", "critical"].includes(String(risk.predicted_risk_level)) || Number(risk.overall_risk_score ?? 0) >= 65);
    const emerging = warnings.filter((warning) => ["medium", "high", "critical"].includes(String(warning.severity)));
    const accurate = accuracy.filter((row) => row.validation_outcome === "accurate").length;
    const inaccurate = accuracy.filter((row) => row.validation_outcome === "inaccurate").length;
    const inconclusive = accuracy.filter((row) => row.validation_outcome === "inconclusive").length;
    const accuracyRate = pct(accurate, accurate + inaccurate + inconclusive);
    const regionRows = regionalRisk(risks);
    const readinessAverage = avg(readiness, "prevention_readiness_score");
    const queryError = [warningRes.error, actionRes.error, accuracyRes.error, readinessRes.error].some(Boolean) ? "חלק מנתוני המניעה לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null;
    return { risks, warnings, actions, accuracy, readiness, history, predictedHigh, emerging, accuracyRate, accurate, inaccurate, inconclusive, regionRows, readinessAverage, queryError };
  }, {
    risks: [] as any[],
    warnings: [] as any[],
    actions: [] as any[],
    accuracy: [] as any[],
    readiness: [] as any[],
    history: [] as any[],
    predictedHigh: [] as any[],
    emerging: [] as any[],
    accuracyRate: 0,
    accurate: 0,
    inaccurate: 0,
    inconclusive: 0,
    regionRows: [] as any[],
    readinessAverage: 0,
    queryError: null as string | null
  });

  const data = result.data;
  const latestReadiness = [...data.readiness].sort((a, b) => Number(b.prevention_readiness_score ?? 0) - Number(a.prevention_readiness_score ?? 0)).slice(0, 10);

  return (
    <DashboardShell role="admin" title="בטיחות חזויה">
      <div className="commercial-dashboard predictive-safety-shell">
        <PremiumDashboardHero
          eyebrow="Predictive Safety"
          title="מרכז בטיחות ומניעה חזויה"
          subtitle="זיהוי מוקדם של דפוסים והמלצות מניעה. אין האשמות, אין אכיפה אוטומטית, וכל הסלמה דורשת אישור אנושי."
          badge={`${data.readinessAverage}/100`}
          badgeTone={preventionTone(data.readinessAverage)}
          actions={<><Link className="button primary" href="/dashboard/admin/national-inspections">פיקוח</Link><Link className="button secondary" href="/dashboard/admin/risk-intelligence">מודיעין סיכון</Link></>}
        >
          <div className="setup-checklist"><span>המלצות בלבד</span><span>בדיקת אדם חובה</span><span>לא מוצג להורים</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="מוכנות מניעה" value={`${data.readinessAverage}/100`} tone={preventionTone(data.readinessAverage)} />
          <RoleMetricCard label="גנים בסיכון חזוי" value={data.predictedHigh.length} tone={data.predictedHigh.length ? "bad" : "good"} />
          <RoleMetricCard label="אזהרות מוקדמות" value={data.warnings.length} tone={data.warnings.length ? "warn" : "good"} />
          <RoleMetricCard label="המלצות מניעה" value={data.actions.length} tone={data.actions.length ? "warn" : "good"} />
          <RoleMetricCard label="דיוק תחזית" value={`${data.accuracyRate}%`} hint="מאומת אנושית" tone={preventionTone(data.accuracyRate)} />
          <RoleMetricCard label="ביטחון ממוצע" value={`${confidenceAverage(data.warnings)}%`} tone={preventionTone(confidenceAverage(data.warnings))} />
          <RoleMetricCard label="סיכון עולה" value={data.risks.filter((risk) => risk.risk_trend === "rising").length} tone={data.risks.some((risk) => risk.risk_trend === "rising") ? "warn" : "good"} />
          <RoleMetricCard label="היסטוריה" value={data.history.length} hint="מדידות סיכון" tone="good" />
        </section>

        <section className="prediction-score-grid">
          <article><ShieldCheck /><span>ציות</span><strong>{avg(data.readiness, "compliance_component")}/100</strong><small>מסמכים ופעולות פתוחות</small></article>
          <article><ClipboardCheck /><span>פיקוח</span><strong>{avg(data.readiness, "inspections_component")}/100</strong><small>ביקורות וממצאים</small></article>
          <article><AlertTriangle /><span>אירועים</span><strong>{avg(data.readiness, "incident_history_component")}/100</strong><small>היסטוריית בטיחות</small></article>
          <article><Eye /><span>תצפיתן</span><strong>{avg(data.readiness, "observer_readiness_component")}/100</strong><small>מצלמות וכיול</small></article>
          <article><TrendingUp /><span>פעולות מתקנות</span><strong>{avg(data.readiness, "corrective_action_component")}/100</strong><small>סגירת סיכון</small></article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Radar size={20} /> גנים בסיכון חזוי</h2>
            {data.predictedHigh.length === 0 ? <div className="empty-mini">אין כרגע גנים בסיכון חזוי גבוה.</div> : data.predictedHigh.slice(0, 10).map((risk: any) => <div className="list-item" key={risk.id}><div><strong>{risk.gardens?.name ?? "גן"}</strong><span>{risk.gardens?.city ?? ""} · {riskTrendLabel(risk.risk_trend)} · חזוי {riskLevelLabel(risk.predicted_risk_level)}</span></div><StatusBadge tone={riskTone(risk.overall_risk_score)}>{risk.overall_risk_score}/100</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><Sparkles size={20} /> המלצות מניעה</h2>
            {data.actions.length === 0 ? <div className="empty-mini">אין המלצות פתוחות.</div> : data.actions.slice(0, 10).map((action: any) => <div className="list-item" key={action.id}><div><strong>{action.title}</strong><span>{action.gardens?.name ?? "גן"} · {recommendationLabel(action.recommendation_type)}</span></div><StatusBadge tone={preventionTone(action.priority)}>{action.priority}</StatusBadge></div>)}
          </article>
        </section>

        <CleanSection title="אזהרות מוקדמות" subtitle="דפוסים שזוהו לפני אירוע אפשרי. כל אזהרה דורשת בדיקה אנושית.">
          {data.warnings.length === 0 ? <EmptyState title="אין אזהרות פתוחות" text="כאשר יזוהו דפוסים חוזרים, הם יופיעו כאן." /> : (
            <div className="prediction-table">
              {data.warnings.slice(0, 14).map((warning: any) => <article className="prediction-row" key={warning.id}>
                <div><strong>{warningTypeLabel(warning.warning_type)}</strong><span>{warning.gardens?.name ?? "גן"} · {warning.recommended_action}</span></div>
                <span>ביטחון <b>{warning.confidence_score}%</b></span>
                <StatusBadge tone={preventionTone(warning.severity)}>{warning.severity}</StatusBadge>
              </article>)}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><BarChart3 size={20} /> דיוק תחזיות</h2>
            <div className="prediction-mini-grid">
              <span>מדויק <b>{data.accurate}</b></span>
              <span>לא מדויק <b>{data.inaccurate}</b></span>
              <span>לא חד משמעי <b>{data.inconclusive}</b></span>
              <span>ממתין <b>{data.accuracy.filter((row) => row.validation_outcome === "pending").length}</b></span>
            </div>
            {data.accuracy.slice(0, 5).map((row: any) => <div className="list-item" key={row.id}><div><strong>{row.gardens?.name ?? "גן"}</strong><span>{row.prediction_made_at ? new Date(row.prediction_made_at).toLocaleDateString("he-IL") : ""}</span></div><StatusBadge tone={preventionTone(row.validation_outcome)}>{accuracyLabel(row.validation_outcome)}</StatusBadge></div>)}
          </article>
          <article className="card action-panel">
            <h2><MapPinned size={20} /> סיכון אזורי</h2>
            {data.regionRows.length === 0 ? <div className="empty-mini">אין אזורים להצגה.</div> : data.regionRows.slice(0, 8).map((region: any) => <div className="list-item" key={region.region}><div><strong>{region.region}</strong><span>{region.high} גבוהים · {region.rising} במגמת עלייה</span></div><StatusBadge tone={riskTone(region.averageRisk)}>{region.averageRisk}/100</StatusBadge></div>)}
          </article>
        </section>

        <CleanSection title="מוכנות מניעה לפי גן" subtitle="ציון 0-100 המבוסס על ציות, פיקוח, אירועים, תצפיתן וסגירת פעולות.">
          {latestReadiness.length === 0 ? <EmptyState title="אין ציוני מניעה עדיין" /> : (
            <div className="prediction-table">
              {latestReadiness.map((row: any) => <article className="prediction-row" key={row.id}>
                <div><strong>{row.gardens?.name ?? "גן"}</strong><span>{row.gardens?.city ?? ""} · {row.snapshot_date ? new Date(row.snapshot_date).toLocaleDateString("he-IL") : ""}</span></div>
                <span>ציות <b>{row.compliance_component}/100</b></span>
                <span>פיקוח <b>{row.inspections_component}/100</b></span>
                <StatusBadge tone={preventionTone(row.prevention_readiness_score)}>{row.prevention_readiness_score}/100</StatusBadge>
              </article>)}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><UsersRound size={20} /> גבול הורים</h2><div className="setup-checklist">{parentSafetyBoundary.map((item) => <span key={item}>{item}</span>)}</div></article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> כללי בטיחות</h2><div className="setup-checklist">{preventionSafeguards.map((item) => <span key={item}>{item}</span>)}</div></article>
        </section>

        <CleanSection title="שאלות עוזר מניעה" subtitle="העוזר מסכם נתונים קיימים בלבד.">
          <div className="prediction-question-grid">{["אילו גנים הופכים למסוכנים?", "אילו סיכונים עולים מהר?", "אילו פעולות מניעה מומלצות?", "אילו דפוסים חוזרים?"].map((question) => <Link href="/dashboard/admin/predictive-safety" key={question}>{question}</Link>)}</div>
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="מודיעין סיכון" text="פרופילי סיכון" href="/dashboard/admin/risk-intelligence" icon={Radar} />
          <ActionCard title="פיקוח ארצי" text="ביקורות המשך" href="/dashboard/admin/national-inspections" icon={ClipboardCheck} />
          <ActionCard title="ציות" text="פעולות פתוחות" href="/dashboard/admin/compliance-center" icon={ShieldCheck} />
          <ActionCard title="תצפיתן" text="סיגנלים וכיול" href="/dashboard/admin/observer-network" icon={Eye} />
          <ActionCard title="מצלמות" text="ניתוקים ודפוסים" href="/dashboard/admin/camera-deployment" icon={Camera} />
        </section>
      </div>
    </DashboardShell>
  );
}
