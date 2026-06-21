import { CalendarDays } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentListRow, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentSchedulePage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const { data } = family.gardenIds.length
    ? await supabase.from("schedule_items" as any).select("id, title, description, starts_at, ends_at, visible_to_parents, created_at").in("garden_id", family.gardenIds).eq("visible_to_parents", true).order("starts_at", { ascending: true }).limit(80)
    : { data: [] };
  const rows = (data ?? []) as any[];
  return (
    <DashboardShell role="parent" title="לו״ז ותפריט" appHome>
      <ParentAppFrame active="calendar" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="היום של הילד" subtitle="סדר יום, אוכל, פעילויות ואירועים שהגן פרסם" />
        <ParentSection title="לו״ז, תפריט ופעילויות" subtitle="מה שהגן פרסם להורים מופיע כאן בצורה פשוטה וברורה.">
          {rows.length === 0 ? <ParentEmptyState title="אין לו״ז מפורסם כרגע" text="כאשר הגן יפרסם פעילות, תפריט או אירוע להורים, הם יופיעו כאן." /> : rows.map((item) => (
            <ParentListRow
              key={item.id}
              title={item.title ?? "פעילות"}
              subtitle={item.description ?? "פעילות / תפריט / אירוע"}
              time={item.starts_at ? new Date(item.starts_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : undefined}
              icon={CalendarDays}
              tone="purple"
            />
          ))}
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
