import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  Baby,
  Bell,
  Camera,
  CheckCircle2,
  FileText,
  HeartPulse,
  Image,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentActionTile, ParentAppFrame, ParentEmptyState, ParentMetricCard } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { eventDateText, eventTimeText, timelineCategoryLabel, timelineTone } from "@/lib/domain/child-safety-timeline";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

function childStatusLabel(status?: string | null) {
  if (status === "active" || status === "approved") return "מחובר לגן";
  if (status === "pending_parent_completion") return "צריך להשלים פרטים";
  if (status === "pending_manager_approval") return "ממתין לאישור הגן";
  if (status === "rejected") return "נדרש בירור";
  return "בתהליך";
}

function toneForChild(status?: string | null) {
  if (status === "active" || status === "approved") return "good" as const;
  if (status === "rejected") return "bad" as const;
  return "warn" as const;
}

function paymentNeedsAttention(child: any) {
  return ["overdue", "unpaid", "partial", "failed", "not_transferred"].includes(String(child.payment_status)) || Number(child.debt_amount ?? 0) > 0;
}

function parentDailySummary(childName: string, journal?: any, timeline: any[] = []) {
  if (journal?.notes_to_parents) return journal.notes_to_parents;
  const mealText = Array.isArray(journal?.meals) && journal.meals.length ? "הארוחות עודכנו" : null;
  const sleepText = journal?.sleep_summary ? `שינה: ${journal.sleep_summary}` : null;
  const activity = timeline.find((event) => event.event_category === "activities");
  const health = timeline.find((event) => event.event_category === "health");
  const parts = [
    activity ? `${childName} השתתף/ה בפעילות היום` : null,
    mealText,
    sleepText,
    health ? "יש עדכון בריאותי לצפייה" : null
  ].filter(Boolean);
  if (parts.length) return parts.join(". ") + ".";
  return `כשהגן יעדכן את היום של ${childName}, יופיע כאן סיכום קצר וברור.`;
}

function safeDate(value?: string | null) {
  if (!value) return "לא עודכן";
  return new Date(value).toLocaleDateString("he-IL");
}

function categoryLabelForFeed(item: any) {
  const text = `${item.title ?? ""} ${item.body ?? ""} ${item.message ?? ""} ${item.entity_type ?? ""}`;
  if (text.includes("מסמך") || text.toLowerCase().includes("document")) return "מסמך";
  if (text.includes("תשלום") || text.toLowerCase().includes("payment")) return "תשלום";
  if (text.includes("בטיחות") || text.includes("תצפיתן") || text.toLowerCase().includes("safety")) return "בטיחות";
  if (text.includes("הודעה") || text.toLowerCase().includes("message")) return "הודעה";
  if (text.includes("איסוף") || text.toLowerCase().includes("pickup")) return "איסוף";
  return "עדכון";
}

function parentTone(tone?: string | null) {
  if (tone === "good") return "green" as const;
  if (tone === "warn") return "orange" as const;
  if (tone === "bad") return "red" as const;
  return "purple" as const;
}

function StatusBadge({ tone, children }: { tone?: string | null; children: ReactNode }) {
  return <span className={`parent-status-chip ${parentTone(tone)}`}>{children}</span>;
}

function RoleMetricCard({
  label,
  value,
  hint,
  tone,
  href
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string | null;
  href?: string;
}) {
  return <ParentMetricCard title={label} value={value} hint={hint} icon={Sparkles} tone={parentTone(tone)} href={href} />;
}

function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <ParentEmptyState title={title} text={text} action={action} />;
}

function ActionCard({
  title,
  href,
  icon,
  tone
}: {
  title: string;
  text?: string;
  href: string;
  icon: ComponentType<any>;
  tone?: string | null;
}) {
  return <ParentActionTile title={title} href={href} icon={icon} tone={parentTone(tone)} />;
}

