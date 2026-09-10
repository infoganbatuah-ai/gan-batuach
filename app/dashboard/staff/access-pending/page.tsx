import { ShieldAlert } from "lucide-react";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffAccessPendingPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staff = await supabase.from("staff" as never)
    .select("id, onboarding_status, approved_to_work")
    .eq("profile_id", profile.id)
    .maybeSingle() as unknown as { data: { onboarding_status: string | null; approved_to_work: boolean | null } | null };

  return (
    <StaffAppFrame mode="candidate" active="profile" profileName={profile.full_name} avatarUrl={profile.profile_image_url}>
      <StaffPageHero
        eyebrow="הפעלת גישת צוות"
        title="השיוך התפעולי עדיין לא הושלם"
        text="הפרופיל קיים, אך עדיין אין במערכת העסקה פעילה שמאשרת גישה לנתוני הגן. מנהלת הגן צריכה להשלים או לתקן את השיוך."
        icon={ShieldAlert}
        badge={<StatusChip tone="warning">גישה חסומה</StatusChip>}
      />
      <StaffSection title="מצב החשבון">
        <section className="card onboarding-waiting-card">
          <p>סטטוס קליטה: {String(staff.data?.onboarding_status ?? "לא הושלם")}</p>
          <p>אישור עבודה: {staff.data?.approved_to_work === true ? "קיים, ממתין לשיוך" : "ממתין לאישור"}</p>
          <p>לא יוצגו ילדים, נוכחות, הודעות, מסמכי גן או מידע רפואי עד שהשיוך הפעיל יאומת.</p>
        </section>
      </StaffSection>
    </StaffAppFrame>
  );
}
