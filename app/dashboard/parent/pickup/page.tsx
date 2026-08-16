import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ParentPickupCenter } from "@/components/pickup-verification-panels";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getParentFamilyContext } from "@/lib/domain/parent-family";

export default async function ParentPickupPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const childIds = family.children.map((child: any) => child.id).filter(Boolean);
  const [contactsRes, eventsRes] = childIds.length
    ? await Promise.all([
      supabase.from("authorized_pickup_contacts" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("created_at", { ascending: false }),
      supabase.from("child_pickup_events" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("pickup_time", { ascending: false }).limit(80)
    ])
    : [{ data: [] }, { data: [] }];

  return (
    <DashboardShell role="parent" title="איסוף הילד" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="איסוף הילד" subtitle="מורשי איסוף, הרשאות זמניות והיסטוריה" />
        <ParentSection title="מרכז איסוף" subtitle="הגן תמיד מבצע בדיקה אנושית לפני שחרור ילד." action={<span className="pill good"><ShieldCheck size={15} /> בדיקה אנושית בלבד</span>}>
          <ParentPickupCenter children={family.children as any[]} contacts={(contactsRes.data ?? []) as any[]} events={(eventsRes.data ?? []) as any[]} />
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
