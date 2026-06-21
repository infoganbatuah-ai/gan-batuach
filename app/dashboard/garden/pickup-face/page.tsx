import { ScanFace, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { FaceMatchReviewPanel } from "@/components/face-match-review-panel";
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
import { createClient } from "@/lib/supabase/server";

export default async function GardenPickupFacePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [contacts, results] = await Promise.all([
    supabase.from("authorized_pickup_contacts" as any).select("id, full_name, relation, child_id, children(full_name)").eq("kindergarten_id", gardenId).eq("active", true).order("full_name").limit(300),
    supabase.from("face_match_results" as any).select("*, authorized_pickup_contacts(full_name, relation), children(full_name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(120)
  ]);
  const contactRows = (contacts.data ?? []) as any[];
  const resultRows = (results.data ?? []) as any[];

  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "רונית"}`} subtitle="בדיקת איסוף מבוקרת" avatarUrl={(profile as any).avatar_url ?? null} active="children">
      <TeacherPageTitle icon={ScanFace} title="בדיקת התאמה באיסוף" subtitle="תשתית בדיקה בלבד. אין החלטה ביומטרית ואין שחרור אוטומטי" />
      <TeacherStatsGrid>
        <TeacherStatCard title="מורשי איסוף" value={contactRows.length} hint="פעילים" icon={UsersRound} tone="blue" />
        <TeacherStatCard title="בדיקות" value={resultRows.length} hint="לסקירה" icon={ScanFace} tone="purple" />
        <TeacherStatCard title="אישור אנושי" value="חובה" hint="לפני כל פעולה" icon={ShieldCheck} tone="green" />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות איסוף">
        <TeacherActionTile title="ניהול איסוף" href="/dashboard/garden/pickup" icon={UserCheck} tone="blue" />
        <TeacherActionTile title="ילדים" href="/dashboard/garden/children" icon={UsersRound} tone="purple" />
        <TeacherActionTile title="בטיחות" href="/dashboard/garden/risk" icon={ShieldCheck} tone="green" />
      </TeacherQuickActions>
      <TeacherSection title="בדיקות התאמה" subtitle="כל תוצאה נשארת למסך מנהלת בלבד">
        <div className="teacher-embedded-module">
          <FaceMatchReviewPanel contacts={contactRows} results={resultRows} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
