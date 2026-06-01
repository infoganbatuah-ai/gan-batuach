import { BadgeCheck, FileCheck2, Image, Phone, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const garden = profile.garden_id ? await supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, phone, public_description, ages, public_profile_enabled").eq("id", profile.garden_id).maybeSingle() : { data: null };
  return <DashboardShell role="staff" title="הגדרות צוות"><div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">השלמת פרטי צוות</p><h1>שלום, {profile.full_name}</h1><p>{(garden.data as any)?.name ? `גן ${(garden.data as any).name} · ` : ""}משלימים פרטים אישיים, תמונה, טלפון, איש קשר לחירום ומסמכים כדי להתחיל לעבוד בדשבורד הצוות.</p></div><span className="pill good"><BadgeCheck size={15} /> מסע צוות</span></div><section className="journey-steps staff-completion-steps"><span><b>1</b><Image size={16} /> תמונת פרופיל</span><span><b>2</b><Phone size={16} /> טלפון וחירום</span><span><b>3</b><FileCheck2 size={16} /> מסמכים ותעודות</span><span><b>4</b><ShieldCheck size={16} /> אישורי מדיניות</span></section><ProfileSettingsForm profile={profile} garden={garden.data} roleLabel="צוות גן" includeGarden={false} /></DashboardShell>;
}
