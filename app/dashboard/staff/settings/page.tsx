import { BadgeCheck } from "lucide-react";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { ProgressStepper, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const garden = profile.garden_id ? await supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, phone, public_description, ages, public_profile_enabled").eq("id", profile.garden_id).maybeSingle() : { data: null };
  return (
    <StaffAppFrame active="profile" avatarUrl={profile.profile_image_url}>
      <StaffPageHero
        eyebrow="השלמת פרטי צוות"
        title={`שלום, ${profile.full_name}`}
        text={`${(garden.data as any)?.name ? `גן ${(garden.data as any).name} · ` : ""}משלימים פרטים אישיים, תמונה, טלפון, איש קשר לחירום ומסמכים.`}
        icon={BadgeCheck}
        badge={<StatusChip tone="success">מסע צוות</StatusChip>}
      />
      <StaffSection title="שלבי השלמה">
        <ProgressStepper
          current={1}
          steps={[
            { label: "תמונת פרופיל", description: "זיהוי ברור בצוות" },
            { label: "טלפון וחירום", description: "פרטי קשר" },
            { label: "מסמכים ותעודות", description: "אישורי חובה" },
            { label: "אישורי מדיניות", description: "השלמת הצטרפות" }
          ]}
        />
      </StaffSection>
      <StaffSection title="פרטים אישיים">
        <ProfileSettingsForm profile={profile} garden={garden.data} roleLabel="צוות גן" includeGarden={false} requireProfilePhoto />
      </StaffSection>
    </StaffAppFrame>
  );
}
