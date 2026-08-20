import { CheckCircle2, FileText, Image as ImageIcon, Settings, Store } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function SettingsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const garden = profile.garden_id ? await supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, ages, public_profile_enabled, approval_flow_status, final_approval_status, admin_correction_note").eq("id", profile.garden_id).maybeSingle() : { data: null };
  const needsCorrection = garden.data?.approval_flow_status === "correction_required";
  const gardenData = garden.data as any;
  const hasLogo = Boolean(gardenData?.logo_url || gardenData?.image_url);
  const hasContact = Boolean(gardenData?.phone && gardenData?.email);
  const isPublic = Boolean(gardenData?.public_profile_enabled);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="פרופיל הגן" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle={gardenData?.name ?? "פרופיל הגן"} avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={Settings} title="פרופיל והגדרות הגן" subtitle={needsCorrection ? gardenData?.admin_correction_note ?? "נדרשת השלמת מידע בפרופיל הגן." : "עדכון פרטי גן, תמונות, קשר ופרסום להורים"} action={<a className="button primary" href="#profile-settings">עריכה מלאה</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="מצב הגן" value={gardenData?.approval_flow_status === "active" ? "פעיל" : gardenData?.approval_flow_status ?? "טיוטה"} hint={needsCorrection ? "נדרש תיקון" : "הקמה ופרסום"} icon={CheckCircle2} tone={needsCorrection ? "orange" : "green"} />
          <TeacherStatCard title="פרופיל ציבורי" value={isPublic ? "פעיל" : "כבוי"} hint="רשימת גנים" icon={Store} tone={isPublic ? "green" : "blue"} />
          <TeacherStatCard title="תמונה/לוגו" value={hasLogo ? "קיים" : "חסר"} hint="מיתוג" icon={ImageIcon} tone={hasLogo ? "green" : "orange"} />
          <TeacherStatCard title="פרטי קשר" value={hasContact ? "מלא" : "חסר"} hint="טלפון ואימייל" icon={FileText} tone={hasContact ? "green" : "orange"} />
        </TeacherStatsGrid>

        <TeacherSection title="מה חסר עכשיו">
          <TeacherCompactList>
            <TeacherCompactItem title="שם הגן" subtitle={gardenData?.name ?? "עדיין לא הוגדר"} tone={gardenData?.name ? "green" : "orange"} meta={gardenData?.name ? "מוכן" : "חסר"} />
            <TeacherCompactItem title="כתובת וטלפון" subtitle={`${gardenData?.address ?? "כתובת חסרה"} · ${gardenData?.phone ?? "טלפון חסר"}`} tone={hasContact ? "green" : "orange"} meta={hasContact ? "מוכן" : "להשלמה"} />
            <TeacherCompactItem title="תיאור ציבורי" subtitle={gardenData?.public_description ?? "תיאור קצר להורים עדיין חסר"} tone={gardenData?.public_description ? "green" : "purple"} meta="ציבורי" />
          </TeacherCompactList>
        </TeacherSection>

        <TeacherAiInsight metric={needsCorrection ? "לתקן" : "מוכן"}>
          פרטי הגן משפיעים על הרשימה הציבורית ועל בקשות הצטרפות. פרטים פנימיים נשארים פרטיים ולא מוצגים לציבור ללא הגדרה מתאימה.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות פרופיל">
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={FileText} tone="purple" />
          <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={Store} tone="blue" />
          <TeacherActionTile title="דוחות" href="/dashboard/garden/reports" icon={CheckCircle2} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="profile-settings" open={needsCorrection}>
          <summary>עריכה מלאה של פרופיל הגן</summary>
          <div className="teacher-embedded-module">
            <ProfileSettingsForm profile={profile} garden={garden.data} roleLabel={profile.role === "owner" ? "בעלים" : "מנהלת גן"} includeGarden={true} requireProfilePhoto requireGardenLogo />
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
