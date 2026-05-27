import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const garden = profile.garden_id ? await supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, phone, public_description, ages, public_profile_enabled").eq("id", profile.garden_id).maybeSingle() : { data: null };
  return <DashboardShell role="parent" title="הגדרות הורה"><div className="dashboard-hero-card"><div><p className="eyebrow">Settings</p><h1>שלום, {profile.full_name}</h1><p>הורה · עדכון פרטים, תמונת פרופיל, התראות ואבטחה.</p></div><span className="pill good">פרופיל אישי</span></div><ProfileSettingsForm profile={profile} garden={garden.data} roleLabel="הורה" includeGarden={false} /></DashboardShell>;
}
