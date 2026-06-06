import Link from "next/link";
import { Brain, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildReviewedManagerDetection, buildVisionDiagnosticsSummary } from "@/lib/domain/vision-analysis-pipeline";

function percent(value: number | null | undefined) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

export default async function GardenVisionAiPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden vision ai", async () => {
    const supabase = await createClient();
    const [detectionsRes, diagnosticsRes, feedbackRes, eventsRes] = await Promise.all([
      supabase.from("vision_detection_results" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100),
      supabase.from("vision_diagnostics" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(50),
      supabase.from("vision_calibration_feedback" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100),
      supabase.from("ai_camera_events" as any).select("*").eq("kindergarten_id", gardenId).not("vision_provider", "is", null).in("status", ["confirmed", "dismissed", "escalated"]).order("created_at", { ascending: false }).limit(50)
    ]);
    [detectionsRes, diagnosticsRes, feedbackRes, eventsRes].forEach((query, index) => logSupabaseError(`garden vision query ${index}`, (query as any).error));
    return {
      detections: detectionsRes.data ?? [],
      diagnostics: diagnosticsRes.data ?? [],
      feedback: feedbackRes.data ?? [],
      reviewedEvents: eventsRes.data ?? [],
      summary: buildVisionDiagnosticsSummary((diagnosticsRes.data ?? []) as any[], (detectionsRes.data ?? []) as any[], (feedbackRes.data ?? []) as any[]),
      queryError: [detectionsRes.error, diagnosticsRes.error, feedbackRes.error, eventsRes.error].some(Boolean) ? "חלק מנתוני הזיהוי החזותי לא נטענו" : null
    };
  }, { detections: [] as any[], diagnostics: [] as any[], feedback: [] as any[], reviewedEvents: [] as any[], summary: buildVisionDiagnosticsSummary(), queryError: null as string | null });

  const reviewed = result.data.reviewedEvents.map((event: any) => buildReviewedManagerDetection(event));

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="זיהוי חזותי">
      <div className="dashboard-hero-card">
        <div>
          <p className="eyebrow">Vision AI</p>
          <h1>זיהוי חזותי לאחר בדיקת אדם.</h1>
          <p>כאן מופיעות תוצאות בטוחות ומסוכמות בלבד. אין זיהוי פנים, אין ניקוד צוות, ואין מסקנות אוטומטיות.</p>
        </div>
        <div className="profile-actions">
          <span className="pill good">בדיקת אדם חובה</span>
          <Link className="button secondary" href="/dashboard/garden/ai-events">אירועים לבדיקה</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="זיהויים" value={result.data.summary.detectionVolume} tone="good" />
        <StatCard label="Confidence" value={percent(result.data.summary.averageConfidence)} tone="good" />
        <StatCard label="False positive" value={percent(result.data.summary.falsePositiveRate)} tone={result.data.summary.falsePositiveRate > 0.2 ? "warn" : "good"} />
        <StatCard label="נבדקו" value={reviewed.length} tone="good" />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> מה מוצג למנהלת</h2><p>רק מידע מסוכם, ללא פריימים גולמיים או פרטי מודל פנימיים.</p></div>
          <div className="risk-list">
            <div>זיהויים שנבדקו <b>{reviewed.length}</b></div>
            <div>מצב shadow <b>פעיל</b></div>
            <div>הורים <b>לא רואים זיהויים גולמיים</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Brain size={20} /> המלצות זהירות</h2><p>כל המלצה היא תזכורת לבדיקה, לא החלטה אוטומטית.</p></div>
          <div className="risk-list">
            <div>אין זיהוי ילדים <b>מושבת</b></div>
            <div>אין ניקוד צוות <b>מושבת</b></div>
            <div>אין האשמות אוטומטיות <b>מושבת</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>זיהויים שנבדקו</h2><p>רק אירועים שעברו בדיקה אנושית מוצגים כאן.</p></div>
        {reviewed.length === 0 ? <div className="empty-state"><strong>אין זיהויים שנבדקו עדיין</strong><span>אירועי shadow יופיעו קודם במסך אירועי תצפיתן.</span></div> : <div className="procedure-list">
          {reviewed.map((event: any, index: number) => (
            <article className="card procedure-card" key={`${event.title}-${index}`}>
              <div>
                <span className="pill good">נבדק</span>
                <h3>{event.title}</h3>
                <p>{event.recommendedAction}</p>
                <small>Confidence לאחר כיול: {percent(event.confidence)}</small>
              </div>
              <span className="pill">{event.status}</span>
            </article>
          ))}
        </div>}
      </section>
    </DashboardShell>
  );
}
