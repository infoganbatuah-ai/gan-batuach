import Link from "next/link";
import { Brain, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildReviewedManagerDetection, buildVisionDiagnosticsSummary } from "@/lib/domain/vision-analysis-pipeline";
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
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="זיהוי חזותי" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="זיהוי חזותי בטוח" avatarUrl={(profile as any).avatar_url ?? null} active="more">
      <TeacherPageTitle
        icon={Brain}
        title="זיהוי חזותי"
        subtitle="רק תוצאות שעברו בדיקת אדם. בלי זיהוי פנים, בלי ניקוד צוות ובלי מסקנות אוטומטיות."
        action={<Link className="teacher-soft-button purple" href="/dashboard/garden/ai-events">אירועים לבדיקה</Link>}
      />
      <AdminDataError message={result.error ?? result.data.queryError} />

      <TeacherStatsGrid>
        <TeacherStatCard title="זיהויים" value={result.data.summary.detectionVolume} hint="מסוכמים" icon={Brain} tone="blue" />
        <TeacherStatCard title="דיוק ממוצע" value={percent(result.data.summary.averageConfidence)} hint="לא החלטה אוטומטית" icon={ShieldCheck} tone="green" />
        <TeacherStatCard title="False positive" value={percent(result.data.summary.falsePositiveRate)} hint="למעקב אנושי" icon={ShieldCheck} tone={result.data.summary.falsePositiveRate > 0.2 ? "orange" : "green"} />
        <TeacherStatCard title="נבדקו" value={reviewed.length} hint="אירועים" icon={ShieldCheck} tone="purple" />
      </TeacherStatsGrid>

      <section className="teacher-dashboard-grid">
        <TeacherSection title="מה מוצג למנהלת" subtitle="מידע מסוכם בלבד, ללא פריימים גולמיים או פרטי מודל פנימיים">
          <TeacherCompactList>
            <TeacherCompactItem title="זיהויים שנבדקו" subtitle="עברו סינון אנושי לפני הצגה" tone="green" meta={reviewed.length} />
            <TeacherCompactItem title="מצב Shadow" subtitle="תצפית זהירה ללא פעולה אוטומטית" tone="purple" meta="פעיל" />
            <TeacherCompactItem title="הורים" subtitle="לא רואים זיהויים גולמיים" tone="blue" meta="מוגן" />
          </TeacherCompactList>
        </TeacherSection>
        <TeacherSection title="המלצות זהירות" subtitle="תזכורות לבדיקה בלבד, לא החלטה אוטומטית">
          <TeacherCompactList>
            <TeacherCompactItem title="אין זיהוי ילדים" subtitle="פונקציה רגישה נשארת כבויה" tone="green" meta="מושבת" />
            <TeacherCompactItem title="אין ניקוד צוות" subtitle="אין דירוג אישי או אוטומטי" tone="green" meta="מושבת" />
            <TeacherCompactItem title="אין האשמות אוטומטיות" subtitle="כל פעולה דורשת בדיקת אדם" tone="green" meta="מושבת" />
          </TeacherCompactList>
        </TeacherSection>
      </section>

      <TeacherSection title="זיהויים שנבדקו" subtitle="רק אירועים שעברו בדיקה אנושית מוצגים כאן">
        {reviewed.length === 0 ? (
          <TeacherEmptyState title="אין זיהויים שנבדקו עדיין" text="אירועי Shadow יופיעו קודם במסך אירועי תצפיתן." />
        ) : (
          <TeacherCompactList>
            {reviewed.map((event: any, index: number) => (
              <TeacherCompactItem key={`${event.title}-${index}`} title={event.title} subtitle={`${event.recommendedAction} · דיוק ${percent(event.confidence)}`} tone="green" meta={event.status} />
            ))}
          </TeacherCompactList>
        )}
      </TeacherSection>

      <TeacherQuickActions title="פעולות זיהוי">
        <TeacherActionTile title="אירועים לבדיקה" href="/dashboard/garden/ai-events" icon={ShieldCheck} tone="purple" />
        <TeacherActionTile title="מצלמות" href="/dashboard/garden/cameras" icon={Brain} tone="blue" />
      </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
