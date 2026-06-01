import { Camera, Image as ImageIcon } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const { data } = family.gardenIds.length
    ? await supabase.from("gallery_items" as any).select("id, title, media_type, file_url, watermark_applied, created_at").in("garden_id", family.gardenIds).eq("visible_to_parents", true).order("created_at", { ascending: false }).limit(60)
    : { data: [] };
  const rows = (data ?? []) as any[];
  return <DashboardShell role="parent" title="גלריה"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">תמונות וסרטונים</p><h1>גלריה משפחתית לפי הרשאות צילום.</h1><p>הגלריה מציגה רק פריטים שהגן סימן כמותרים להורים, עם Watermark וללא קישורים ציבוריים ישירים.</p></div><span className="pill good">{rows.length} פריטים</span></div><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין פריטים בגלריה עדיין</strong><span>כאשר הגן יעלה תמונות או סרטונים שאושרו לצפייה, הם יופיעו כאן בצורה מוגנת וברורה.</span></div> : <div className="gallery-grid">{rows.map((item) => <article className="card gallery-card" key={item.id}>{item.media_type === "image" ? <img src={item.file_url} alt={item.title} /> : <div className="video-tile"><Camera /><span>וידאו</span></div>}<div><span className="pill">{item.media_type === "image" ? "תמונה" : "וידאו"}</span><h3>{item.title}</h3><p>{item.created_at ? new Date(item.created_at).toLocaleDateString("he-IL") : ""}</p><small>{item.watermark_applied ? "Watermark פעיל" : "ממתין ל-Watermark"}</small></div><a className="button secondary tiny" href={item.file_url}><ImageIcon size={14} /> פתיחה</a></article>)}</div>}</section></DashboardShell>;
}
