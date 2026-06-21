import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
import { ParentAppFrame, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ParentNotificationPreferences } from "@/components/parent-notification-preferences";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function categoryLabel(item: any) {
  const text = `${item.title ?? ""} ${item.message ?? item.body ?? ""} ${item.entity_type ?? ""}`.toLowerCase();
  if (text.includes("document") || text.includes("מסמך")) return "מסמכים";
  if (text.includes("payment") || text.includes("תשלום")) return "תשלומים";
  if (text.includes("safety") || text.includes("בטיחות") || text.includes("תצפיתן")) return "בטיחות";
  if (text.includes("message") || text.includes("הודעה")) return "הודעות";
  if (text.includes("child") || text.includes("ילד") || text.includes("יומן")) return "עדכוני ילד";
  return "כללי";
}

export default async function ParentNotificationsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const [{ data }, preferencesRes, pushPreferencesRes] = await Promise.all([
    supabase.from("notifications" as any).select("*").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80),
    supabase.from("communication_preferences" as any).select("*").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("push_category_preferences" as any).select("category, enabled").eq("profile_id", profile.id).in("category", ["important", "safety", "attendance", "message", "document", "payment", "pickup"])
  ]);
  const rows = (data ?? []) as any[];
  const categories = ["עדכוני ילד", "הודעות", "מסמכים", "תשלומים", "בטיחות", "כללי"].map((label) => ({ label, count: rows.filter((item) => categoryLabel(item) === label).length }));
  const pushCategoryPreferences = Object.fromEntries((pushPreferencesRes.data ?? []).map((row: any) => [row.category, row.enabled]));
  return (
    <DashboardShell role="parent" title="התראות" appHome>
      <ParentAppFrame active="alerts" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="מרכז עדכונים" subtitle="מה צריך את תשומת הלב שלך היום?" />
        <section className="parent-notification-categories">{categories.map((category) => <span key={category.label}>{category.label}<b>{category.count}</b></span>)}</section>
        <ParentSection title="העדפות התראות" subtitle="בחירה אילו עדכונים לקבל ובאיזה ערוץ.">
          <ParentNotificationPreferences preferences={preferencesRes.data as any} pushCategoryPreferences={pushCategoryPreferences} />
        </ParentSection>
        <ParentSection title="התראות אחרונות" subtitle="אירועים רגישים מוצגים רק אחרי בדיקה ואישור.">
          <NotificationCenter notifications={rows} />
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
