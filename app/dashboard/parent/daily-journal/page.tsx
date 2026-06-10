import { BookHeart, Camera, Moon, Utensils } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Avatar } from "@/components/avatar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentDailyJournalPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const parentId = (parentRes.data as any)?.id ?? "";
  const childrenRes = await supabase.from("children" as any).select("id, full_name, photo_url").eq("primary_parent_id", parentId);
  const childIds = (childrenRes.data ?? []).map((child: any) => child.id);
  const journalsRes = childIds.length ? await supabase.from("child_daily_journals" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("journal_date", { ascending: false }).limit(30) : { data: [] };
  return (
    <DashboardShell role="parent" title="יומן יומי">
      <div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">Daily Child Journal</p><h1>היום של הילד/ה, בשפה פשוטה ומרגיעה.</h1><p>ארוחות, שינה, מצב רוח, תרופות, תמונות והערות צוות מאושרות.</p></div><span className="pill good"><BookHeart size={15} /> עדכונים מהגן</span></div>
      <section className="dashboard-section">{(journalsRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין עדכונים יומיים עדיין</strong><span>כאשר הגן יעדכן יומן יומי, הוא יופיע כאן עם תמונות והערות.</span></div> : <div className="parent-journal-feed">{(journalsRes.data ?? []).map((journal: any) => <article className="card journal-card parent-journal-card" key={journal.id}><div className="selected-child-strip"><Avatar name={journal.children?.full_name} src={journal.children?.photo_url} /><strong>{journal.children?.full_name}</strong><span>{new Date(journal.journal_date).toLocaleDateString("he-IL")}</span></div><p className="parent-daily-summary">{journal.notes_to_parents ?? `${journal.children?.full_name ?? "הילד/ה"} קיבל/ה עדכון יומי מהגן.`}</p><div className="journal-facts"><span><Utensils size={15} /> {(journal.meals ?? []).map((meal: any) => meal.note).filter(Boolean).join(", ") || "ארוחות לא עודכנו"}</span><span><Moon size={15} /> {journal.sleep_summary ?? "שינה לא עודכנה"}</span><span>מצב רוח: {journal.mood ?? "לא עודכן"}</span><span>שירותים: {journal.bathroom ?? "לא עודכן"}</span></div>{journal.medicine ? <p className="pill warn">תרופה: {journal.medicine}</p> : null}{journal.incidents ? <p className="pill bad">אירוע לטיפול: {journal.incidents}</p> : null}{Array.isArray(journal.photo_urls) && journal.photo_urls.length ? <div className="photo-strip">{journal.photo_urls.map((url: string) => <a href={url} key={url}><Camera size={15} /> תמונה</a>)}</div> : null}<small>עודכן על ידי הצוות: {journal.staff_signature ?? "לא צוינה"}</small></article>)}</div>}</section>
    </DashboardShell>
  );
}
