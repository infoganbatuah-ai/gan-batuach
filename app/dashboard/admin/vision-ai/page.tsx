import Link from "next/link";
import { Activity, Brain, Gauge, Radar, ShieldCheck, Timer } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildVisionDiagnosticsSummary } from "@/lib/domain/vision-analysis-pipeline";
import { getVisionProductionReadiness } from "@/lib/domain/vision-provider";

function percent(value: number | null | undefined) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function healthClass(status: string) {
  if (["healthy", "mock"].includes(status)) return "pill good";
  if (status === "offline") return "pill bad";
  return "pill warn";
}

export default async function AdminVisionAiPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin vision ai", async () => {
    const supabase = await createClient();
    const [providersRes, diagnosticsRes, jobsRes, resultsRes, feedbackRes, eventsRes] = await Promise.all([
      supabase.from("vision_provider_registry" as any).select("*").order("provider_name"),
      supabase.from("vision_diagnostics" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("vision_frame_analysis_jobs" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("vision_detection_results" as any).select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("vision_calibration_feedback" as any).select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("ai_camera_events" as any).select("id,status,severity,detection_category,combined_confidence,vision_provider,created_at").not("vision_provider", "is", null).order("created_at", { ascending: false }).limit(200)
    ]);
    [providersRes, diagnosticsRes, jobsRes, resultsRes, feedbackRes, eventsRes].forEach((query, index) => logSupabaseError(`vision ai query ${index}`, (query as any).error));
    return {
      providers: providersRes.data ?? [],
      diagnostics: diagnosticsRes.data ?? [],
      jobs: jobsRes.data ?? [],
      results: resultsRes.data ?? [],
      feedback: feedbackRes.data ?? [],
      events: eventsRes.data ?? [],
      summary: buildVisionDiagnosticsSummary((diagnosticsRes.data ?? []) as any[], (resultsRes.data ?? []) as any[], (feedbackRes.data ?? []) as any[]),
      queryError: [providersRes.error, diagnosticsRes.error, jobsRes.error, resultsRes.error, feedbackRes.error, eventsRes.error].some(Boolean) ? "חלק מנתוני הזיהוי החזותי לא נטענו" : null
    };
  }, { providers: [] as any[], diagnostics: [] as any[], jobs: [] as any[], results: [] as any[], feedback: [] as any[], events: [] as any[], summary: buildVisionDiagnosticsSummary(), queryError: null as string | null });

  const readiness = getVisionProductionReadiness();
  const providers = result.data.providers.length ? result.data.providers : readiness.providers.map((provider) => ({
    provider_key: provider.key,
    provider_name: provider.key,
    provider_type: provider.type,
    active: true,
    capabilities: { shadow_mode: true, human_review: true, real_processing: provider.supportsRealProcessing }
  }));
  const latestDiagnostics = result.data.diagnostics.slice(0, 8);
  const detectionByCategory = result.data.results.reduce((acc: Record<string, number>, row: any) => {
    acc[row.detection_category ?? "unknown"] = (acc[row.detection_category ?? "unknown"] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <DashboardShell role="admin" title="Vision AI">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Real AI Vision Integration</p>
          <h1>זיהוי חזותי מוכן לייצור במצב בטוח.</h1>
          <p>OpenCV, YOLO, Ultralytics ו-Local HTTP מוכנים כחיבורי provider. Shadow mode ובדיקת אדם נשארים חובה.</p>
        </div>
        <div className="profile-actions">
          <span className="pill good">Shadow mode</span>
          <span className="pill good">Human review</span>
          <Link className="button secondary" href="/dashboard/admin/ai-events">אירועי תצפיתן</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="זיהויים" value={result.data.summary.detectionVolume} tone="good" />
        <StatCard label="False positive" value={percent(result.data.summary.falsePositiveRate)} tone={result.data.summary.falsePositiveRate > 0.2 ? "warn" : "good"} />
        <StatCard label="Confidence" value={percent(result.data.summary.averageConfidence)} tone="good" />
        <StatCard label="Latency" value={`${result.data.summary.averageLatencyMs || 0}ms`} tone="good" />
        <StatCard label="Processing" value={`${result.data.summary.averageProcessingTimeMs || 0}ms`} tone="good" />
        <StatCard label="Providers" value={providers.length} tone="good" />
        <StatCard label="Jobs" value={result.data.jobs.length} tone="good" />
        <StatCard label="Events" value={result.data.events.length} tone="warn" />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Brain size={20} /> Provider status</h2><p>אין vendor lock-in ואין שליחת פריימים החוצה כברירת מחדל.</p></div>
          <div className="procedure-list compact-list">
            {providers.map((provider: any) => (
              <div className="mini-row" key={provider.provider_key}>
                <span>{provider.provider_name}</span>
                <strong>{provider.provider_type}</strong>
                <small>{provider.capabilities?.real_processing ? "Real processing ready" : "Mock/safe mode"} · Shadow required</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> Safety gates</h2><p>כל זיהוי נשאר המלצה לבדיקה בלבד.</p></div>
          <div className="risk-list">
            <div><Radar /> Shadow mode <b>{readiness.shadowMode ? "פעיל" : "כבוי"}</b></div>
            <div><ShieldCheck /> בדיקת אדם <b>{readiness.humanReviewRequired ? "חובה" : "לא"}</b></div>
            <div><Activity /> Calibration <b>{readiness.calibrationMode ? "פעיל" : "כבוי"}</b></div>
            <div><Timer /> Raw frames <b>{readiness.rawFramesStored ? "נשמרים" : "לא נשמרים"}</b></div>
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Gauge size={20} /> Detection trends</h2><p>נפח זיהויים לפי קטגוריה.</p></div>
          {Object.keys(detectionByCategory).length === 0 ? <div className="empty-state"><strong>אין זיהויים עדיין</strong><span>לאחר הרצת worker או mock job, המגמות יופיעו כאן.</span></div> : <div className="procedure-list compact-list">
            {Object.entries(detectionByCategory).map(([category, count]) => (
              <div className="mini-row" key={category}><span>{category}</span><strong>{count}</strong></div>
            ))}
          </div>}
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Activity size={20} /> Model health</h2><p>בריאות, latency וזמן עיבוד.</p></div>
          {latestDiagnostics.length === 0 ? <div className="empty-state"><strong>אין diagnostics עדיין</strong><span>Mock provider זמין גם בלי מודל אמיתי.</span></div> : <div className="procedure-list compact-list">
            {latestDiagnostics.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.provider_key}</span>
                <strong className={healthClass(item.model_health)}>{item.model_health}</strong>
                <small>{item.detection_volume ?? 0} detections · {item.average_latency_ms ?? "-"}ms · FP {percent(item.false_positive_rate)}</small>
              </div>
            ))}
          </div>}
        </article>
      </section>
    </DashboardShell>
  );
}
