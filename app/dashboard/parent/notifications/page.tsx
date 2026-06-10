import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
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
  const { data } = await supabase.from("notifications" as any).select("*").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80);
  const rows = (data ?? []) as any[];
  const categories = ["עדכוני ילד", "הודעות", "מסמכים", "תשלומים", "בטיחות", "כללי"].map((label) => ({ label, count: rows.filter((item) => categoryLabel(item) === label).length }));
  return (
    <DashboardShell role="parent" title="התראות">
      <div className="parent-page-head"><div><p className="eyebrow">מרכז עדכונים</p><h1>כל מה שחשוב להורה, בלי רעש.</h1><p>עדכוני ילד, הודעות, מסמכים, תשלומים ובטיחות מסודרים לפי נושא.</p></div><span className="pill good">מרכז הורים</span></div>
      <section className="parent-notification-categories">{categories.map((category) => <span key={category.label}>{category.label}<b>{category.count}</b></span>)}</section>
      <NotificationCenter notifications={rows} />
    </DashboardShell>
  );
}
