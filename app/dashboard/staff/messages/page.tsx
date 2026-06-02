import { DashboardShell } from "@/components/dashboard-shell";
import { InternalMessagingCenter } from "@/components/internal-messaging-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffMessagesPage({ searchParams }: { searchParams?: Promise<{ childId?: string }> }) {
  const params: { childId?: string } = searchParams ? await searchParams.catch(() => ({})) : {};
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [gardenRes, messagesRes, childrenRes] = await Promise.all([
    supabase.from("gardens" as any).select("manager:manager_id(id, full_name, email, role, profile_image_url), owner:owner_profile_id(id, full_name, email, role, profile_image_url), inspector:inspector_id(id, full_name, email, role, profile_image_url)").eq("id", gardenId).maybeSingle(),
    supabase.from("messages" as any).select("*, sender:sender_id(full_name, profile_image_url), recipient:recipient_id(full_name, profile_image_url)").eq("garden_id", gardenId).or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80),
    supabase.from("children" as any).select("id, full_name").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name")
  ]);
  const garden = gardenRes.data as any;
  const recipients = [garden?.manager, garden?.owner, garden?.inspector].filter(Boolean);
  return <DashboardShell role="staff" title="הודעות צוות"><div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">Staff Messaging</p><h1>תקשורת פנימית מתועדת.</h1><p>צוות יכול לפנות למנהלת, בעלים או פקח לפי הרשאה.</p></div><span className="pill good">מתועד</span></div><InternalMessagingCenter gardenId={gardenId} recipients={recipients} messages={(messagesRes.data ?? []) as any[]} linkedChildren={(childrenRes.data ?? []) as any[]} preselectedChildId={params?.childId} /></DashboardShell>;
}
