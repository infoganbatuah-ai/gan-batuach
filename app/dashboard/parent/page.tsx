import Link from "next/link";
import { Baby, Camera, CalendarDays, HeartPulse, Image, MessageCircle, ShieldCheck, Siren } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { ParentAdditionalChildRequestForm } from "@/components/parent-additional-child-request-form";
import { ParentChildRequestForm } from "@/components/parent-child-request-form";
import { SimpleCommandCenter } from "@/components/simple-command-center";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { formatAgeGroups, getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createClient } from "@/lib/supabase/server";

const parentActions = [
  { href: "/dashboard/parent/daily-journal", label: "היום של הילד", icon: HeartPulse, text: "ארוחות, שינה, מצב רוח ותמונות מהגן." },
  { href: "/dashboard/parent/notifications", label: "עדכונים חדשים", icon: ShieldCheck, text: "רק דברים שחשוב שתראו." },
  { href: "/dashboard/parent#add-child-request", label: "בקשת רישום ילד נוסף", icon: Baby, text: "בקשה רגועה וברורה לאישור הגן." },
  { href: "/dashboard/parent/messages", label: "שליחת הודעה לגן", icon: MessageCircle, text: "שאלה קצרה לצוות או למנהלת." },
  { href: "/dashboard/parent/pickup", label: "מורשי איסוף", icon: ShieldCheck, text: "הרשאות קבועות וזמניות לאיסוף הילד." },
  { href: "/dashboard/parent/complaints", label: "בקשה דחופה", icon: Siren, text: "כשמשהו צריך טיפול מיוחד." },
  { href: "/dashboard/parent/cameras", label: "מצלמות הגן", icon: Camera, text: "רק אם הגן פתח צפייה להורים." },
  { href: "/dashboard/parent/schedule", label: "לו״ז ותפריט", icon: CalendarDays, text: "מה צפוי היום ובשבוע הקרוב." },
  { href: "/dashboard/parent/gallery", label: "תמונות", icon: Image, text: "רגעים שהגן שיתף איתך." }
];

