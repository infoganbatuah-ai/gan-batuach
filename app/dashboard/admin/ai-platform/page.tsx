import Link from "next/link";
import { Activity, Bot, BrainCircuit, Database, Gauge, GitBranch, ShieldCheck, SlidersHorizontal, Sparkles, TrendingDown } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { calculateObserverAccuracy, pct, scoreTone, statusTone } from "@/lib/domain/observer-calibration";

function average(rows: any[], key: string) {
  const values = rows.map((row) => Number(row[key] ?? 0)).filter((value) => value > 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function aiReadinessScore(input: { models: any[]; datasets: any[]; calibrations: any[]; evaluations: any[]; governance: any[]; accuracy: ReturnType<typeof calculateObserverAccuracy> }) {
  const approvedModels = input.models.filter((model) => ["approved", "production"].includes(String(model.lifecycle_status))).length;
  const reviewReadyDatasets = input.datasets.filter((dataset) => ["review_ready", "approved"].includes(String(dataset.approval_status))).length;
  const calibrated = input.calibrations.filter((item) => ["review_ready", "approved"].includes(String(item.calibration_status))).length;
  const completedEvaluations = input.evaluations.filter((item) => item.evaluation_status === "completed").length;
  const approvedGovernance = input.governance.filter((item) => String(item.status).startsWith("approved")).length;
  const score =
    Math.min(input.models.length ? (approvedModels / input.models.length) * 20 : 4, 20)
    + Math.min(input.datasets.length ? (reviewReadyDatasets / input.datasets.length) * 15 : 3, 15)
    + Math.min(input.calibrations.length ? (calibrated / input.calibrations.length) * 20 : 4, 20)
    + Math.min(input.evaluations.length ? (completedEvaluations / input.evaluations.length) * 15 : 3, 15)
    + Math.min(input.governance.length ? (approvedGovernance / input.governance.length) * 10 : 2, 10)
    + Math.min(input.accuracy.readinessScore * 0.2, 20);
  return Math.round(score);
}

export default async function AdminAiPlatformPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("ai platform", async () => {
    const supabase = await createClient();
    const [modelsRes, datasetsRes, calibrationsRes, evaluationsRes, deploymentsRes, matrixRes, governanceRes, auditRes, reviewsRes] = await Promise.all([
      supabase.from("ai_models" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("ai_training_datasets" as any).select("*").order("updated_at", { ascending: false }).limit(120),
      supabase.from("ai_model_calibrations" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("ai_model_evaluations" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("ai_model_deployments" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("ai_vertical_capability_matrix" as any).select("*").order("vertical_key").limit(200),
      supabase.from("ai_governance_reviews" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("ai_audit_events" as any).select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("observer_ground_truth_reviews" as any).select("*").order("created_at", { ascending: false }).limit(500)
    ]);
    [modelsRes, datasetsRes, calibrationsRes, evaluationsRes, deploymentsRes, matrixRes, governanceRes, auditRes, reviewsRes].forEach((query, index) => logSupabaseError(`ai platform query ${index}`, (query as any).error));
    const reviews = (reviewsRes.data ?? []) as any[];
    const accuracy = calculateObserverAccuracy(reviews, [], []);
    const data = {
      models: (modelsRes.data ?? []) as any[],
      datasets: (datasetsRes.data ?? []) as any[],
      calibrations: (calibrationsRes.data ?? []) as any[],
      evaluations: (evaluationsRes.data ?? []) as any[],
      deployments: (deploymentsRes.data ?? []) as any[],
      matrix: (matrixRes.data ?? []) as any[],
      governance: (governanceRes.data ?? []) as any[],
      audit: (auditRes.data ?? []) as any[],
      accuracy,
      queryError: [modelsRes.error, datasetsRes.error, calibrationsRes.error, evaluationsRes.error, deploymentsRes.error, matrixRes.error, governanceRes.error, auditRes.error, reviewsRes.error].some(Boolean) ? "חלק מנתוני פלטפורמת ה-AI לא נטענו. ייתכן שמיגרציית PHASE 138 עדיין לא הורצה." : null
    };
    return { ...data, readinessScore: aiReadinessScore(data) };
  }, {
    models: [] as any[],
    datasets: [] as any[],
    calibrations: [] as any[],
    evaluations: [] as any[],
    deployments: [] as any[],
    matrix: [] as any[],
    governance: [] as any[],
    audit: [] as any[],
    accuracy: calculateObserverAccuracy([], [], []),
    readinessScore: 0,
    queryError: null as string | null
  });

  const data = result.data;
  const activeModels = data.models.filter((model: any) => !["retired"].includes(String(model.lifecycle_status))).length;
  const driftWatch = data.models.filter((model: any) => ["watch", "degraded", "critical"].includes(String(model.drift_status))).length;
  const testingModels = data.models.filter((model: any) => ["testing", "pilot"].includes(String(model.lifecycle_status))).length;
  const productionModels = data.models.filter((model: any) => model.lifecycle_status === "production").length;
  const avgAccuracy = average(data.models, "accuracy");

  return (
    <DashboardShell role="admin" title="פלטפורמת AI">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="AI Platform"
          title="ניהול מודלים, כיול, אימון ובקרה"
          subtitle="שכבת ניהול מבוקרת ל-Digital Observer ולעוזרי ה-AI. אין קידום אוטומטי, אין החלטות אוטומטיות, וכל שינוי דורש ביקורת אנושית."
          badge={`${data.readinessScore}/100`}
          badgeTone={scoreTone(data.readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/observer-calibration">כיול תצפיתן</Link><Link className="button secondary" href="/dashboard/admin/observer-test-center">Ground Truth</Link></>}
        >
          <div className="setup-checklist">
            <span>Human approval required</span>
            <span>No automatic production promotion</span>
            <span>Explainable and measurable AI only</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="Models" value={activeModels} hint="מודלים רשומים" tone={activeModels ? "good" : "warn"} />
          <RoleMetricCard label="Versions" value={data.models.length} hint="גרסאות מנוהלות" tone="default" />
          <RoleMetricCard label="Testing" value={testingModels} hint="בדיקה / פיילוט" tone={testingModels ? "warn" : "default"} />
          <RoleMetricCard label="Production" value={productionModels} hint="לא מקודם אוטומטית" tone={productionModels ? "good" : "default"} />
          <RoleMetricCard label="Accuracy" value={avgAccuracy ? `${Math.round(avgAccuracy)}%` : "אין"} hint="ממוצע מודלים" tone={avgAccuracy >= 75 ? "good" : "warn"} />
          <RoleMetricCard label="Drift" value={driftWatch} hint="דורש מעקב" tone={driftWatch ? "bad" : "good"} />
          <RoleMetricCard label="Reviews" value={data.accuracy.reviewed} hint="משוב אנושי" tone={data.accuracy.reviewed ? "good" : "warn"} />
          <RoleMetricCard label="Observer" value={`${data.accuracy.readinessScore}/100`} hint="מוכנות תצפיתן" tone={scoreTone(data.accuracy.readinessScore)} />
        </div>

        <CleanSection title="מודלים פעילים" subtitle="Registry מרכזי לכל מודל, גרסה, קטגוריה, סטטוס ודיוק.">
          {data.models.length === 0 ? <EmptyState title="אין מודלים רשומים" text="לאחר הרצת המיגרציה יופיעו מודלי Shadow, Risk ו-Compliance." /> : (
            <div className="procedure-list">
              {data.models.map((model: any) => (
                <article className="card procedure-card" key={model.id}>
                  <div>
                    <StatusBadge tone={statusTone(model.lifecycle_status)}>{model.lifecycle_status}</StatusBadge>
                    <h3>{model.model_name}</h3>
                    <p>{model.category} · {model.model_type} · version {model.model_version}</p>
                    <small>{model.notes || "מודל מנוהל ללא קידום אוטומטי."}</small>
                  </div>
                  <div className="procedure-meta">
                    <strong>{Math.round(Number(model.accuracy ?? 0))}%</strong>
                    <span>{model.deployment_status}</span>
                    <StatusBadge tone={statusTone(model.drift_status)}>{model.drift_status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><Database size={20} /> Training datasets</h2>
            {data.datasets.length === 0 ? <div className="empty-mini">אין registry של דאטהסטים.</div> : data.datasets.map((dataset: any) => (
              <div className="list-item" key={dataset.id}>
                <div><strong>{dataset.dataset_name}</strong><span>{dataset.dataset_source} · {dataset.dataset_purpose}</span></div>
                <StatusBadge tone={statusTone(dataset.approval_status)}>{dataset.quality_score}/100</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><SlidersHorizontal size={20} /> Calibration</h2>
            {data.calibrations.length === 0 ? <div className="empty-mini">אין כיולים.</div> : data.calibrations.map((calibration: any) => (
              <div className="list-item" key={calibration.id}>
                <div><strong>{calibration.model_key}</strong><span>סף ביטחון {pct(Number(calibration.confidence_threshold ?? 0))} · התראה {pct(Number(calibration.alert_threshold ?? 0))}</span></div>
                <StatusBadge tone={statusTone(calibration.calibration_status)}>{calibration.calibration_status}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><TrendingDown size={20} /> Evaluation & drift</h2>
            <div className="risk-list">
              <div>Evaluations <b>{data.evaluations.length}</b></div>
              <div>Deployments <b>{data.deployments.length}</b></div>
              <div>Governance reviews <b>{data.governance.length}</b></div>
              <div>Audit events <b>{data.audit.length}</b></div>
            </div>
          </article>
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> AI controls</h2>
            <div className="setup-checklist">
              <span>אין החלטות אוטומטיות</span>
              <span>אין פריסה לייצור בלי אישור</span>
              <span>אין אימון אוטומטי</span>
              <span>אין חשיפת אירועי AI גולמיים להורים</span>
              <span>Rollback readiness לכל פריסה</span>
            </div>
          </article>
        </section>

        <CleanSection title="Capability Matrix" subtitle="הפעלת יכולות לפי Gan Batuach, School Safe, Business Observer ו-Home Observer.">
          {data.matrix.length === 0 ? <EmptyState title="אין מטריצת יכולות" text="המיגרציה מוסיפה יכולות התחלתיות עם הגבלות רגולטוריות." /> : (
            <div className="premium-action-grid">
              {data.matrix.map((item: any) => (
                <article className="premium-action-card" key={item.id}>
                  <GitBranch size={22} />
                  <strong>{item.capability_name}</strong>
                  <span>{item.module_name} · {item.regulatory_mode}</span>
                  <StatusBadge tone={item.enabled ? "good" : "default"}>{item.enabled ? "מאופשר" : "כבוי"}</StatusBadge>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="Observer Calibration" text="ספי ביטחון ודיוק" href="/dashboard/admin/observer-calibration" icon={Gauge} tone="good" />
          <ActionCard title="Observer Replay" text="בדיקת החלטות והסברים" href="/dashboard/admin/observer-replay" icon={Activity} />
          <ActionCard title="Observer Network" text="אותות בטיחות מאוחדים" href="/dashboard/admin/observer-network" icon={BrainCircuit} />
          <ActionCard title="Risk Intelligence" text="המלצות מניעה בלבד" href="/dashboard/admin/risk-intelligence" icon={Sparkles} />
          <ActionCard title="AI Events" text="אירועים לבדיקה אנושית" href="/dashboard/admin/ai-events" icon={Bot} />
        </section>
      </div>
    </DashboardShell>
  );
}
