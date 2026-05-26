import { MessageSquareText } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { InternalMessagingCenter } from "@/components/internal-messaging-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenMessagesPage({ searchParams }: { searchParams: Promise<{ childId?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const { childId } = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [parentsRes, staffRes, inspectorsRes, childrenRes, messagesRes] = await Promise.all([
    supabase.from("parents" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId),
    supabase.from("staff" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId),
    supabase.from("profiles" as any).select("id, full_name, email, role, profile_image_url").in("role", ["admin", "inspector"]).limit(50),
    supabase.from("children" as any).select("id, full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("garden_id", gardenId).order("full_name"),
    supabase.from("messages" as any).select("*, sender:sender_id(full_name, profile_image_url), recipient:recipient_id(full_name, profile_image_url)").eq("garden_id", gardenId).or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80)
  ]);
  const recipients = [...(parentsRes.data ?? []).map((row: any) => row.profiles).filter(Boolean), ...(staffRes.data ?? []).map((row: any) => row.profiles).filter(Boolean), ...(inspectorsRes.data ?? [])];
  const preselectedChild = ((childrenRes.data ?? []) as any[]).find((child) => child.id === childId);
  const preselectedRecipientId = preselectedChild?.parents?.profile_id;
  return (
    <DashboardShell role="manager" title="הודעות">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Internal Messaging</p><h1>תקשורת מתועדת מול הורים, צוות, פקחים ואדמין.</h1><p>סטטוס קריאה, נושא, שיוך לגן ושיוך לילד במידת הצורך.</p></div><span className="pill good"><MessageSquareText size={15} /> הודעות חיות</span></div>
      <InternalMessagingCenter gardenId={gardenId} recipients={recipients} linkedChildren={(childrenRes.data ?? []) as any[]} messages={(messagesRes.data ?? []) as any[]} preselectedChildId={childId} preselectedRecipientId={preselectedRecipientId} />
    </DashboardShell>
  );
}
