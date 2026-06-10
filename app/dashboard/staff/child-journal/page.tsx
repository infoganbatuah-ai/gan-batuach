import { BookOpenCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ChildDailyJournalManager } from "@/components/child-daily-journal-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffChildJournalPage({ searchParams }: { searchParams?: Promise<{ childId?: string; incident?: string }> }) {
  const params: { childId?: string; incident?: string } = searchParams ? await searchParams.catch(() => ({})) : {};
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [childrenRes, journalsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, allergies, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("child_daily_journals" as any).select("*").eq("garden_id", gardenId).eq("journal_date", today)
  ]);
  return (
    <DashboardShell role="staff" title="יומן ילד">
      <div className="parent-page-head staff-page-head"><div><p className="eyebrow">עדכון ילד מהיר</p><h1>ארוחה, שינה, שירותים, מצב רוח.</h1><p>בחרו ילד ועדכנו את מה שקרה עכשיו. קצר, ברור ומתאים לטלפון.</p></div><span className="pill good"><BookOpenCheck size={15} /> נשמר ליומן</span></div>
      <ChildDailyJournalManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} journals={(journalsRes.data ?? []) as any[]} initialChildId={params?.childId ?? ""} incidentMode={params?.incident === "1"} />
    </DashboardShell>
  );
}
