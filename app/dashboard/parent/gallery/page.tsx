import { Camera, Image as ImageIcon, SlidersHorizontal } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const childIds = Array.from(new Set([
    ...(family.children as any[]).map((child) => child.id),
    ...(family.enrollments as any[]).map((enrollment) => enrollment.child_id)
  ].filter(Boolean)));
  const { data } = family.gardenIds.length
    ? await supabase.from("gallery_items" as any).select("id, title, media_type, file_url, watermark_applied, created_at, child_ids").in("garden_id", family.gardenIds).eq("visible_to_parents", true).order("created_at", { ascending: false }).limit(60)
    : { data: [] };
  const rows = ((data ?? []) as any[]).filter((item) => {
    const itemChildIds = Array.isArray(item.child_ids) ? item.child_ids : [];
    return itemChildIds.length === 0 || itemChildIds.some((childId: string) => childIds.includes(childId));
  });
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now);
  monthStart.setDate(now.getDate() - 30);
  const todayCount = rows.filter((item) => String(item.created_at ?? "").slice(0, 10) === todayKey).length;
  const weekCount = rows.filter((item) => item.created_at && new Date(item.created_at) >= weekStart).length;
  const monthCount = rows.filter((item) => item.created_at && new Date(item.created_at) >= monthStart).length;
  return <DashboardShell role="parent" title="גלריה"><div className="parent-page-head"><div><p className="eyebrow">רגעים מהגן</p><h1>התמונות שהגן שיתף איתך.</h1><p>רק תמונות וסרטונים שאושרו להורים. הרגעים מסודרים כמו זיכרונות משפחתיים לפי זמן.</p></div><span className="pill good">{rows.length} רגעים</span></div><section className="parent-gallery-filters"><span><SlidersHorizontal size={15} /> כל הרגעים <b>{rows.length}</b></span><span>היום <b>{todayCount}</b></span><span>השבוע <b>{weekCount}</b></span><span>החודש <b>{monthCount}</b></span></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין תמונות עדיין</strong><span>כאשר הגן יעלה רגעים שאושרו לצפייה, הם יופיעו כאן כציר זיכרונות משפחתי.</span></div> : <div className="parent-gallery-timeline">{rows.map((item) => <article className="card gallery-card parent-gallery-card" key={item.id}>{item.media_type === "image" ? <img src={item.file_url} alt={item.title} /> : <div className="video-tile"><Camera /><span>וידאו</span></div>}<div><span className="pill">{item.media_type === "image" ? "תמונה" : "וידאו"}</span><h3>{item.title}</h3><p>{item.created_at ? new Date(item.created_at).toLocaleDateString("he-IL") : ""}</p><small>{item.watermark_applied ? "מוגן לצפייה משפחתית" : "ממתין לאישור הצגה"}</small></div><a className="button secondary tiny" href={item.file_url}><ImageIcon size={14} /> פתיחה</a></article>)}</div>}</section></DashboardShell>;
}
