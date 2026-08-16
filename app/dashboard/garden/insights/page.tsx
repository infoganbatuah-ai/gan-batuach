import { AlertTriangle, Bot, CheckCircle2, ClipboardCheck } from "lucide-react";
import { SmartInsightsCenter } from "@/components/smart-insights-center";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import {
  createNotificationsForUrgentInsights,
  generateSmartInsights,
  syncSmartInsights
} from "@/lib/domain/smart-kindergarten-engine";
import { createClient } from "@/lib/supabase/server";

export default async function GardenInsightsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const generated = await generateSmartInsights(supabase as any, profile);
  const insights = await syncSmartInsights(supabase as any, generated);
  await createNotificationsForUrgentInsights(supabase as any, insights);

  const urgent = insights.filter((item) => item.severity === "urgent" || item.severity === "critical").length;
  const warnings = insights.filter((item) => item.severity === "warning").length;

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="תובנות חכמות לגן" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
      <TeacherPageTitle icon={Bot} title="תובנות חכמות" subtitle="מה דורש פעולה מתוך נוכחות, יומן, מסמכים, אירועים ופיקוח" />
      <TeacherStatsGrid>
        <TeacherStatCard title="דחוף" value={urgent} hint="לטיפול מיידי" icon={AlertTriangle} tone={urgent ? "red" : "green"} />
        <TeacherStatCard title="פתוחות" value={insights.filter((item) => item.status === "open").length} hint="ממתינות" icon={ClipboardCheck} tone="purple" />
        <TeacherStatCard title="טופלו" value={insights.filter((item) => item.status === "handled").length} hint="נסגרו" icon={CheckCircle2} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות תובנות">
        <TeacherActionTile title="משימות" href="/dashboard/garden/tasks" icon={ClipboardCheck} tone="purple" />
        <TeacherActionTile title="סיכוני בטיחות" href="/dashboard/garden/risk" icon={AlertTriangle} tone="orange" />
        <TeacherActionTile title="דוחות" href="/dashboard/garden/reports" icon={Bot} tone="blue" />
      </TeacherQuickActions>
      <TeacherSection title="מרכז תובנות" subtitle="פעולות מוצעות בלבד, לא החלטות אוטומטיות">
        <div className="teacher-embedded-module">
          <SmartInsightsCenter insights={insights} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
