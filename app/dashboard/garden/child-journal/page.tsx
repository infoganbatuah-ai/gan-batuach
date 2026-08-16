import { Bell, BookOpenCheck, Moon, Utensils, UsersRound } from "lucide-react";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { ChildDailyJournalManager } from "@/components/child-daily-journal-manager";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenChildJournalPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = israelTodayDateKey();
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
  const allChildren = (childrenRes.data ?? []) as any[];
  const missingMeal = allChildren.filter((child: any) => {
    const journal = journalByChild.get(child.id) as any;
    return !(Array.isArray(journal?.meals) && journal.meals.length > 0);
  }).length;
  const missingSleep = allChildren.filter((child: any) => {
    const journal = journalByChild.get(child.id) as any;
    return !journal?.sleep_summary;
  }).length;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="יומן יומי לילדים" avatarUrl={(profile as any).profile_image_url ?? null} active="calendar">
      <TeacherPageTitle icon={BookOpenCheck} title="יומן ילד יומי" subtitle="ארוחות, שינה, מצב רוח, תרופות ועדכונים להורים" />
      <TeacherStatsGrid>
        <TeacherStatCard title="ילדים" value={children.length} hint="לפי הסינון" icon={UsersRound} tone="blue" />
        <TeacherStatCard title="ללא ארוחה" value={missingMeal} hint="דורש עדכון" icon={Utensils} tone={missingMeal ? "orange" : "green"} />
        <TeacherStatCard title="ללא שינה" value={missingSleep} hint="דורש עדכון" icon={Moon} tone={missingSleep ? "purple" : "green"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות יומן">
        <TeacherActionTile title="ללא ארוחה" href="/dashboard/garden/child-journal?missing=meal" icon={Utensils} tone="orange" />
        <TeacherActionTile title="ללא שינה" href="/dashboard/garden/child-journal?missing=sleep" icon={Moon} tone="purple" />
        <TeacherActionTile title="הודעה להורים" href="/dashboard/garden/messages?compose=1#message-workbench" icon={Bell} tone="blue" />
      </TeacherQuickActions>
      <DashboardFilterChip label={label} clearHref="/dashboard/garden/child-journal" isEmpty={children.length === 0} emptyTitle={params.missing === "meal" ? "אין כרגע ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "אין כרגע ילדים ללא עדכון שינה" : undefined} emptyText="כל הילדים במסנן הזה כבר קיבלו עדכון. אפשר לנקות סינון כדי לראות את כולם." />
      <TeacherSection title="עדכון יומי" subtitle="טופס מלא לכל ילד, עם שמירה למערכת הקיימת">
        <div className="teacher-embedded-module">
          <ChildDailyJournalManager gardenId={gardenId} children={children} journals={journals} />
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
