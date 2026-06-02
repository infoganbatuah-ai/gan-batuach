import { BookOpenCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ChildDailyJournalManager } from "@/components/child-daily-journal-manager";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenChildJournalPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [childrenRes, journalsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, allergies, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("child_daily_journals" as any).select("*").eq("garden_id", gardenId).eq("journal_date", today)
  ]);

  const journals = (journalsRes.data ?? []) as any[];
  const journalByChild = new Map(journals.map((journal) => [journal.child_id, journal]));
  const children = ((childrenRes.data ?? []) as any[]).filter((child) => {
    const journal = journalByChild.get(child.id) as any;
    if (params.missing === "meal") return !(Array.isArray(journal?.meals) && journal.meals.length > 0);
    if (params.missing === "sleep") return !journal?.sleep_summary;
    return true;
  });
  const label = params.missing === "meal" ? "ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "ילדים ללא עדכון שינה" : null;
  return (
    <DashboardShell role="manager" title="יומן ילד יומי">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Child Daily Journal</p><h1>עדכון יומי אישי לכל ילד.</h1><p>ארוחות, שינה, מצב רוח, שירותים, תרופות, אירועים, תמונות וחתימת צוות להורים.</p></div><span className="pill good"><BookOpenCheck size={15} /> הורים מקבלים התראה</span></div>
      <DashboardFilterChip label={label} clearHref="/dashboard/garden/child-journal" isEmpty={children.length === 0} emptyTitle={params.missing === "meal" ? "אין כרגע ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "אין כרגע ילדים ללא עדכון שינה" : undefined} emptyText="כל הילדים במסנן הזה כבר קיבלו עדכון. אפשר לנקות סינון כדי לראות את כולם." />
      <ChildDailyJournalManager gardenId={gardenId} children={children} journals={journals} />
    </DashboardShell>
  );
}
