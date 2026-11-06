import { Bell, BookOpenCheck, Moon, Utensils, UsersRound } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { ChildDailyJournalManager } from "@/components/child-daily-journal-manager";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import {
  TeacherAppFrame,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherActionTile,
  TeacherEmptyState,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type JournalChild = { id: string };
type ChildJournal = { child_id: string; meals?: unknown; sleep_summary?: unknown };
type ManagerProps = Parameters<typeof ChildDailyJournalManager>[0];
async function childJournalQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenChildJournalPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const avatarUrl = (profile as any).profile_image_url ?? null;
  if (!profile.garden_id) {
    return <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="יומן יומי לילדים" avatarUrl={avatarUrl} active="calendar"><AdminDataError message="לא ניתן לטעון יומן ילדים ללא שיוך לגן" /></TeacherAppFrame>;
  }
  const gardenId = profile.garden_id ?? "";
  const today = israelTodayDateKey();
  const result = await safeAdminData("garden child journal", async () => {
    const supabase = await createClient();
    const [childrenRes, journalsRes] = await Promise.all([
      childJournalQuery("garden child journal children", () => supabase.from("children" as any).select("id, full_name, photo_url, allergies, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name")),
      childJournalQuery("garden child journal entries", () => supabase.from("child_daily_journals" as any).select("*").eq("garden_id", gardenId).eq("journal_date", today))
    ]);
    const available = [!childrenRes.error, !journalsRes.error];
    return { allChildren: (childrenRes.data ?? []) as JournalChild[], journals: (journalsRes.data ?? []) as ChildJournal[], available, queryError: available.some((value) => !value) ? "חלק מנתוני יומן הילדים לא נטענו" : null };
  }, { allChildren: [] as JournalChild[], journals: [] as ChildJournal[], available: [false, false], queryError: null as string | null });

  const { allChildren, journals, available } = result.data;
  const bothAvailable = available[0] && available[1];
  const filteredAvailable = available[0] && (!(params.missing === "meal" || params.missing === "sleep") || available[1]);
  const journalByChild = new Map(journals.map((journal) => [journal.child_id, journal]));
  const children = filteredAvailable ? allChildren.filter((child) => {
    const journal = journalByChild.get(child.id);
    if (params.missing === "meal") return !(Array.isArray(journal?.meals) && journal.meals.length > 0);
    if (params.missing === "sleep") return !journal?.sleep_summary;
    return true;
  }) : [];
  const label = params.missing === "meal" ? "ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "ילדים ללא עדכון שינה" : null;
  const missingMeal = bothAvailable ? allChildren.filter((child) => {
    const journal = journalByChild.get(child.id);
    return !(Array.isArray(journal?.meals) && journal.meals.length > 0);
  }).length : null;
  const missingSleep = bothAvailable ? allChildren.filter((child) => {
    const journal = journalByChild.get(child.id);
    return !journal?.sleep_summary;
  }).length : null;
  return (
    <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="יומן יומי לילדים" avatarUrl={avatarUrl} active="calendar">
      <TeacherPageTitle icon={BookOpenCheck} title="יומן ילד יומי" subtitle="ארוחות, שינה, מצב רוח, תרופות ועדכונים להורים" />
      <AdminDataError message={result.error ?? result.data.queryError} />
      <TeacherStatsGrid>
        <TeacherStatCard title="ילדים" value={filteredAvailable ? children.length : "לא זמין"} hint="לפי הסינון" icon={UsersRound} tone={filteredAvailable ? "blue" : "neutral"} />
        <TeacherStatCard title="ללא ארוחה" value={missingMeal ?? "לא זמין"} hint="דורש עדכון" icon={Utensils} tone={missingMeal === null ? "neutral" : missingMeal ? "orange" : "green"} />
        <TeacherStatCard title="ללא שינה" value={missingSleep ?? "לא זמין"} hint="דורש עדכון" icon={Moon} tone={missingSleep === null ? "neutral" : missingSleep ? "purple" : "green"} />
      </TeacherStatsGrid>
      <TeacherQuickActions title="פעולות יומן">
        <TeacherActionTile title="ללא ארוחה" href="/dashboard/garden/child-journal?missing=meal" icon={Utensils} tone="orange" />
        <TeacherActionTile title="ללא שינה" href="/dashboard/garden/child-journal?missing=sleep" icon={Moon} tone="purple" />
        <TeacherActionTile title="הודעה להורים" href="/dashboard/garden/messages?compose=1#message-workbench" icon={Bell} tone="blue" />
      </TeacherQuickActions>
      {filteredAvailable ? <DashboardFilterChip label={label} clearHref="/dashboard/garden/child-journal" isEmpty={children.length === 0} emptyTitle={params.missing === "meal" ? "אין כרגע ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "אין כרגע ילדים ללא עדכון שינה" : undefined} emptyText="כל הילדים במסנן הזה כבר קיבלו עדכון. אפשר לנקות סינון כדי לראות את כולם." /> : <TeacherEmptyState title="נתוני הסינון לא זמינים" text="לא ניתן להסיק אילו עדכונים חסרים לפני טעינת הנתונים." />}
      <TeacherSection title="עדכון יומי" subtitle="טופס מלא לכל ילד, עם שמירה למערכת הקיימת">
        <div className="teacher-embedded-module">
          {bothAvailable ? <ChildDailyJournalManager gardenId={gardenId} children={children as ManagerProps["children"]} journals={journals as ManagerProps["journals"]} /> : <TeacherEmptyState title="יומן הילדים לא זמין" text="נדרשים נתוני ילדים ויומנים מלאים לפני ניהול ועדכון." />}
        </div>
      </TeacherSection>
    </TeacherAppFrame>
  );
}
