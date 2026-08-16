import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const garden = profile.garden_id ? await supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, phone, public_description, ages, public_profile_enabled").eq("id", profile.garden_id).maybeSingle() : { data: null };
  return (
    <DashboardShell role="parent" title="הגדרות הורה" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title={`שלום, ${profile.full_name ?? "הורה"}`} subtitle="עדכון פרטים, תמונת פרופיל, התראות ואבטחה" />
        <ParentSection title="פרופיל אישי" subtitle="המידע האישי שלך נשאר מחובר לחשבון ההורה.">
          <ProfileSettingsForm profile={profile} garden={garden.data} roleLabel="הורה" includeGarden={false} />
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
