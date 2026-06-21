import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentMetricCard, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentInspectionsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const { data } = family.gardenIds.length
    ? await supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count, status").in("garden_id", family.gardenIds).eq("status", "done").order("completed_at", { ascending: false }).limit(20)
    : { data: [] };
  const rows = (data ?? []) as any[];
  const latestScore = rows[0]?.weighted_score ?? "-";
  return (
    <DashboardShell role="parent" title="סיכום פיקוח" appHome>
      <ParentAppFrame active="more" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="דוח בטיחות ופעילות" subtitle="סיכומי ביקורת שאושרו להצגת הורים" />
        <section className="parent-metrics-grid">
          <ParentMetricCard title="דוחות" value={rows.length} hint="מאושרים" icon={ClipboardCheck} tone="purple" />
          <ParentMetricCard title="ציון אחרון" value={latestScore} hint="פיקוח" icon={ClipboardCheck} tone="green" />
        </section>
        <ParentSection title="ביקורות מאושרות" subtitle="הורים רואים רק דוחות המאושרים לגן של ילדיהם, לפי הרשאה.">
          {rows.length === 0 ? <ParentEmptyState title="אין דוחות ביקורת להצגה" text="לאחר ביקורת מאושרת, הציון והסיכום יופיעו כאן." /> : (
            <div className="parent-request-list">
              {rows.map((inspection: any) => (
                <Link href={`/dashboard/parent/inspections/${inspection.id}/report`} key={inspection.id}>
                  <strong>ציון {inspection.weighted_score ?? "-"}</strong>
                  <span>{inspection.completed_at ? new Date(inspection.completed_at).toLocaleString("he-IL") : ""} · ליקויים: {inspection.violation_count ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
