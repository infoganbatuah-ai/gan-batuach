import Link from "next/link";
import { Baby, Camera, CalendarDays, HeartPulse, Image, MessageCircle, ShieldCheck, Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const parentActions = [
  { href: "/dashboard/parent/daily-journal", label: "יומן יומי", icon: HeartPulse, text: "ארוחות, שינה, מצב רוח ותמונות מהגן." },
  { href: "/dashboard/parent/notifications", label: "התראות", icon: ShieldCheck, text: "עדכונים חשובים שדורשים תשומת לב." },
  { href: "/parent-onboarding", label: "עדכון כרטיס ילד", icon: Baby, text: "בריאות, פרטים, אנשי קשר והסכמות." },
  { href: "/dashboard/parent/messages", label: "פנייה לגן", icon: MessageCircle, text: "שאלה או הודעה מתועדת לגננת." },
  { href: "/dashboard/parent/complaints", label: "הגשת תלונה", icon: Siren, text: "פנייה לגורם מוסמך לפי חומרה." },
  { href: "/dashboard/parent/cameras", label: "צפייה במצלמות", icon: Camera, text: "רק מצלמות מורשות ובחלון צפייה מוגדר." },
  { href: "/dashboard/parent/schedule", label: "לו״ז ותפריט", icon: CalendarDays, text: "סדר יום, אוכל, פעילויות והודעות." },
  { href: "/dashboard/parent/gallery", label: "גלריה", icon: Image, text: "תמונות לפי הרשאות צילום." }
];

export default async function ParentDashboard() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const { data: latestInspection } = await supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count").eq("garden_id", profile.garden_id ?? "").eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle();
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const parentId = (parentRes.data as any)?.id ?? "";
  const childrenRes = parentId ? await supabase.from("children" as any).select("id, full_name, birth_date, photo_url, face_image_url, status, allergies, hmo, medical_notes").eq("primary_parent_id", parentId).limit(6) : { data: [] };
  const childIds = (childrenRes.data ?? []).map((child: any) => child.id);
  const today = new Date().toISOString().slice(0, 10);
  const journalRows = childIds.length ? await supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood, notes_to_parents, photo_urls").in("child_id", childIds).gte("journal_date", today) : { data: [] };
  const journalRes = { count: (journalRows.data ?? []).length };
  const notificationRes = await supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null);
  const journalByChild = new Map((journalRows.data ?? []).map((row: any) => [row.child_id, row]));
  return (
    <DashboardShell role="parent" title="אזור הורים">
      <div className="dashboard-hero-card parent-hero-card premium-identity-hero"><div><p className="eyebrow">שקט להורים</p><h1>כל מה שחשוב לדעת על הילד והגן, בלי עומס.</h1><p>נוכחות, איסוף, יומן יומי, הודעות, מצלמות, פיקוח, מסמכים ותלונות במקום אחד וברור.</p></div><div className="avatar-stack">{(childrenRes.data ?? []).map((child: any) => <Avatar key={child.id} name={child.full_name} src={child.photo_url} size="lg" />)}</div><span className="pill good"><ShieldCheck size={15} /> מידע לפי הרשאה</span></div>
      <div className="grid cols-3 dashboard-kpis"><StatCard label="ילדים משויכים" value={(childrenRes.data ?? []).length} tone="good" /><StatCard label="יומן יומי היום" value={journalRes.count ?? 0} /><StatCard label="התראות פתוחות" value={notificationRes.count ?? 0} tone="warn" /></div>
      <section className="parent-spotlight-card">
        <div><p className="eyebrow">Child Spotlight</p><h2>היום היה יום נהדר</h2><p>כאן ההורה מקבל חוויה רגשית: מצב רוח, ארוחה, שינה, תמונות חדשות והודעה מהגן במקום אחד.</p></div>
        <div className="spotlight-metrics"><span>תמונות היום <b>{(journalRows.data ?? []).reduce((sum: number, row: any) => sum + (row.photo_urls?.length ?? 0), 0)}</b></span><span>יומן חדש <b>{journalRes.count ?? 0}</b></span><span>התראות <b>{notificationRes.count ?? 0}</b></span></div>
      </section>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>הילדים שלי</h2><p>כרטיס חם וברור לכל ילד: תמונה, בריאות, עדכון יומי ומה כדאי לבדוק עכשיו.</p></div>
        {(childrenRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין ילדים משויכים עדיין</strong><span>לאחר אישור הגן, כרטיס הילד והיומן היומי יופיעו כאן.</span><Link className="button primary" href="/parent-onboarding">השלמת כרטיס ילד</Link></div> : <div className="people-card-grid parent-child-grid">{(childrenRes.data ?? []).map((child: any) => {
          const journal = journalByChild.get(child.id) as any;
          const meals = Array.isArray(journal?.meals) ? journal.meals.map((meal: any) => meal.text ?? meal).join(", ") : "טרם עודכן";
          return <article className="person-card child-profile-card parent-child-card" key={child.id}>
            <div className="person-card-top"><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" /><div><span className={child.status === "active" ? "pill good" : "pill warn"}>{child.status ?? "ממתין לאישור"}</span><h3>{child.full_name}</h3><p>{child.birth_date ? new Date(child.birth_date).toLocaleDateString("he-IL") : "תאריך לידה חסר"} · {child.hmo ?? "קופה לא צוינה"}</p></div></div>
            <div className="profile-badge-row"><span className={child.allergies ? "pill bad" : "pill good"}><HeartPulse size={14} /> {child.allergies ? "אלרגיה מתועדת" : "אין אלרגיות"}</span><span className={journal ? "pill good" : "pill warn"}><CalendarDays size={14} /> {journal ? "יש עדכון היום" : "אין עדכון היום"}</span></div>
            <div className="mini-kpi-row"><span>ארוחות <b>{meals}</b></span><span>שינה <b>{journal?.sleep_summary ?? "טרם"}</b></span><span>מצב רוח <b>{journal?.mood ?? "טרם"}</b></span></div>
            <details className="profile-expand"><summary>מה חשוב לדעת היום?</summary><div className="profile-details-grid"><section><h4>בריאות</h4><p>{child.medical_notes || "אין הערה רפואית מיוחדת."}</p></section><section><h4>הערת צוות</h4><p>{journal?.notes_to_parents || "עדיין לא נשלחה הערה מהגן."}</p></section><section><h4>תמונות היום</h4><div className="gallery-preview">{(journal?.photo_urls ?? [child.photo_url]).filter(Boolean).slice(0, 3).map((url: string) => <img src={url} alt="תמונה מהגן" key={url} />)}</div></section></div></details>
            <div className="profile-actions"><Link className="button secondary tiny" href="/dashboard/parent/daily-journal">יומן יומי</Link><Link className="button secondary tiny" href="/parent-onboarding">עדכון פרטים</Link><Link className="button tiny" href="/dashboard/parent/messages">פנייה לגן</Link></div>
          </article>;
        })}</div>}
      </section>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות הורה</h2><p>כל פעולה נשמרת ומתועדת כדי להגן על הילד ועל פרטיות המשפחה.</p></div><div className="quick-actions-grid">{parentActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>{action.text}</span></Link>)}</div></section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>תקציר בטיחות הגן</h2><div className="risk-list"><div><ShieldCheck /> סטטוס גן בטוח <b>לפי הרשאה</b></div><div><HeartPulse /> מידע רפואי <b>ניתן לעדכון</b></div><div><Camera /> צפייה בלייב <b>Token זמני</b></div></div></article><article className="card action-panel"><h2>דוח ביקורת אחרון</h2>{latestInspection ? <div className="list-item"><div><strong>ציון {latestInspection.weighted_score ?? "-"}</strong><span>{latestInspection.completed_at ? new Date(latestInspection.completed_at).toLocaleDateString("he-IL") : ""} · ליקויים {latestInspection.violation_count ?? 0}</span></div><Link className="button secondary" href={`/dashboard/parent/inspections/${latestInspection.id}/report`}>צפייה בדוח</Link></div> : <p>עדיין אין דוח ביקורת מאושר להצגה.</p>}</article></section>
    </DashboardShell>
  );
}
