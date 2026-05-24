import { MessageCircleHeart } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { InternalMessagingCenter } from "@/components/internal-messaging-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentMessagesPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [gardenRes, childrenRes, messagesRes] = await Promise.all([
    supabase.from("gardens" as any).select("manager:manager_id(id, full_name, email, role, profile_image_url), owner:owner_profile_id(id, full_name, email, role, profile_image_url), inspector:inspector_id(id, full_name, email, role, profile_image_url)").eq("id", gardenId).maybeSingle(),
    supabase.from("parents" as any).select("children(id, full_name)").eq("profile_id", profile.id),
    supabase.from("messages" as any).select("*, sender:sender_id(full_name, profile_image_url), recipient:recipient_id(full_name, profile_image_url)").eq("garden_id", gardenId).or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80)
  ]);
  const garden = gardenRes.data as any;
  const recipients = [garden?.manager, garden?.owner, garden?.inspector].filter(Boolean);
  const linkedChildren = (childrenRes.data ?? []).flatMap((row: any) => row.children ?? []);
  return (
    <DashboardShell role="parent" title="פנייה לגן">
      <div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">Parent Messaging</p><h1>פנייה מתועדת לגן או לפקח.</h1><p>שאלות, עדכונים ובקשות נשמרות עם סטטוס קריאה וטיפול.</p></div><span className="pill good"><MessageCircleHeart size={15} /> ערוץ מאובטח</span></div>
      <InternalMessagingCenter gardenId={gardenId} recipients={recipients} linkedChildren={linkedChildren} messages={(messagesRes.data ?? []) as any[]} />
    </DashboardShell>
  );
}