export default async function ParentDashboard() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const parent = (family.parents[0] ?? null) as any;
  const parentId = parent?.id ?? "";
  const enrollmentCards = family.enrollments.map((enrollment: any) => ({
    id: enrollment.child_id ?? enrollment.permanent_child_file_id,
    enrollment_id: enrollment.id,
    garden_id: enrollment.garden_id ?? enrollment.kindergarten_id,
    kindergarten_id: enrollment.garden_id ?? enrollment.kindergarten_id,
    permanent_child_file_id: enrollment.permanent_child_file_id,
    full_name: enrollment.full_name,
    birth_date: enrollment.birth_date,
    photo_url: enrollment.photo_url,
    face_image_url: enrollment.photo_url,
    status: enrollment.status,
    allergies: enrollment.allergies,
    hmo: enrollment.hmo,
    medical_notes: enrollment.medical_notes,
    age_group: enrollment.kindergarten_fee_groups?.group_name ?? enrollment.classroom_name,
    classroom: enrollment.classroom_name,
    payment_status: enrollment.payment_status,
    monthly_fee: enrollment.monthly_fee,
    next_payment_due: enrollment.next_payment_due,
    valid_until: enrollment.valid_until,
    debt_amount: enrollment.debt_amount,
    pickup_status: null,
    approval_notes: enrollment.notes,
    manager_response: null
  }));
  const statusPriority: Record<string, number> = { active: 5, pending_manager_approval: 4, pending_parent_completion: 3, transferred: 2, completed: 1, rejected: 0 };
  const childCardsByFile = new Map<string, any>();
  for (const child of enrollmentCards) {
    const key = child.permanent_child_file_id ?? child.id;
    const current = childCardsByFile.get(key);
    const mergedEnrollments = [...(current?.enrollments ?? []), child];
    if (!current || (statusPriority[child.status ?? ""] ?? 0) >= (statusPriority[current.status ?? ""] ?? 0)) {
      childCardsByFile.set(key, { ...child, enrollments: mergedEnrollments });
    } else {
      childCardsByFile.set(key, { ...current, enrollments: mergedEnrollments });
    }
  }
  const childrenRes = {
    data: Array.from(childCardsByFile.values())
  };
  const childrenNeedingCompletion = (childrenRes.data ?? []).filter((child: any) => ["pending_parent_completion", "request_missing_details", "missing_info"].includes(String(child.status)));
  const childIds = (childrenRes.data ?? []).map((child: any) => child.id);
  const gardenIds = family.gardenIds;
  const gardensRes = { data: family.gardens };
  const gardensById = new Map((gardensRes.data ?? []).map((garden: any) => [garden.id, garden]));
  const { data: availableGardens } = await supabase
    .from("gardens" as any)
    .select("id, name, city")
    .in("status", ["active", "pending_first_inspection", "safe", "approved"])
    .order("name")
    .limit(100);
  const primaryGarden = gardensById.get(profile.garden_id ?? parent?.garden_id ?? gardenIds[0]) as any;
  const primaryAgeGroups = primaryGarden ? await getKindergartenAgeGroups(supabase, primaryGarden.id, primaryGarden) : [];
  const { data: latestInspection } = gardenIds.length ? await supabase.from("inspections" as any).select("id, garden_id, completed_at, weighted_score, violation_count").in("garden_id", gardenIds).eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const today = new Date().toISOString().slice(0, 10);
  const journalRows = childIds.length ? await supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood, notes_to_parents, photo_urls").in("child_id", childIds).gte("journal_date", today) : { data: [] };
  const journalRes = { count: (journalRows.data ?? []).length };
  const notificationRes = await supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null);
  const docsRes = await supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "rejected", "expired"]);
  const journalByChild = new Map((journalRows.data ?? []).map((row: any) => [row.child_id, row]));
  const calmItems = [
    { title: "יומן חדש מהגן", count: journalRes.count ?? 0, description: "ארוחה, שינה, מצב רוח ותמונות", href: "/dashboard/parent/daily-journal", tone: (journalRes.count ?? 0) ? "good" as const : "warn" as const, icon: HeartPulse },
    { title: "מסמך שצריך להשלים", count: docsRes.count ?? 0, description: "רק אם חסר משהו למשפחה", href: "/dashboard/parent/documents", tone: (docsRes.count ?? 0) ? "warn" as const : "good" as const, icon: ShieldCheck },
    { title: "הודעות שלא נקראו", count: notificationRes.count ?? 0, description: "עדכונים מהגן במקום אחד", href: "/dashboard/parent/notifications", tone: (notificationRes.count ?? 0) ? "warn" as const : "good" as const, icon: MessageCircle },
    { title: "תמונות היום", count: (journalRows.data ?? []).reduce((sum: number, row: any) => sum + (row.photo_urls?.length ?? 0), 0), description: "רגעים שהגן שיתף איתך", href: "/dashboard/parent/gallery", tone: "good" as const, icon: Image },
    { title: "מצלמות הגן", count: "מורשה", description: "רק אם הגן פתח צפייה להורים", href: "/dashboard/parent/cameras", tone: "good" as const, icon: Camera }
  ];
  return (
    <DashboardShell role="parent" title="אזור הורים">
      <div className="dashboard-hero-card parent-hero-card premium-identity-hero"><div><p className="eyebrow">מה קורה עם הילד שלי היום?</p><h1>שלום, {profile.full_name ?? parent?.full_name ?? "הורה יקר/ה"}</h1><p>היום של הילד, הודעות מהגן, תמונות, מסמכים ותשלומים במקום אחד רגוע וברור.</p></div><div className="avatar-stack">{(childrenRes.data ?? []).map((child: any) => <Avatar key={child.id} name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" />)}</div><span className="pill good"><ShieldCheck size={15} /> מידע שמותר להציג לך</span></div>
      {childrenNeedingCompletion.length ? <section className="card action-panel urgent-parent-completion"><div><p className="eyebrow">המשימה החשובה עכשיו</p><h2>השלמת פרטי הילד</h2><p>הגן אישר את בקשת ההצטרפות הראשונית. יש להשלים פרטי בריאות, איסוף, תמונות והצהרות כדי שהמנהלת תוכל לאשר את הילד.</p></div><div className="profile-actions">{childrenNeedingCompletion.map((child: any) => <Link className="button primary" key={child.id} href={`/parent-onboarding?childId=${child.id}`}>השלמת רישום {child.full_name}</Link>)}</div></section> : null}
      <div className="grid cols-3 dashboard-kpis"><StatCard label="ילדים משויכים" value={(childrenRes.data ?? []).length} tone="good" /><StatCard label="יומן יומי היום" value={journalRes.count ?? 0} /><StatCard label="התראות פתוחות" value={notificationRes.count ?? 0} tone="warn" /></div>
      <section className="dashboard-section">
        <div className="section-heading"><h2>הילדים שלי לפי גנים</h2><p>חשבון הורה אחד יכול לנהל ילדים בכמה גנים. כל הודעה, מצלמה, מסמך ותשלום נשמרים לפי הגן הנכון.</p></div>
        {gardenIds.length === 0 ? <div className="empty-state"><strong>עדיין אין שיוך לגן</strong><span>לאחר אישור בקשת הרישום, הגן והילדים המשויכים אליו יופיעו כאן.</span></div> : <div className="grid cols-2 dashboard-panels">{gardenIds.map((gardenId: string) => {
          const garden = gardensById.get(gardenId) as any;
          const gardenChildren = (childrenRes.data ?? []).filter((child: any) => (child.garden_id ?? child.kindergarten_id) === gardenId);
          return <article className="card action-panel" key={gardenId}><div className="kindergarten-mini-line"><Avatar name={garden?.name ?? "גן"} src={garden?.logo_url ?? garden?.image_url} size="sm" /><div><h3>{garden?.name ?? "גן ילדים"}</h3><p>{garden?.city ?? ""} · {gardenChildren.length} ילדים משויכים</p></div></div><div className="linked-children-strip">{gardenChildren.map((child: any) => <span key={child.id}><Avatar name={child.full_name} src={child.photo_url} size="sm" /> {child.full_name}</span>)}</div><div className="profile-actions"><Link className="button secondary tiny" href="/dashboard/parent/cameras">מצלמות הגן</Link><Link className="button secondary tiny" href="/dashboard/parent/messages">הודעות</Link><Link className="button secondary tiny" href="/dashboard/parent/documents">מסמכים</Link></div></article>;
        })}</div>}
      </section>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>הילדים שלי</h2><p>כרטיס חם וברור לכל ילד: גן, תמונה, בריאות, עדכון יומי ומה כדאי לבדוק עכשיו.</p><Link className="button primary" href="#add-child-request">בקשת רישום ילד נוסף</Link></div>
        {(childrenRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין ילדים משויכים עדיין</strong><span>לאחר אישור הגן, כרטיס הילד והיומן היומי יופיעו כאן. אם זהו ילד חדש, שלחו בקשה לגן.</span><Link className="button primary" href="#add-child-request">בקשת רישום ילד</Link></div> : <div className="people-card-grid parent-child-grid">{(childrenRes.data ?? []).map((child: any) => {
          const journal = journalByChild.get(child.id) as any;
          const meals = Array.isArray(journal?.meals) ? journal.meals.map((meal: any) => meal.text ?? meal).join(", ") : "טרם עודכן";
          const garden = gardensById.get(child.garden_id ?? child.kindergarten_id) as any;
          const childStatus = child.status === "active" || child.status === "approved" ? "הגן אישר את פרטי הילד" : child.status === "pending_parent_completion" ? "חסרים פרטים להשלמה" : child.status === "pending_manager_approval" ? "הילד ממתין לאישור הגן" : "בקשה בתהליך";
          return <article className="person-card child-profile-card parent-child-card" key={child.id}>
            <div className="person-card-top"><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" /><div><span className={child.status === "active" ? "pill good" : "pill warn"}>{child.status ?? "ממתין לאישור"}</span><h3>{child.full_name}</h3><p>{child.birth_date ? new Date(child.birth_date).toLocaleDateString("he-IL") : "תאריך לידה חסר"} · {child.hmo ?? "קופה לא צוינה"}</p></div></div>
            <div className="kindergarten-mini-line"><Avatar name={garden?.name ?? "גן"} src={garden?.logo_url ?? garden?.image_url} size="sm" /><span>{garden?.name ?? "גן משויך"}</span><small>{child.age_group ?? child.classroom ?? "קבוצה לא צוינה"}</small></div>
            <div className="profile-badge-row"><span className={child.allergies ? "pill bad" : "pill good"}><HeartPulse size={14} /> {child.allergies ? "אלרגיה מתועדת" : "אין אלרגיות"}</span><span className={journal ? "pill good" : "pill warn"}><CalendarDays size={14} /> {journal ? "עודכן יומן חדש" : "אין עדכון היום"}</span><span className={child.status === "active" || child.status === "approved" ? "pill good" : "pill warn"}>{childStatus}</span><span className={["paid"].includes(child.payment_status) ? "pill good" : ["failed", "not_transferred", "overdue"].includes(child.payment_status) ? "pill bad" : "pill warn"}>תשלום: {child.payment_status ?? "לא עודכן"}</span></div>
            <div className="mini-kpi-row"><span>ארוחות <b>{meals}</b></span><span>שינה <b>{journal?.sleep_summary ?? "טרם"}</b></span><span>מצב רוח <b>{journal?.mood ?? "טרם"}</b></span></div>
            <details className="profile-expand"><summary>מה חשוב לדעת היום?</summary><div className="profile-details-grid"><section><h4>בריאות</h4><p>{child.medical_notes || "אין הערה רפואית מיוחדת."}</p></section><section><h4>הגן</h4><p>{garden?.name ?? "גן משויך"} · {garden?.phone ? `טלפון: ${garden.phone}` : "פרטי קשר לפי הרשאה"}</p><p>סטטוס אמון: {garden?.safe_status ?? "לפי הרשאה"}</p></section><section><h4>תשלום חודשי</h4><p>₪{Number(child.monthly_fee ?? 0).toLocaleString("he-IL")} · סטטוס {child.payment_status ?? "לא עודכן"}</p><p>תשלום הבא: {child.next_payment_due ? new Date(child.next_payment_due).toLocaleDateString("he-IL") : "לא נקבע"} · חוב: ₪{Number(child.debt_amount ?? 0).toLocaleString("he-IL")}</p></section><section><h4>הערת צוות</h4><p>{journal?.notes_to_parents || "עדיין לא נשלחה הערה מהגן."}</p></section><section><h4>תמונות היום</h4><div className="gallery-preview">{(journal?.photo_urls ?? [child.photo_url]).filter(Boolean).slice(0, 3).map((url: string) => <img src={url} alt="תמונה מהגן" key={url} />)}</div></section></div></details>
            <div className="profile-actions"><Link className="button secondary tiny" href={`/dashboard/parent/children/${child.id}`}>כניסה לפרופיל</Link>{child.status === "pending_parent_completion" || child.status === "request_missing_details" ? <Link className="button primary tiny" href={`/parent-onboarding?childId=${child.id}`}>השלמת פרטים</Link> : null}<Link className="button secondary tiny" href="/dashboard/parent/daily-journal">יומן יומי</Link><Link className="button tiny" href="/dashboard/parent/messages">פנייה לגן</Link></div>
          </article>;
        })}</div>}
      </section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>פרטי הגן של הילד</h2><div className="risk-list"><div>גן <b>{primaryGarden?.name ?? "גן משויך"}</b></div><div>מנהלת <b>{primaryGarden?.manager?.full_name ?? "לפי הרשאת הגן"}</b></div><div>קבוצות גיל <b>{formatAgeGroups(primaryAgeGroups)}</b></div><div>טלפון <b>{primaryGarden?.phone ?? primaryGarden?.manager?.phone ?? "לפי הרשאה"}</b></div><div>מצלמות <b>אם הגן פתח צפייה</b></div></div></article><article className="card action-panel"><h2>סיכום אמון ופיקוח</h2>{latestInspection ? <div className="list-item"><div><strong>ציון {latestInspection.weighted_score ?? "-"}</strong><span>{latestInspection.completed_at ? new Date(latestInspection.completed_at).toLocaleDateString("he-IL") : ""} · ליקויים {latestInspection.violation_count ?? 0}</span></div><Link className="button secondary" href={`/dashboard/parent/inspections/${latestInspection.id}/report`}>צפייה בדוח</Link></div> : <p>עדיין אין דוח ביקורת מאושר להצגה.</p>}<div className="risk-list"><div><ShieldCheck /> סטטוס גן בטוח <b>{primaryGarden?.safe_status ?? "לפי הרשאה"}</b></div><div><HeartPulse /> מידע רפואי <b>אפשר לעדכן כשצריך</b></div><div><Camera /> מצלמות <b>רק אם אושרו להורים</b></div></div></article></section>
      <section className="dashboard-section"><div className="section-heading"><h2>פעולות הורה</h2><p>כל פעולה נשמרת ומתועדת כדי להגן על הילד ועל פרטיות המשפחה.</p></div><div className="quick-actions-grid">{parentActions.map((action) => <Link className="quick-action" href={action.href} key={action.label}><action.icon /><strong>{action.label}</strong><span>{action.text}</span></Link>)}</div></section>
      <section className="grid cols-2 dashboard-panels" id="add-child-request"><ParentAdditionalChildRequestForm gardenName={primaryGarden?.name} defaultGardenId={primaryGarden?.id ?? gardenIds[0]} gardens={((availableGardens ?? gardensRes.data ?? []) as any[])} children={((childrenRes.data ?? []) as any[]).map((child: any) => ({ ...child, garden_name: (gardensById.get(child.garden_id ?? child.kindergarten_id) as any)?.name }))} /><ParentChildRequestForm children={(childrenRes.data ?? []) as any[]} /></section>
      <SimpleCommandCenter title="מה התעדכן אצל הילד שלי?" subtitle="מסך רגוע להורים: רק עדכונים חשובים, בלי שפה טכנית ובלי עומס." items={calmItems} />
      <section className="parent-spotlight-card">
        <div><p className="eyebrow">Child Spotlight</p><h2>היום היה יום נהדר</h2><p>כאן ההורה מקבל חוויה רגשית: מצב רוח, ארוחה, שינה, תמונות חדשות והודעה מהגן במקום אחד.</p></div>
        <div className="spotlight-metrics"><span>תמונות היום <b>{(journalRows.data ?? []).reduce((sum: number, row: any) => sum + (row.photo_urls?.length ?? 0), 0)}</b></span><span>יומן חדש <b>{journalRes.count ?? 0}</b></span><span>התראות <b>{notificationRes.count ?? 0}</b></span></div>
      </section>
    </DashboardShell>
  );
}
