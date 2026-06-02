import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("id, service_cities, certification_notes, profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id).order("name")
  ]);
  const inspector = inspectorRes.data as any;
  const profileWithInspectorPhoto = { ...profile, profile_image_url: profile.profile_image_url ?? inspector?.profile_photo_url };
  return <DashboardShell role="inspector" title="הגדרות מפקח"><div className="dashboard-hero-card"><div><p className="eyebrow">Settings</p><h1>שלום, {profile.full_name}</h1><p>מפקח · עדכון פרטים, תמונת פרופיל, התראות ואבטחה.</p></div><span className="pill good">פרופיל אישי</span></div><section className="card action-panel"><div className="section-heading"><h2>שיוך פיקוח</h2><p>אזורי אחריות וגנים שמופיעים בדשבורד המפקח.</p></div><div className="risk-list"><div><span>אזורים</span><b>{Array.isArray(inspector?.service_cities) && inspector.service_cities.length ? inspector.service_cities.join(", ") : "לא הוגדרו"}</b></div><div><span>גנים משויכים</span><b>{(gardensRes.data ?? []).map((garden: any) => garden.name).join(", ") || "אין שיוך גנים"}</b></div></div></section><ProfileSettingsForm profile={profileWithInspectorPhoto} garden={null} roleLabel="מפקח" includeGarden={false} requireProfilePhoto /></DashboardShell>;
}
