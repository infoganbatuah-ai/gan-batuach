import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ParentPickupCenter } from "@/components/pickup-verification-panels";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { parentAttendanceChildren } from "@/lib/domain/parent-attendance-children";

export default async function ParentPickupPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const children = parentAttendanceChildren(family.children, family.enrollments);
  const childIds = children.map((child) => child.id);
  const [contactsRes, eventsRes] = childIds.length
    ? await Promise.all([
      supabase.from("authorized_pickup_contacts" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("created_at", { ascending: false }).limit(301),
      supabase.from("child_pickup_events" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("pickup_time", { ascending: false }).limit(80)
    ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const sourceUnavailable = Boolean(family.sourceUnavailable || contactsRes.error || eventsRes.error || (contactsRes.data?.length ?? 0) > 300);

  return (
    <DashboardShell role="parent" title="איסוף הילד" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="איסוף הילד" subtitle="מורשי איסוף, הרשאות זמניות והיסטוריה" />
        <ParentSection title="מרכז איסוף" subtitle="הגן תמיד מבצע בדיקה אנושית לפני שחרור ילד." action={<span className="pill good"><ShieldCheck size={15} /> בדיקה אנושית בלבד</span>}>
          {sourceUnavailable
            ? <div role="alert"><ParentEmptyState title="נתוני האיסוף אינם זמינים" text="לא ניתן לאמת כעת את המורשים או היסטוריית האיסוף. לא תוצג רשימה ריקה כאילו נבדקה." /></div>
            : <ParentPickupCenter children={children} contacts={(contactsRes.data ?? []) as any[]} events={(eventsRes.data ?? []) as any[]} />}
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
