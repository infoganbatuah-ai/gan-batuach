import Link from "next/link";
import { AlertTriangle, Bell, CalendarCheck, Camera, ClipboardCheck, FileClock, HeartPulse, MessageSquare, Plus, Shirt, ShieldCheck, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { ReadyStatusCard } from "@/components/ready-status-card";
import { SimpleCommandCenter } from "@/components/simple-command-center";
import { LiveDayFlow } from "@/components/live-day-flow";
import { ForgotSomethingButton } from "@/components/forgot-something-button";
import { EndOfDayChecklist } from "@/components/end-of-day-checklist";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const quickActions = [
  { href: "/dashboard/garden/onboarding", label: "קליטת הורה/ילד", icon: Plus, help: "יצירת הורה, אשף ילד ואישור תלמיד." },
  { href: "/dashboard/garden/onboarding", label: "הוספת הורה", icon: UserPlus, help: "יוצר Auth, פרופיל ולוג ביקורת." },
  { href: "/dashboard/garden/onboarding", label: "הוספת צוות", icon: UsersRound, help: "עובד לא יופעל בלי מסמכי חובה." },
  { href: "/dashboard/garden/attendance", label: "סימון נוכחות", icon: CalendarCheck, help: "נוכחות ילדים וצוות עם לוג שינוי." },
  { href: "/dashboard/garden/messages", label: "שליחת הודעה", icon: MessageSquare, help: "תקשורת מתועדת מול הורים/פקח." },
  { href: "/dashboard/garden/cameras", label: "ניהול מצלמות", icon: Camera, help: "חיבור DVR/RTSP והרשאות הורים." }
];

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [gardenRes, childrenRes, staffRes, parentsRes, tasksRes, leadsRes, complaintsRes, violationsRes, camerasRes, aiRes, documentsRes, messagesRes, inspectionRes, attendanceRes, unpaidRes, dueInspectionRes, financeChildrenRes, changeClothesRes, healthAlertsRes, parentRequestsRes, staffDocsRes, incidentsRes, documentApprovalsRes, pendingParentCompletionRes, pendingApprovalRes, childJournalsRes] = await Promise.all([
    supabase.from("gardens" as any).select("id, name, city, logo_url, image_url, safe_status, first_inspection_due_at, last_inspection_score").eq("id", gardenId ?? "").maybeSingle(),
    supabase.from("children").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("staff").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("parents").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""),
    supabase.from("tasks").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done"),
    supabase.from("leads").select("id, parent_name, phone, child_name, child_age, status, created_at", { count: "exact" }).eq("garden_id", gardenId ?? "").eq("lead_type", "parent").limit(5),
    supabase.from("complaints").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("violations").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done"),
    supabase.from("camera_streams").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "online"),
    supabase.from("ai_events").select("*", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("documents").select("name, document_type, expires_at, status").eq("garden_id", gardenId ?? "").limit(4),
    supabase.from("messages").select("id, subject, content, body, created_at, status").eq("garden_id", gardenId ?? "").eq("recipient_id", profile.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("inspections" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("status", "done"),
    supabase.from("attendance" as any).select("id, status, pickup_name", { count: "exact" }).eq("garden_id", gardenId ?? "").eq("attendance_date", new Date().toISOString().slice(0, 10)),
    supabase.from("children" as any).select("id, monthly_fee, payment_status", { count: "exact" }).eq("garden_id", gardenId ?? "").in("payment_status", ["overdue", "unpaid", "partial"]),
    supabase.from("required_inspections" as any).select("due_at").eq("garden_id", gardenId ?? "").neq("status", "done").order("due_at").limit(1).maybeSingle(),
    supabase.from("children" as any).select("monthly_fee").eq("garden_id", gardenId ?? ""),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("has_change_clothes", false),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").or("allergies.not.is.null,medical_notes.not.is.null,regular_medications.not.is.null"),
    supabase.from("parent_child_requests" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["new", "viewed"]),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["missing", "expired", "rejected"]),
    supabase.from("incident_reports" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed"),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("status", "pending_review"),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("status", "pending_parent_completion"),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("status", "pending_manager_approval"),
    supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood").eq("garden_id", gardenId ?? "").eq("journal_date", new Date().toISOString().slice(0, 10))
  ]);
  const garden = gardenRes.data as any;
  const attendanceRows = (attendanceRes.data ?? []) as any[];
  const parentLeadRows = (leadsRes.data ?? []) as any[];
  const newLeadCount = parentLeadRows.filter((lead) => ["new", "new_parent_lead"].includes(lead.status)).length;
  const presentToday = attendanceRows.filter((row) => row.status === "present").length;
  const missingToday = Math.max(0, (childrenRes.count ?? 0) - presentToday);
  const missingAttendance = Math.max(0, (childrenRes.count ?? 0) - attendanceRows.length);
  const journalRows = (childJournalsRes.data ?? []) as any[];
  const withMealUpdate = journalRows.filter((row) => Array.isArray(row.meals) && row.meals.length > 0).length;
  const withSleepUpdate = journalRows.filter((row) => Boolean(row.sleep_summary)).length;
  const withoutMeal = Math.max(0, (childrenRes.count ?? 0) - withMealUpdate);
  const withoutSleep = Math.max(0, (childrenRes.count ?? 0) - withSleepUpdate);
  const pickupPending = Math.max(0, presentToday - attendanceRows.filter((row) => row.pickup_name || row.status === "picked_up").length);
  const inspectionDays = dueInspectionRes.data?.due_at ? Math.ceil((new Date((dueInspectionRes.data as any).due_at).getTime() - Date.now()) / 86400000) : null;
  const expectedRevenue = ((financeChildrenRes.data ?? []) as any[]).reduce((sum, child) => sum + Number(child.monthly_fee ?? 0), 0);
  const morningItems = [
    { title: "ילדים חסרים היום", count: missingToday, description: "בדקי מי טרם סומן או נעדר ללא עדכון", href: "/dashboard/garden/attendance", tone: missingToday ? "warn" as const : "good" as const, icon: CalendarCheck },
    { title: "חסר בגדים להחלפה", count: changeClothesRes.count ?? 0, description: "ילדים צעירים שצריך לבקש מההורים להשלים", href: "/dashboard/garden/children?view=attention", tone: (changeClothesRes.count ?? 0) ? "bad" as const : "good" as const, icon: Shirt },
    { title: "התראות בריאות/אלרגיה", count: healthAlertsRes.count ?? 0, description: "ילדים עם מידע רפואי שצריך לראות לפני היום", href: "/dashboard/garden/children?view=attention", tone: (healthAlertsRes.count ?? 0) ? "warn" as const : "good" as const, icon: HeartPulse },
    { title: "תשלומים דורשים טיפול", count: unpaidRes.count ?? 0, description: "גבייה חסרה, חלקית או באיחור", href: "/dashboard/garden/finance?filter=due", tone: (unpaidRes.count ?? 0) ? "bad" as const : "good" as const, icon: WalletCards },
    { title: "פניות הורים פתוחות", count: parentRequestsRes.count ?? 0, description: "בקשות שצריך לסמן כטופלו או להשיב עליהן", href: "/dashboard/garden/children?view=attention", tone: (parentRequestsRes.count ?? 0) ? "warn" as const : "good" as const, icon: MessageSquare },
    { title: "הודעות שלא נקראו", count: messagesRes.data?.length ?? 0, description: "הודעות שממתינות למנהלת/בעלים", href: "/dashboard/garden/messages", tone: (messagesRes.data?.length ?? 0) ? "warn" as const : "good" as const, icon: Bell },
    { title: "מסמכי צוות חסרים", count: staffDocsRes.count ?? 0, description: "עובדים עם מסמך חסר/דחוי/פג תוקף", href: "/dashboard/garden/staff", tone: (staffDocsRes.count ?? 0) ? "bad" as const : "good" as const, icon: FileClock },
    { title: "אירועים למעקב", count: incidentsRes.count ?? 0, description: "אירועים שלא נסגרו ודורשים טיפול", href: "/dashboard/garden/incidents", tone: (incidentsRes.count ?? 0) ? "bad" as const : "good" as const, icon: AlertTriangle },
    { title: "מסמכים לאישור", count: documentApprovalsRes.count ?? 0, description: "מסמכים שמחכים לבדיקה ואישור", href: "/dashboard/garden/documents", tone: (documentApprovalsRes.count ?? 0) ? "warn" as const : "good" as const, icon: ClipboardCheck },
    { title: "פיקוח קרוב", count: inspectionDays === null ? "אין" : `${inspectionDays} ימים`, description: "הכנה לביקורת הקרובה", href: "/dashboard/garden/inspections", tone: inspectionDays !== null && inspectionDays <= 5 ? "warn" as const : "good" as const, icon: ShieldCheck }
  ];
  const readyItems = [
    { label: "מסמכי גן", ok: (documentsRes.data ?? []).length > 0, help: "לפחות מסמך אחד הועלה ונמצא במעקב." },
    { label: "צוות מאושר", ok: (staffRes.count ?? 0) > 0, help: "יש אנשי צוות פעילים/בתהליך אישור." },
    { label: "ביקורת ראשונה", ok: (inspectionRes.count ?? 0) > 0, help: "בוצעה לפחות ביקורת אחת." },
    { label: "ילדים פעילים", ok: (childrenRes.count ?? 0) > 0, help: "יש כרטיסי ילדים פעילים." },
    { label: "הורים משויכים", ok: (parentsRes.count ?? 0) > 0, help: "יש הורים מחוברים למערכת." },
    { label: "מצלמות מוגדרות", ok: (camerasRes.count ?? 0) === 0, help: "אין תקלות מצלמה פתוחות." },
    { label: "מדיניות ותקנונים", ok: true, help: "שער אישור תקנון פעיל בכניסה." }
  ];
  const flowCounts = {
    missingAttendance,
    missingClothes: changeClothesRes.count ?? 0,
    parentRequests: parentRequestsRes.count ?? 0,
    withoutMeal,
    withoutSleep,
    healthAlerts: healthAlertsRes.count ?? 0,
    openIncidents: incidentsRes.count ?? 0,
    pickupPending,
    openTasks: tasksRes.count ?? 0
  };
  const forgotItems = [
    { label: "ילדים בלי עדכון ארוחה", count: withoutMeal, href: "/dashboard/garden/child-journal", action: "עדכני ארוחה מהירה", severity: "warn" as const },
    { label: "ילדים בלי עדכון שינה", count: withoutSleep, href: "/dashboard/garden/child-journal", action: "עדכני שינה", severity: "warn" as const },
    { label: "פניות הורים לא פתורות", count: parentRequestsRes.count ?? 0, href: "/dashboard/garden/children?view=attention", action: "השיבי או סמני טופל", severity: "warn" as const },
    { label: "תשלומים לטיפול", count: unpaidRes.count ?? 0, href: "/dashboard/garden/finance?filter=due", action: "פתחי גבייה", severity: "bad" as const },
    { label: "נוכחות חסרה", count: missingAttendance, href: "/dashboard/garden/attendance", action: "סמני נוכחות", severity: "warn" as const },
    { label: "אירועים פתוחים", count: incidentsRes.count ?? 0, href: "/dashboard/garden/incidents", action: "סגרי טיפול", severity: "bad" as const },
    { label: "מסמכי צוות חסרים", count: staffDocsRes.count ?? 0, href: "/dashboard/garden/staff", action: "בקשי מסמך", severity: "bad" as const }
  ];
  const endDayItems = [
    { label: "כל הילדים עודכנו ביומן", ok: withoutMeal === 0 && withoutSleep === 0, count: withoutMeal + withoutSleep },
    { label: "כל האירועים טופלו", ok: (incidentsRes.count ?? 0) === 0, count: incidentsRes.count ?? 0 },
    { label: "כל ההודעות נקראו", ok: (messagesRes.data?.length ?? 0) === 0, count: messagesRes.data?.length ?? 0 },
    { label: "איסוף הסתיים", ok: pickupPending === 0, count: pickupPending },
    { label: "פניות הורים נסגרו", ok: (parentRequestsRes.count ?? 0) === 0, count: parentRequestsRes.count ?? 0 }
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title={profile.role === "owner" ? "דשבורד בעלים" : "ממשק גן"}>
      <div className="dashboard-hero-card garden-hero-card premium-identity-hero ultimate-garden-hero">
        <div>
          <p className="eyebrow">ניהול יומי</p>
          <h1>בוקר טוב, {profile.full_name ?? garden?.name ?? "הגן שלך"}.</h1>
          <p>{garden?.city ? `${garden.city} · ` : ""}ילדים היום: {childrenRes.count ?? 0} · נוכחים: {presentToday} · חסרים: {missingToday} · הודעות: {messagesRes.data?.length ?? 0}</p>
        </div>
        <Avatar name={garden?.name} src={garden?.logo_url ?? garden?.image_url} size="lg" />
        <span className={aiRes.count || complaintsRes.count ? "pill bad" : "pill good"}><ShieldCheck size={15} /> {aiRes.count || complaintsRes.count ? "דורש טיפול" : "יום רגוע"}</span>
      </div>

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="ילדים היום" value={childrenRes.count ?? 0} tone="good" />
        <StatCard label="נוכחים" value={presentToday} tone="good" />
        <StatCard label="חסרים" value={missingToday} tone={missingToday ? "warn" : "good"} />
        <StatCard label="תשלומים לטיפול" value={unpaidRes.count ?? 0} tone={unpaidRes.count ? "bad" : "good"} />
        <StatCard label="פיקוח" value={inspectionDays === null ? "טרם" : `${inspectionDays} ימים`} tone={inspectionDays !== null && inspectionDays <= 5 ? "warn" : "good"} />
        <StatCard label="הודעות ממתינות" value={messagesRes.data?.length ?? 0} tone={messagesRes.data?.length ? "warn" : "good"} />
        <StatCard label="אירועים דחופים" value={(complaintsRes.count ?? 0) + (aiRes.count ?? 0)} tone={(complaintsRes.count ?? 0) + (aiRes.count ?? 0) ? "bad" : "good"} />
        <StatCard label="משימות פתוחות" value={tasksRes.count ?? 0} tone="warn" />
        <StatCard label="לידים חדשים" value={newLeadCount} tone={newLeadCount ? "warn" : "good"} />
        <StatCard label="הורה משלים פרטים" value={pendingParentCompletionRes.count ?? 0} tone={pendingParentCompletionRes.count ? "warn" : "good"} />
        <StatCard label="ילדים לאישור" value={pendingApprovalRes.count ?? 0} tone={pendingApprovalRes.count ? "warn" : "good"} />
      </div>
      <SimpleCommandCenter title="מה דורש טיפול היום?" subtitle="המערכת מרכזת עבורך את הדברים שמנהלת גן צריכה לדעת בבוקר, בלי לחפש בתפריטים." items={morningItems} />
      <LiveDayFlow counts={flowCounts} />
      {profile.role === "owner" ? <section className="grid cols-4 dashboard-kpis owner-kpis"><StatCard label="הכנסה צפויה" value={`₪${expectedRevenue}`} tone="good" /><StatCard label="ציון גן" value={garden?.last_inspection_score ?? "-"} /><StatCard label="ציון צוות" value={staffRes.count ? "פעיל" : "חסר"} tone={staffRes.count ? "good" : "warn"} /><StatCard label="סיכוני גבייה" value={unpaidRes.count ?? 0} tone={unpaidRes.count ? "bad" : "good"} /></section> : null}

      <section className="dashboard-section">
        <div className="section-heading"><h2>פעולות מהירות</h2><p>כל פעולה פותחת תהליך מתועד עם הרשאות ולוגים.</p></div>
        <div className="quick-actions-grid">
          {quickActions.map((action) => (
            <Link className="quick-action" href={action.href} key={action.label}>
              <action.icon size={22} />
              <strong>{action.label}</strong>
              <span>{action.help}</span>
            </Link>
          ))}
          <Link className="quick-action finance-action" href="/dashboard/garden/finance"><WalletCards size={22} /><strong>מרכז כספים</strong><span>גבייה חודשית, איחורים, הנחות ודוחות.</span></Link>
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <ReadyStatusCard items={readyItems} />
        <article className="card action-panel"><div className="section-heading"><h2>יום עבודה בקליק</h2><p>מסלולים מהירים לניהול היומי שהכי חשוב לגן.</p></div><div className="quick-actions-grid compact"><Link className="quick-action" href="/dashboard/garden/child-journal">יומן ילד<span>עדכון יומי להורים</span></Link><Link className="quick-action" href="/dashboard/garden/health">בריאות ותרופות<span>אלרגיות ואישורים</span></Link><Link className="quick-action" href="/dashboard/garden/pickup">איסוף והחזרה<span>מורשים ו-GPS</span></Link><Link className="quick-action" href="/dashboard/garden/incidents">דיווח אירוע<span>ציר טיפול ותיעוד</span></Link></div></article>
      </section>
      <EndOfDayChecklist items={endDayItems} />

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2>הודעות אדמין</h2><p>הודעות שנשלחו מהאדמין למנהלת או לבעלים.</p></div>{(messagesRes.data ?? []).length === 0 ? <div className="empty-mini">אין הודעות חדשות.</div> : (messagesRes.data ?? []).map((message: any) => <div className="list-item" key={message.id}><div><strong>{message.subject}</strong><span>{message.content ?? message.body}</span></div><span className="pill">{message.status ?? "unread"}</span></div>)}</article>
        <article className="card action-panel"><div className="section-heading"><h2>לידים חדשים מהורים</h2><p>אשרו, דחו, צרו קשר או בקשו פרטים נוספים.</p></div>{(leadsRes.data ?? []).length === 0 ? <div className="empty-mini">אין לידים חדשים כרגע.</div> : (leadsRes.data ?? []).map((lead: any) => <div className="list-item" key={lead.id}><div><strong>{lead.parent_name}</strong><span>{lead.phone} · {lead.child_name ?? "ילד/ה"} · {lead.child_age ?? "גיל לא צוין"}</span></div><span className="pill warn">{lead.status}</span></div>)}</article>
        <article className="card action-panel"><div className="section-heading"><h2>ציות ותפעול</h2><p>פריטים שדורשים טיפול לפני ביקורת או במהלך החודש.</p></div><div className="risk-list"><div><Bell /> תלונות פתוחות <b>{complaintsRes.count ?? 0}</b></div><div><ClipboardCheck /> ליקויי ביקורת <b>{violationsRes.count ?? 0}</b></div><div><Camera /> תקלות מצלמה <b>{camerasRes.count ?? 0}</b></div><div><FileClock /> מסמכים למעקב <b>{documentsRes.data?.length ?? 0}</b></div></div></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>מסמכים שפג תוקפם בקרוב</h2><p>ביטוח, בטיחות, תברואה, עזרה ראשונה, פרטיות ואישורי מצלמות.</p></div>
        <div className="document-strip">{(documentsRes.data ?? []).length === 0 ? <div className="empty-mini">אין מסמכים להצגה.</div> : (documentsRes.data ?? []).map((doc: any) => <div className="document-chip" key={`${doc.name}-${doc.document_type}`}><strong>{doc.name}</strong><span>{doc.document_type} · {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "ללא תוקף"}</span></div>)}</div>
      </section>
      <ForgotSomethingButton items={forgotItems} />
    </DashboardShell>
  );
}
