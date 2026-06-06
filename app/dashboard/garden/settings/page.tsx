import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const garden = profile.garden_id ? await supabase.from("gardens" as any).select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, ages, public_profile_enabled, approval_flow_status, final_approval_status, admin_correction_note").eq("id", profile.garden_id).maybeSingle() : { data: null };
  const needsCorrection = garden.data?.approval_flow_status === "correction_required";
  return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="פרופיל הגן"><div className="dashboard-hero-card"><div><p className="eyebrow">{needsCorrection ? "תיקונים לאישור" : "פרופיל גן"}</p><h1>{needsCorrection ? "מתקנים ושולחים שוב." : "מכינים את הגן לאישור סופי."}</h1><p>{needsCorrection ? garden.data?.admin_correction_note ?? "האדמין ביקש השלמה לפני אישור." : "עדכנו פרטים קצרים, לוגו ופרטי קשר. בסיום שולחים לאישור."}</p></div><span className={needsCorrection ? "pill warn" : "pill good"}>{garden.data?.final_approval_status ?? "טיוטה"}</span></div><ProfileSettingsForm profile={profile} garden={garden.data} roleLabel={profile.role === "owner" ? "בעלים" : "מנהלת גן"} includeGarden={true} requireProfilePhoto requireGardenLogo /></DashboardShell>;
}
