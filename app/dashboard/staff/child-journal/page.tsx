import { BookOpenCheck } from "lucide-react";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { ChildDailyJournalManager } from "@/components/child-daily-journal-manager";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffChildJournalPage({ searchParams }: { searchParams?: Promise<{ childId?: string; incident?: string }> }) {
  const params: { childId?: string; incident?: string } = searchParams ? await searchParams.catch(() => ({})) : {};
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = israelTodayDateKey();
  const [childrenRes, journalsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, allergies, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("child_daily_journals" as any).select("*").eq("garden_id", gardenId).eq("journal_date", today)
  ]);
  return (
    <StaffAppFrame active="home">
      <StaffPageHero eyebrow="עדכון ילד מהיר" title="ארוחה, שינה, שירותים ומצב רוח" text="בחרו ילד ועדכנו את מה שקרה עכשיו. קצר, ברור ומתאים לטלפון." icon={BookOpenCheck} badge={<StatusChip tone="success">נשמר ליומן</StatusChip>} />
      <StaffSection title="יומן ילדים">
        <ChildDailyJournalManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} journals={(journalsRes.data ?? []) as any[]} initialChildId={params?.childId ?? ""} incidentMode={params?.incident === "1"} />
      </StaffSection>
    </StaffAppFrame>
  );
}
