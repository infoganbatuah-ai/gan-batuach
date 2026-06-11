import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, Camera, FileText, HeartPulse, Image, MessageCircle, ShieldCheck, Sparkles, Utensils } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAdditionalChildRequestForm } from "@/components/parent-additional-child-request-form";
import { ParentChildRequestForm } from "@/components/parent-child-request-form";
import { ActionCard, EmptyState, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { getKindergartenAgeGroups } from "@/lib/kindergarten-age-groups";
import { createClient } from "@/lib/supabase/server";

function statusLabel(status?: string | null) {
  if (status === "active" || status === "approved") return "הכול פתוח";
  if (status === "pending_parent_completion") return "צריך להשלים פרטים";
  if (status === "pending_manager_approval") return "ממתין לאישור הגן";
  if (status === "rejected") return "נדרש בירור";
  return "בתהליך";
}

function statusTone(status?: string | null) {
  if (status === "active" || status === "approved") return "good" as const;
  if (status === "rejected") return "bad" as const;
  return "warn" as const;
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "";
}

function buildDailySummary(childName: string, journal?: any) {
  if (!journal) return `ברגע שהגן יעדכן את היום של ${childName}, הסיכום יופיע כאן בצורה קצרה וברורה.`;
  const parts = [
    journal.mood ? `${childName} היה/הייתה היום במצב רוח ${journal.mood}` : null,
    journal.sleep_summary ? `שינה: ${journal.sleep_summary}` : null,
    Array.isArray(journal.meals) && journal.meals.length ? "הארוחות עודכנו ביומן" : null,
    journal.notes_to_parents ? journal.notes_to_parents : null
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : `היום של ${childName} עודכן ביומן הגן.`;
}

function timelineFor(childName: string, journal?: any) {
  const meals = Array.isArray(journal?.meals) ? journal.meals : [];
  return [
    { time: "08:05", title: "הגעה לגן", text: `${childName} התחיל/ה את היום בגן.` },
    { time: "09:10", title: "פעילות בוקר", text: journal?.mood ? `מצב רוח: ${journal.mood}` : "פעילות הבוקר תופיע כאן כשהגן יעדכן." },
    { time: "10:20", title: "משחק בחוץ", text: "זמן חצר או פעילות תנועה." },
    { time: "11:30", title: "ארוחה", text: meals.map((meal: any) => meal.note ?? meal.text ?? meal).filter(Boolean).join(", ") || "ארוחות עדיין לא עודכנו." },
    { time: "13:00", title: "מנוחה", text: journal?.sleep_summary ?? "שינה או מנוחה עדיין לא עודכנו." },
    { time: "15:20", title: "איסוף", text: "פרטי איסוף יופיעו לאחר תיעוד הגן." }
  ];
}

export default async function ParentDashboard() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const parent = (family.parents[0] ?? null) as any;
  if (parent && (parent.completed_profile !== true || parent.onboarding_status !== "active")) redirect("/parent-onboarding");

  const enrollments = family.enrollments.map((enrollment: any) => ({
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
    medical_notes: enrollment.medical_notes,
    age_group: enrollment.kindergarten_fee_groups?.group_name ?? enrollment.classroom_name,
    classroom: enrollment.classroom_name,
    payment_status: enrollment.payment_status,
    next_payment_due: enrollment.next_payment_due,
    debt_amount: enrollment.debt_amount,
    approval_notes: enrollment.notes
  }));
  const childrenByFile = new Map<string, any>();
  const statusPriority: Record<string, number> = { active: 5, approved: 5, pending_manager_approval: 4, pending_parent_completion: 3, transferred: 2, completed: 1, rejected: 0 };
  for (const child of enrollments) {
    const key = child.permanent_child_file_id ?? child.id;
    const current = childrenByFile.get(key);
    if (!current || (statusPriority[child.status ?? ""] ?? 0) >= (statusPriority[current.status ?? ""] ?? 0)) childrenByFile.set(key, child);
  }
  const children = Array.from(childrenByFile.values());
  const childIds = children.map((child) => child.id).filter(Boolean);
  const gardenIds = family.gardenIds;
  const gardensById = new Map((family.gardens ?? []).map((garden: any) => [garden.id, garden]));
  const primaryChild = children[0] ?? null;
  const primaryGarden = primaryChild ? gardensById.get(primaryChild.garden_id ?? primaryChild.kindergarten_id) as any : null;

  const today = new Date().toISOString().slice(0, 10);
  const [
    journalRows,
    notificationRes,
    docsRes,
    latestInspectionRes,
    availableGardensRes
  ] = await Promise.all([
    childIds.length ? supabase.from("child_daily_journals" as any).select("id, child_id, journal_date, meals, sleep_summary, mood, notes_to_parents, photo_urls, created_at").in("child_id", childIds).gte("journal_date", today).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "rejected", "expired"]),
    gardenIds.length ? supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count").in("garden_id", gardenIds).eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("gardens" as any).select("id, name, city").in("status", ["active", "pending_first_inspection", "safe", "approved"]).order("name").limit(100)
  ]);

  const journalByChild = new Map((journalRows.data ?? []).map((row: any) => [row.child_id, row]));
  const primaryJournal = primaryChild ? journalByChild.get(primaryChild.id) : null;
  const timeline = primaryChild ? timelineFor(primaryChild.full_name, primaryJournal) : [];
  const safetyScore = latestInspectionRes.data?.weighted_score ?? (primaryGarden?.safe_status ? 92 : 88);
  const latestUpdate = primaryJournal?.created_at ? `עודכן היום ב-${formatDateTime(primaryJournal.created_at)}` : "ממתין לעדכון מהגן";
  const photoCount = (journalRows.data ?? []).reduce((sum: number, row: any) => sum + (Array.isArray(row.photo_urls) ? row.photo_urls.length : 0), 0);
  const primaryAgeGroups = primaryGarden ? await getKindergartenAgeGroups(supabase, primaryGarden.id, primaryGarden) : [];
  const needsCompletion = children.filter((child) => ["pending_parent_completion", "request_missing_details", "missing_info"].includes(String(child.status)));

  return (
    <DashboardShell role="parent" title="הילד שלי">
      <div className="parent-experience-shell">
        {primaryChild ? (
          <section className="parent-child-hero">
            <div className="parent-child-photo">
              <Avatar name={primaryChild.full_name} src={primaryChild.photo_url ?? primaryChild.face_image_url} size="lg" />
            </div>
            <div>
              <p className="eyebrow">היום של {primaryChild.full_name}</p>
              <h1>{buildDailySummary(primaryChild.full_name, primaryJournal)}</h1>
              <div className="parent-status-row">
                <span className={`pill ${statusTone(primaryChild.status)}`}>{statusLabel(primaryChild.status)}</span>
                <span className="pill good">{primaryGarden?.name ?? "גן משויך"}</span>
                <span className="pill good">אמון {safetyScore}/100</span>
                <span className="pill warn">{latestUpdate}</span>
              </div>
            </div>
            <div className="parent-hero-actions">
              <Link className="button primary" href="/dashboard/parent/messages">הודעה לגן</Link>
              <Link className="button secondary" href="/dashboard/parent/daily-journal">יומן מלא</Link>
            </div>
          </section>
        ) : (
          <EmptyState title="עדיין אין ילד משויך" text="לאחר אישור הגן, כרטיס הילד והעדכונים היומיים יופיעו כאן." action={<Link className="button primary" href="#add-child-request">בקשת רישום ילד</Link>} />
        )}

        {needsCompletion.length ? <section className="parent-focus-banner"><strong>צריך להשלים פרטים</strong><span>כדי לפתוח את כל חוויית ההורה, השלימו את פרטי הילד שהגן ביקש.</span><div>{needsCompletion.map((child) => <Link className="button primary tiny" href={`/parent-onboarding?childId=${child.id}`} key={child.id}>השלמת {child.full_name}</Link>)}</div></section> : null}

        <section className="parent-metric-strip">
          <RoleMetricCard label="ילדים" value={children.length} hint="בחשבון שלך" tone="good" />
          <RoleMetricCard label="עדכונים היום" value={(journalRows.data ?? []).length} hint="מהגן" tone={(journalRows.data ?? []).length ? "good" : "warn"} href="/dashboard/parent/daily-journal" />
          <RoleMetricCard label="התראות" value={notificationRes.count ?? 0} hint="לא נקראו" tone={notificationRes.count ? "warn" : "good"} href="/dashboard/parent/notifications" />
          <RoleMetricCard label="תמונות" value={photoCount} hint="מהיום" tone="good" href="/dashboard/parent/gallery" />
        </section>

        {primaryChild ? <section className="parent-two-column">
          <article className="parent-feed-card">
            <div className="section-heading"><h2>ציר היום</h2><p>פיד קצר, לא דוח.</p></div>
            <div className="parent-day-feed">{timeline.map((item) => <div className="parent-feed-item" key={`${item.time}-${item.title}`}><time>{item.time}</time><div><strong>{item.title}</strong><span>{item.text}</span></div></div>)}</div>
          </article>
          <article className="parent-ai-card">
            <Sparkles />
            <h2>אפשר לשאול</h2>
            <p>התשובות מתבססות רק על מידע שהגן כבר עדכן ואישר.</p>
            <div className="parent-question-list">
              <Link href="/dashboard/parent/daily-journal">איך עבר היום?</Link>
              <Link href="/dashboard/parent/daily-journal">האם הילד אכל?</Link>
              <Link href="/dashboard/parent/messages">יש משהו שכדאי לשאול את הגן?</Link>
            </div>
          </article>
        </section> : null}

        <section className="parent-action-grid">
          <ActionCard title="הודעות" text="שיחה קצרה וברורה עם הגן" href="/dashboard/parent/messages" icon={MessageCircle} tone="good" />
          <ActionCard title="מרכז אמון" text="שקיפות, פיקוח וציות" href="/dashboard/parent/trust" icon={ShieldCheck} />
          <ActionCard title="יומן יומי" text="אוכל, שינה, מצב רוח ותמונות" href="/dashboard/parent/daily-journal" icon={HeartPulse} />
          <ActionCard title="מצלמות" text="צפייה רק אם הגן אישר" href="/dashboard/parent/cameras" icon={Camera} />
          <ActionCard title="גלריה" text="רגעים שהגן שיתף" href="/dashboard/parent/gallery" icon={Image} />
          <ActionCard title="מסמכים" text="אישורים וקבצים" href="/dashboard/parent/documents" icon={FileText} />
          <ActionCard title="איסוף" text="מורשים וזמני איסוף" href="/dashboard/parent/pickup" icon={ShieldCheck} />
        </section>

        <section className="parent-two-column">
          <article className="parent-trust-card">
            <ShieldCheck />
            <h2>אפשר לסמוך</h2>
            <div className="parent-trust-list">
              <span>ציון אמון <b>{safetyScore}/100</b></span>
              <span>ביקורת אחרונה <b>{latestInspectionRes.data?.completed_at ? new Date(latestInspectionRes.data.completed_at).toLocaleDateString("he-IL") : "טרם פורסמה"}</b></span>
              <span>ליקויים פתוחים <b>{latestInspectionRes.data?.violation_count ?? 0}</b></span>
              <span>סטטוס גן <b>{primaryGarden?.safe_status ?? "במעקב"}</b></span>
            </div>
          </article>
          <article className="parent-child-card-mini">
            <Baby />
            <h2>כרטיס ילד מהיר</h2>
            {primaryChild ? <div className="parent-trust-list">
              <span>אלרגיות <b>{primaryChild.allergies || "אין"}</b></span>
              <span>קבוצה <b>{primaryChild.age_group ?? primaryChild.classroom ?? primaryAgeGroups[0]?.label ?? "לא צוינה"}</b></span>
              <span>תשלום הבא <b>{primaryChild.next_payment_due ? new Date(primaryChild.next_payment_due).toLocaleDateString("he-IL") : "לא נקבע"}</b></span>
              <span>חוב פתוח <b>₪{Number(primaryChild.debt_amount ?? 0).toLocaleString("he-IL")}</b></span>
            </div> : <p>כרטיס הילד יופיע לאחר שיוך לגן.</p>}
          </article>
        </section>

        <section className="parent-engagement-panel">
          <div><p className="eyebrow">מעורבות הורים</p><h2>מה נפתח היום?</h2><p>מדדים פנימיים לחוויית הורה, ללא תלות חדשה וללא חשיפת מידע אישי מעבר לחשבון שלך.</p></div>
          <div className="parent-engagement-grid">
            <span><HeartPulse /> עדכוני ילד <b>{(journalRows.data ?? []).length}</b></span>
            <span><MessageCircle /> התראות פתוחות <b>{notificationRes.count ?? 0}</b></span>
            <span><Utensils /> יומן נצפה <b>{primaryJournal ? "זמין" : "ממתין"}</b></span>
            <span><Camera /> מצלמות <b>לפי הרשאת הגן</b></span>
          </div>
        </section>

        <section className="parent-two-column" id="add-child-request">
          <ParentAdditionalChildRequestForm gardenName={primaryGarden?.name} defaultGardenId={primaryGarden?.id ?? gardenIds[0]} gardens={((availableGardensRes.data ?? family.gardens ?? []) as any[])} children={children.map((child: any) => ({ ...child, garden_name: (gardensById.get(child.garden_id ?? child.kindergarten_id) as any)?.name }))} />
          <ParentChildRequestForm children={children} />
        </section>
      </div>
    </DashboardShell>
  );
}
