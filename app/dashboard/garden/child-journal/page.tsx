import { BookOpenCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ChildDailyJournalManager } from "@/components/child-daily-journal-manager";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenChildJournalPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [childrenRes, journalsRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, allergies, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name"),
    supabase.from("child_daily_journals" as any).select("*").eq("garden_id", gardenId).eq("journal_date", today)
  ]);

  return (
    <DashboardShell role="manager" title="יומן ילד יומי">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Child Daily Journal</p><h1>עדכון יומי אישי לכל ילד.</h1><p>ארוחות, שינה, מצב רוח, שירותים, תרופות, אירועים, תמונות וחתימת צוות להורים.</p></div><span className="pill good"><BookOpenCheck size={15} /> הורים מקבלים התראה</span></div>
      <ChildDailyJournalManager gardenId={gardenId} children={(childrenRes.data ?? []) as any[]} journals={(journalsRes.data ?? []) as any[]} />
    </DashboardShell>
  );
}
