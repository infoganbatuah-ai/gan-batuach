import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
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
    <DashboardShell role="parent" title="איסוף הילד">
      <div className="dashboard-hero-card parent-hero-card">
        <div>
          <p className="eyebrow">Pickup Verification</p>
          <h1>מורשי איסוף והרשאות זמניות.</h1>
          <p>הוסיפו מורשי איסוף, צרו הרשאה זמנית וצפו בהיסטוריית איסופים. הגן תמיד מבצע בדיקה אנושית לפני שחרור ילד.</p>
        </div>
        <span className="pill good"><ShieldCheck size={15} /> בדיקה אנושית בלבד</span>
      </div>
      <ParentPickupCenter children={family.children as any[]} contacts={(contactsRes.data ?? []) as any[]} events={(eventsRes.data ?? []) as any[]} />
    </DashboardShell>
  );
}