export default async function ParentFamilyHomePage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const parent = (family.parents[0] ?? null) as any;
  if (parent && (parent.completed_profile !== true || parent.onboarding_status !== "active")) redirect("/parent-onboarding");

  const enrollments = (family.enrollments as any[]).map((enrollment) => ({
    id: enrollment.child_id ?? enrollment.permanent_child_file_id,
    enrollment_id: enrollment.id,
    permanent_child_file_id: enrollment.permanent_child_file_id,
    garden_id: enrollment.garden_id ?? enrollment.kindergarten_id,
    kindergarten_id: enrollment.garden_id ?? enrollment.kindergarten_id,
    full_name: enrollment.full_name,
    birth_date: enrollment.birth_date,
    photo_url: enrollment.photo_url,
    status: enrollment.status,
    allergies: enrollment.allergies,
    medical_notes: enrollment.medical_notes,
    classroom: enrollment.classroom_name,
    age_group: enrollment.kindergarten_fee_groups?.group_name ?? enrollment.classroom_name,
    payment_status: enrollment.payment_status,
    monthly_fee: enrollment.monthly_fee,
    next_payment_due: enrollment.next_payment_due,
    debt_amount: enrollment.debt_amount
  }));
  const childrenById = new Map<string, any>();
  for (const child of enrollments) {
    if (child.id && !childrenById.has(child.id)) childrenById.set(child.id, child);
  }
  const children = Array.from(childrenById.values());
  const childIds = children.map((child) => child.id).filter(Boolean);
  const gardensById = new Map((family.gardens as any[]).map((garden) => [garden.id, garden]));
  const primaryChild = children[0] ?? null;
  const primaryGarden = primaryChild ? (gardensById.get(primaryChild.garden_id ?? primaryChild.kindergarten_id) as any) : null;
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    journalsRes,
    timelineRes,
    recordRes,
    notificationsRes,
    requestsRes,
    documentsRes,
    pickupRes,
    galleryRes,
    inspectionRes,
    cameraResult
  ] = await Promise.all([
    childIds.length
      ? supabase.from("child_daily_journals" as any).select("id,child_id,journal_date,meals,sleep_summary,mood,notes_to_parents,photo_urls,created_at").in("child_id", childIds).gte("journal_date", today).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    primaryChild
      ? supabase.from("child_timeline_events" as any).select("*").eq("child_id", primaryChild.id).eq("parent_visible", true).eq("internal_only", false).in("visibility", ["parent", "approved_parent"]).order("event_time", { ascending: false }).limit(14)
      : Promise.resolve({ data: [] }),
    primaryChild
      ? supabase.from("child_unified_records" as any).select("id,daily_summary,weekly_summary,parent_visible_summary,last_timeline_event_at").eq("child_id", primaryChild.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("notifications" as any).select("id,title,body,message,entity_type,status,read_at,created_at").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(30),
    childIds.length
      ? supabase.from("parent_child_requests" as any).select("id,child_id,request_type,content,status,created_at,response_text").or(`parent_profile_id.eq.${profile.id},child_id.in.(${childIds.join(",")})`).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    supabase.from("documents" as any).select("id,name,document_type,status,created_at,expires_at").eq("uploaded_by", profile.id).order("created_at", { ascending: false }).limit(30),
    childIds.length
      ? supabase.from("child_pickup_events" as any).select("id,child_id,pickup_time,status,picked_up_by_name").in("child_id", childIds).order("pickup_time", { ascending: false }).limit(8)
      : Promise.resolve({ data: [] }),
    family.gardenIds.length
      ? supabase.from("gallery_items" as any).select("id,title,media_type,file_url,created_at,child_ids").in("garden_id", family.gardenIds).eq("visible_to_parents", true).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [] }),
    family.gardenIds.length
      ? supabase.from("inspections" as any).select("id,completed_at,weighted_score,violation_count,status").in("garden_id", family.gardenIds).eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    getParentCameraListForProfile(supabase as any, profile)
  ]);

  const journals = (journalsRes.data ?? []) as any[];
  const primaryJournal = primaryChild ? journals.find((journal) => journal.child_id === primaryChild.id) : null;
  const timeline = ((timelineRes.data ?? []) as any[]).filter((event) => event.parent_visible && !event.internal_only && ["parent", "approved_parent"].includes(String(event.visibility)));
  const record = recordRes.data as any;
  const notifications = (notificationsRes.data ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const docs = (documentsRes.data ?? []) as any[];
  const pickupEvents = (pickupRes.data ?? []) as any[];
  const gallery = ((galleryRes.data ?? []) as any[]).filter((item) => {
    const itemChildIds = Array.isArray(item.child_ids) ? item.child_ids : [];
    return itemChildIds.length === 0 || itemChildIds.some((childId: string) => childIds.includes(childId));
  });
  const unreadNotifications = notifications.filter((item) => !item.read_at).length;
  const actionDocs = docs.filter((doc) => ["missing", "rejected", "expired", "pending_signature", "requires_approval"].includes(String(doc.status)));
  const openRequests = requests.filter((request) => !["handled", "closed", "rejected"].includes(String(request.status)));
  const paymentAttention = children.filter(paymentNeedsAttention);
  const availableCameras = cameraResult.cameras.length;
  const unavailableCameras = cameraResult.debug.missingPlaybackSourceCount + cameraResult.debug.hiddenBecauseStatus + cameraResult.debug.hiddenBecauseParentViewingFlag;
  const safetyScore = inspectionRes.data?.weighted_score ?? primaryGarden?.last_inspection_score ?? null;
  const latestUpdate = timeline[0]?.event_time ?? primaryJournal?.created_at ?? record?.last_timeline_event_at;
  const dailySummary = record?.parent_visible_summary ?? record?.daily_summary ?? parentDailySummary(primaryChild?.full_name ?? "הילד/ה", primaryJournal, timeline);
  const weeklySummary = record?.weekly_summary ?? `${timeline.filter((event) => event.event_time && new Date(event.event_time) >= weekStart).length} עדכוני ציר נצפו השבוע. סיכום מלא יופיע כאשר הגן ישתף מספיק עדכונים.`;
  const photoCount = gallery.filter((item) => item.media_type === "image").length + journals.reduce((sum, journal) => sum + (Array.isArray(journal.photo_urls) ? journal.photo_urls.length : 0), 0);
  const notificationCategories = [
    { label: "עדכוני ילד", count: notifications.filter((item) => `${item.title ?? ""} ${item.body ?? ""} ${item.message ?? ""}`.includes("ילד")).length },
    { label: "הודעות", count: openRequests.length },
    { label: "מסמכים", count: actionDocs.length },
    { label: "בטיחות", count: notifications.filter((item) => `${item.title ?? ""} ${item.body ?? ""} ${item.entity_type ?? ""}`.includes("בטיחות")).length },
    { label: "תשלומים", count: paymentAttention.length },
    { label: "פיקוח", count: inspectionRes.data ? 1 : 0 }
  ];
  const actionItems = [
    unreadNotifications ? { title: "יש עדכונים שלא נקראו", text: `${unreadNotifications} עדכונים מחכים לך`, href: "/dashboard/parent/notifications", tone: "warn" } : null,
    actionDocs.length ? { title: "מסמכים לטיפול", text: `${actionDocs.length} מסמכים דורשים אישור או השלמה`, href: "/dashboard/parent/documents", tone: "warn" } : null,
    paymentAttention.length ? { title: "תשלום לבדיקה", text: `${paymentAttention.length} פריטים כספיים דורשים תשומת לב`, href: "/dashboard/parent/payments", tone: "warn" } : null,
    openRequests.length ? { title: "פניות פתוחות", text: `${openRequests.length} פניות עדיין בטיפול`, href: "/dashboard/parent/messages", tone: "good" } : null,
    timeline.length === 0 && primaryChild ? { title: "ממתינים לעדכון יומי", text: "הגן עדיין לא שיתף ציר יום מאושר", href: "/dashboard/parent/messages", tone: "default" } : null
  ].filter(Boolean) as Array<{ title: string; text: string; href: string; tone: string }>;
  const smartFeed = [
    ...timeline.slice(0, 5).map((event) => ({
      id: `timeline-${event.id}`,
      title: event.title,
      text: event.summary_safe ?? event.description ?? "עדכון מאושר מהגן",
      href: primaryChild ? `/dashboard/parent/children/${primaryChild.id}/timeline` : "/dashboard/parent/family-home",
      time: event.event_time,
      kind: timelineCategoryLabel(event.event_category),
      tone: timelineTone(event.event_category, event.safety_relevance)
    })),
    ...gallery.slice(0, 4).map((item) => ({
      id: `gallery-${item.id}`,
      title: item.title ?? "תמונה חדשה מהגן",
      text: "רגע משפחתי שהגן שיתף",
      href: "/dashboard/parent/gallery",
      time: item.created_at,
      kind: "תמונה",
      tone: "good"
    })),
    ...notifications.slice(0, 5).map((item) => ({
      id: `notification-${item.id}`,
      title: item.title ?? "עדכון חדש",
      text: item.body ?? item.message ?? "עדכון שמחכה לך",
      href: "/dashboard/parent/notifications",
      time: item.created_at,
      kind: categoryLabelForFeed(item),
      tone: item.read_at ? "default" : "warn"
    }))
  ].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 8);

  return (
    <DashboardShell role="parent" title="בית משפחתי" appHome>
      <ParentAppFrame active="home" avatarUrl={(profile as any).profile_image_url ?? null}>
      <div className="family-home-2">
        {primaryChild ? (
          <section className="family-home-hero">
            <div className="family-home-photo">
              <Avatar name={primaryChild.full_name} src={primaryChild.photo_url} size="lg" />
            </div>
            <div>
              <p className="eyebrow">היום של {primaryChild.full_name}</p>
              <h1>{dailySummary}</h1>
              <div className="parent-status-row">
                <StatusBadge tone={toneForChild(primaryChild.status)}>{childStatusLabel(primaryChild.status)}</StatusBadge>
                <StatusBadge tone="good">{primaryGarden?.name ?? "גן משויך"}</StatusBadge>
                <StatusBadge tone={safetyScore ? "good" : "warn"}>{safetyScore ? `אמון ${safetyScore}/100` : "ציון אמון טרם פורסם"}</StatusBadge>
                <StatusBadge tone={latestUpdate ? "good" : "warn"}>{latestUpdate ? `עודכן ${eventDateText(latestUpdate)}` : "ממתין לעדכון"}</StatusBadge>
              </div>
            </div>
            <div className="parent-hero-actions">
              <Link className="button primary" href="/dashboard/parent/messages">הודעה לגן</Link>
              <Link className="button secondary" href={`/dashboard/parent/children/${primaryChild.id}/timeline`}>ציר היום</Link>
            </div>
          </section>
        ) : (
          <EmptyState title="עדיין אין ילד משויך" text="אחרי אישור הגן, הבית המשפחתי יציג עדכונים, הודעות ותמונות במקום אחד." action={<Link className="button primary" href="/parent-onboarding">השלמת פרטים</Link>} />
        )}

        <section className="parent-metric-strip">
          <RoleMetricCard label="ציר היום" value={timeline.length} hint="עדכונים מאושרים" tone={timeline.length ? "good" : "warn"} href={primaryChild ? `/dashboard/parent/children/${primaryChild.id}/timeline` : "/dashboard/parent/family-home"} />
          <RoleMetricCard label="צריך פעולה" value={unreadNotifications + actionDocs.length + paymentAttention.length} hint="התראות, מסמכים ותשלומים" tone={unreadNotifications + actionDocs.length + paymentAttention.length ? "warn" : "good"} href="/dashboard/parent/notifications" />
          <RoleMetricCard label="תמונות" value={photoCount} hint="שיתופים משפחתיים" tone={photoCount ? "good" : "default"} href="/dashboard/parent/gallery" />
          <RoleMetricCard label="מצלמות" value={availableCameras} hint={unavailableCameras ? "חלק ממתינות לאישור/חיבור" : "צפייה מורשית"} tone={availableCameras ? "good" : "warn"} href="/dashboard/parent/cameras" />
        </section>

        <section className="parent-attention-center">
          <div>
            <p className="eyebrow">מה דורש תשומת לב?</p>
            <h2>המערכת מרכזת עבורך את החשוב.</h2>
            <p>בלי לחפש: מסמכים, הודעות, תשלומים ועדכונים רגישים מופיעים כאן לפי חשיבות.</p>
          </div>
          <div className="parent-attention-list">
            {actionItems.length ? actionItems.map((item) => (
              <Link className={`parent-attention-item ${item.tone}`} href={item.href} key={item.title}>
                <AlertCircle size={18} />
                <div><strong>{item.title}</strong><span>{item.text}</span></div>
              </Link>
            )) : <div className="parent-attention-item good"><CheckCircle2 size={18} /><div><strong>אין משימות פתוחות</strong><span>הכול מסודר כרגע. עדכונים חדשים יופיעו כאן.</span></div></div>}
          </div>
        </section>

        <section className="family-home-layout">
          <article className="family-feed-card">
            <div className="section-heading">
              <h2>ציר היום</h2>
              <p>פיד קצר של עדכונים שאושרו להורים.</p>
            </div>
            <div className="family-timeline-feed">
              {timeline.length ? timeline.slice(0, 8).map((item) => (
                <Link className={`parent-feed-item ${timelineTone(item.event_category, item.safety_relevance)}`} href={`/dashboard/parent/children/${primaryChild.id}/timeline`} key={item.id}>
                  <time>{eventTimeText(item.event_time)}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.summary_safe ?? item.description ?? "עדכון מהגן"}</span>
                    <small>{timelineCategoryLabel(item.event_category)}</small>
                  </div>
                </Link>
              )) : <EmptyState title="אין עדכונים מאושרים עדיין" text="כשהגן ישתף פעילות, ארוחה, שינה או עדכון בריאותי, זה יופיע כאן." />}
            </div>
          </article>

          <aside className="family-insight-card">
            <Sparkles />
            <h2>סיכום שבועי למשפחה</h2>
            <p>{weeklySummary}</p>
            <div className="parent-question-list">
              <Link href={primaryChild ? `/dashboard/parent/children/${primaryChild.id}/timeline` : "/dashboard/parent/family-home"}>איך עבר היום?</Link>
              <Link href="/dashboard/parent/daily-journal">האם יש עדכון אוכל או שינה?</Link>
              <Link href="/dashboard/parent/notifications">האם נדרשת פעולה?</Link>
              <Link href="/dashboard/parent/messages">לשאול את הגן</Link>
            </div>
          </aside>
        </section>

        <section className="family-smart-feed">
          <div className="section-heading">
            <h2>הפיד המשפחתי</h2>
            <p>תמונות, עדכונים, הודעות ותצפיות שאושרו להורים, מסודרים לפי מה שחשוב עכשיו.</p>
          </div>
          <div className="family-smart-feed-grid">
            {smartFeed.length ? smartFeed.map((item) => (
              <Link className={`family-smart-feed-item ${item.tone}`} href={item.href} key={item.id}>
                <span>{item.kind}</span>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
                <small>{item.time ? eventDateText(item.time) : "חדש"}</small>
              </Link>
            )) : <ParentEmptyState title="הפיד עדיין ריק" text="כאשר הגן ישתף תמונות, פעילות, הודעות או עדכונים מאושרים, הם יופיעו כאן." />}
          </div>
        </section>

        <section className="family-action-center">
          <ActionCard title="דיווח היעדרות" text="עדכון קצר לגן" href="/dashboard/parent/messages" icon={UserRoundCheck} tone="good" />
          <ActionCard title="שליחת הודעה" text="שיחה מסודרת עם הגן" href="/dashboard/parent/messages" icon={MessageCircle} tone="good" />
          <ActionCard title="אישור מסמך" text="מסמכים שממתינים לך" href="/dashboard/parent/documents" icon={FileText} tone={actionDocs.length ? "warn" : "default"} />
          <ActionCard title="איסוף" text="מורשים והיסטוריה" href="/dashboard/parent/pickup" icon={ShieldCheck} />
          <ActionCard title="פרטי הילד" text="עדכון מידע חשוב" href="/parent-onboarding" icon={Baby} />
          <ActionCard title="תשלומים" text="יתרה וחשבוניות" href="/dashboard/parent/payments" icon={WalletCards} tone={paymentAttention.length ? "warn" : "default"} />
        </section>

        <section className="family-home-layout">
          <article className="family-hub-card">
            <div className="section-heading">
              <h2>מרכז עדכונים</h2>
              <p>מסודר לפי נושא כדי להפחית רעש.</p>
            </div>
            <div className="family-category-grid">
              {notificationCategories.map((category) => <Link href="/dashboard/parent/notifications" key={category.label}>{category.label}<b>{category.count}</b></Link>)}
            </div>
            <div className="family-mini-list">
              {notifications.slice(0, 4).map((item) => <Link href="/dashboard/parent/notifications" key={item.id}><strong>{item.title ?? "עדכון"}</strong><span>{item.body ?? item.message ?? "עדכון חדש מהמערכת"}</span></Link>)}
              {!notifications.length ? <span className="empty-inline">אין התראות חדשות.</span> : null}
            </div>
          </article>

          <article className="family-hub-card">
            <div className="section-heading">
              <h2>אמון ובטיחות</h2>
              <p>רק מידע שאושר להצגת הורים.</p>
            </div>
            <div className="parent-trust-list">
              <span>תג אמון <b>{primaryGarden?.safe_status === "suspended" ? "בהשהיה" : "במעקב"}</b></span>
              <span>ציון בטיחות <b>{safetyScore ? `${safetyScore}/100` : "לא פורסם"}</b></span>
              <span>ביקורת אחרונה <b>{safeDate(inspectionRes.data?.completed_at)}</b></span>
              <span>שיפורים שהושלמו <b>{inspectionRes.data?.violation_count ? "בתהליך" : "אין פתוחים"}</b></span>
            </div>
            <Link className="button secondary" href="/dashboard/parent/trust-center">פתיחת מרכז אמון</Link>
          </article>
        </section>

        <section className="family-experience-grid">
          <article>
            <Image />
            <h2>גלריה</h2>
            <p>{gallery.length ? `${gallery.length} רגעים זמינים לצפייה.` : "כאשר הגן ישתף תמונות, הן יופיעו כאן."}</p>
            <Link className="button secondary tiny" href="/dashboard/parent/gallery">פתיחה</Link>
          </article>
          <article>
            <Camera />
            <h2>מצלמות</h2>
            <p>{availableCameras ? `${availableCameras} אזורי צפייה מאושרים.` : "אין צפייה זמינה כרגע."}</p>
            <Link className="button secondary tiny" href="/dashboard/parent/cameras">פתיחה</Link>
          </article>
          <article>
            <HeartPulse />
            <h2>בריאות ועדכונים</h2>
            <p>{primaryJournal ? "יש עדכון יומי מהגן." : "ממתין לעדכון יומי מהגן."}</p>
            <Link className="button secondary tiny" href="/dashboard/parent/daily-journal">פתיחה</Link>
          </article>
          <article>
            <CheckCircle2 />
            <h2>איסוף</h2>
            <p>{pickupEvents[0]?.pickup_time ? `איסוף אחרון: ${eventDateText(pickupEvents[0].pickup_time)}` : "היסטוריית איסוף תופיע כאן."}</p>
            <Link className="button secondary tiny" href="/dashboard/parent/pickup">פתיחה</Link>
          </article>
          <article>
            <Bell />
            <h2>מעורבות</h2>
            <p>{unreadNotifications} התראות שלא נקראו, {openRequests.length} פניות פתוחות.</p>
            <Link className="button secondary tiny" href="/dashboard/parent/notifications">פתיחה</Link>
          </article>
          <article>
            <WalletCards />
            <h2>תשלומים</h2>
            <p>{paymentAttention.length ? `${paymentAttention.length} פריטים לטיפול.` : "אין יתרות חריגות."}</p>
            <Link className="button secondary tiny" href="/dashboard/parent/payments">פתיחה</Link>
          </article>
        </section>

        <section className="family-privacy-note">
          <ShieldCheck />
          <div>
            <h2>פרטיות לפני הכול</h2>
            <p>הבית המשפחתי מציג רק מידע שאושר להורה: ציר ילד, הודעות, מסמכים, תמונות, תשלומים וצפייה מורשית. אין כאן אירועים פנימיים, חקירות או נתוני תצפיתן גולמיים.</p>
          </div>
        </section>
      </div>
      </ParentAppFrame>
    </DashboardShell>
  );
}
