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

type VisionRow = Record<string, unknown>;

async function visionQuery(label: string, run: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const response = await run();
    logSupabaseError(label, response.error);
    return { rows: (response.error ? [] : response.data ?? []) as VisionRow[], available: !response.error };
  } catch (error) {
    logSupabaseError(label, error);
    return { rows: [] as VisionRow[], available: false };
  }
}

export default async function GardenVisionAiPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const unavailable = { detections: [] as VisionRow[], diagnostics: [] as VisionRow[], feedback: [] as VisionRow[], reviewedEvents: [] as VisionRow[], summary: buildVisionDiagnosticsSummary(), available: [false, false, false, false], queryError: "נתוני הזיהוי החזותי אינם זמינים" as string | null };
  const result = await safeAdminData("garden vision ai", async () => {
    if (!gardenId) return { ...unavailable, queryError: "נדרש הקשר גן תקף כדי לטעון את נתוני הזיהוי החזותי" };
    const supabase = await createClient();
    const [detectionsRes, diagnosticsRes, feedbackRes, eventsRes] = await Promise.all([
      visionQuery("garden vision detections", () => supabase.from("vision_detection_results" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100)),
      visionQuery("garden vision diagnostics", () => supabase.from("vision_diagnostics" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(50)),
      visionQuery("garden vision feedback", () => supabase.from("vision_calibration_feedback" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(100)),
      visionQuery("garden vision reviewed events", () => supabase.from("ai_camera_events" as any).select("*").eq("kindergarten_id", gardenId).not("vision_provider", "is", null).in("status", ["confirmed", "dismissed", "escalated"]).order("created_at", { ascending: false }).limit(50))
    ]);
    const available = [detectionsRes, diagnosticsRes, feedbackRes, eventsRes].map((query) => query.available);
    return {
      detections: detectionsRes.rows,
      diagnostics: diagnosticsRes.rows,
      feedback: feedbackRes.rows,
      reviewedEvents: eventsRes.rows,
      summary: buildVisionDiagnosticsSummary(diagnosticsRes.rows, detectionsRes.rows, feedbackRes.rows),
      available,
      queryError: available.every(Boolean) ? null : "חלק מנתוני הזיהוי החזותי לא נטענו"
    };
  }, unavailable);

  const [detectionsAvailable, , feedbackAvailable, eventsAvailable] = result.data.available;
  const reviewed = result.data.reviewedEvents.map((event: any) => buildReviewedManagerDetection(event));

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="זיהוי חזותי" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="זיהוי חזותי בטוח" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle
        icon={Brain}
        title="זיהוי חזותי"
        subtitle="רק תוצאות שעברו בדיקת אדם. בלי זיהוי פנים, בלי ניקוד צוות ובלי מסקנות אוטומטיות."
        action={<Link className="teacher-soft-button purple" href="/dashboard/garden/ai-events">אירועים לבדיקה</Link>}
      />
      <AdminDataError message={result.error ?? result.data.queryError} />

      <TeacherStatsGrid>
        <TeacherStatCard title="זיהויים" value={detectionsAvailable ? result.data.summary.detectionVolume : "לא זמין"} hint="מסוכמים" icon={Brain} tone={detectionsAvailable ? "blue" : "neutral"} />
        <TeacherStatCard title="דיוק ממוצע" value={detectionsAvailable ? percent(result.data.summary.averageConfidence) : "לא זמין"} hint="לא החלטה אוטומטית" icon={ShieldCheck} tone={detectionsAvailable ? "green" : "neutral"} />
        <TeacherStatCard title="False positive" value={feedbackAvailable ? percent(result.data.summary.falsePositiveRate) : "לא זמין"} hint="למעקב אנושי" icon={ShieldCheck} tone={feedbackAvailable ? result.data.summary.falsePositiveRate > 0.2 ? "orange" : "green" : "neutral"} />
        <TeacherStatCard title="נבדקו" value={eventsAvailable ? reviewed.length : "לא זמין"} hint="אירועים" icon={ShieldCheck} tone={eventsAvailable ? "purple" : "neutral"} />
      </TeacherStatsGrid>

      <section className="teacher-dashboard-grid">
        <TeacherSection title="מה מוצג למנהלת" subtitle="מידע מסוכם בלבד, ללא פריימים גולמיים או פרטי מודל פנימיים">
          <TeacherCompactList>
            <TeacherCompactItem title="זיהויים שנבדקו" subtitle="עברו סינון אנושי לפני הצגה" tone={eventsAvailable ? "green" : "neutral"} meta={eventsAvailable ? reviewed.length : "לא זמין"} />
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
        {!eventsAvailable ? <TeacherEmptyState title="נתוני הזיהויים שנבדקו אינם זמינים" text="לא ניתן לקבוע אם יש זיהויים שעברו בדיקה אנושית." /> : reviewed.length === 0 ? (
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
