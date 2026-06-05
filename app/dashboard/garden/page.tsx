import Link from "next/link";
import { AlertTriangle, Bell, CalendarCheck, Camera, ClipboardCheck, FileClock, HeartPulse, MessageSquare, Shirt, ShieldCheck, UserPlus, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { SimpleCommandCenter } from "@/components/simple-command-center";
import { LiveDayFlow } from "@/components/live-day-flow";
import { ForgotSomethingButton } from "@/components/forgot-something-button";
import { EndOfDayChecklist } from "@/components/end-of-day-checklist";
import { requireRole } from "@/lib/auth";
import { generateSmartInsights, syncSmartInsights, createNotificationsForUrgentInsights } from "@/lib/domain/smart-kindergarten-engine";
import { createClient } from "@/lib/supabase/server";

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
    supabase.from("children" as any).select("id, monthly_fee, payment_status", { count: "exact" }).eq("garden_id", gardenId ?? "").in("payment_status", ["overdue", "unpaid", "partial", "failed", "not_transferred"]),
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
  const [incomingTransfersRes, outgoingTransfersRes] = await Promise.all([
    supabase.from("child_transfer_requests" as any).select("id", { count: "exact", head: true }).eq("target_garden_id", gardenId ?? "").in("status", ["pending_new_kindergarten_review", "missing_details"]),
    supabase.from("child_transfer_requests" as any).select("id", { count: "exact", head: true }).eq("current_garden_id", gardenId ?? "").in("status", ["pending_new_kindergarten_review", "pending_current_kindergarten_response", "current_kindergarten_requested_call", "current_kindergarten_flagged"])
  ]);
  const transferRequestsCount = (incomingTransfersRes.count ?? 0) + (outgoingTransfersRes.count ?? 0);
  const roleLabel = profile.role === "owner" ? "בעלים" : "מנהלת גן";
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
  const failedPayments = ((unpaidRes.data ?? []) as any[]).filter((child) => ["failed", "not_transferred"].includes(child.payment_status)).length;
  const latePayments = Math.max(0, (unpaidRes.count ?? 0) - failedPayments);
  let smartInsights: Awaited<ReturnType<typeof generateSmartInsights>> = [];
  try {
    smartInsights = await syncSmartInsights(supabase as any, await generateSmartInsights(supabase as any, profile));
    await createNotificationsForUrgentInsights(supabase as any, smartInsights);
  } catch (error) {
    console.error("[garden-dashboard] smart insights failed", { garden_id: gardenId, error });
    smartInsights = [];
  }
  const smartCommandItems = smartInsights.slice(0, 9).map((item) => ({
    title: item.title,
    count: item.severity === "urgent" || item.severity === "critical" ? "דחוף" : item.severity === "warning" ? "כדאי" : "חדש",
    description: item.description,
    href: item.action_url,
    tone: item.severity === "urgent" || item.severity === "critical" ? "bad" as const : item.severity === "warning" ? "warn" as const : "good" as const,
    icon: item.category === "מצלמות" ? Camera : item.category === "כספים" ? WalletCards : item.category === "מסמכים" ? FileClock : item.category === "הורים" ? MessageSquare : item.category === "פיקוח" ? ShieldCheck : AlertTriangle
  }));
  const morningItems = [
    { title: "ילדים שלא הגיעו", count: missingToday, description: "פתחי נוכחות מסוננת לילדים שלא סומנו או נעדרים", href: "/dashboard/garden/attendance?filter=missing", tone: missingToday ? "warn" as const : "good" as const, icon: CalendarCheck },
    { title: "ילדים בלי עדכון ארוחה", count: withoutMeal, description: "עדכני ארוחה בצ׳יפים מהירים", href: "/dashboard/garden/child-journal?missing=meal", tone: withoutMeal ? "warn" as const : "good" as const, icon: HeartPulse },
    { title: "ילדים בלי עדכון שינה", count: withoutSleep, description: "עדכני שינה בלי לפתוח טופס ארוך", href: "/dashboard/garden/child-journal?missing=sleep", tone: withoutSleep ? "warn" as const : "good" as const, icon: HeartPulse },
    { title: "חסר בגדים להחלפה", count: changeClothesRes.count ?? 0, description: "ילדים צעירים שצריך לבקש מההורים להשלים", href: "/dashboard/garden/children?view=attention&filter=change-clothes", tone: (changeClothesRes.count ?? 0) ? "bad" as const : "good" as const, icon: Shirt },
    { title: "פניות הורים פתוחות", count: parentRequestsRes.count ?? 0, description: "השיבי או סמני כטופל מתוך הקשר הילד", href: "/dashboard/garden/children?view=attention&filter=parent-requests", tone: (parentRequestsRes.count ?? 0) ? "warn" as const : "good" as const, icon: MessageSquare },
    { title: "תשלומים באיחור", count: latePayments, description: "גבייה חסרה, חלקית או באיחור", href: "/dashboard/garden/finance?filter=overdue", tone: latePayments ? "bad" as const : "good" as const, icon: WalletCards },
    { title: "תשלום לא עבר", count: failedPayments, description: "עסקאות שנכשלו ודורשות עדכון הורה", href: "/dashboard/garden/finance?filter=failed", tone: failedPayments ? "bad" as const : "good" as const, icon: WalletCards },
    { title: "מסמכים חסרים", count: staffDocsRes.count ?? 0, description: "צוות/גן עם מסמך חסר, דחוי או פג תוקף", href: "/dashboard/garden/documents?filter=missing", tone: (staffDocsRes.count ?? 0) ? "bad" as const : "good" as const, icon: FileClock },
    { title: "אירועים שלא טופלו", count: incidentsRes.count ?? 0, description: "אירועים פתוחים שצריכים סגירה או תגובה", href: "/dashboard/garden/incidents?status=open", tone: (incidentsRes.count ?? 0) ? "bad" as const : "good" as const, icon: AlertTriangle },
    { title: "פיקוח קרוב", count: inspectionDays === null ? "אין" : `${inspectionDays} ימים`, description: "הכנה לביקורת הקרובה", href: "/dashboard/garden/inspections?filter=due-soon", tone: inspectionDays !== null && inspectionDays <= 5 ? "warn" as const : "good" as const, icon: ShieldCheck },
    { title: "מצלמות לא מחוברות", count: camerasRes.count ?? 0, description: "מצלמות שממתינות לחיבור או לא מחוברות", href: "/dashboard/garden/cameras?filter=offline", tone: (camerasRes.count ?? 0) ? "warn" as const : "good" as const, icon: Camera }
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
    { label: "ילדים בלי עדכון ארוחה", count: withoutMeal, href: "/dashboard/garden/child-journal?missing=meal", action: "עדכני ארוחה מהירה", severity: "warn" as const },
    { label: "ילדים בלי עדכון שינה", count: withoutSleep, href: "/dashboard/garden/child-journal?missing=sleep", action: "עדכני שינה", severity: "warn" as const },
    { label: "פניות הורים לא פתורות", count: parentRequestsRes.count ?? 0, href: "/dashboard/garden/messages?status=open", action: "השיבי או סמני טופל", severity: "warn" as const },
    { label: "תשלומים שלא עברו", count: failedPayments, href: "/dashboard/garden/finance?filter=failed", action: "עדכני הורה או קבעי תזכורת", severity: "bad" as const },
    { label: "תשלומים באיחור", count: latePayments, href: "/dashboard/garden/finance?filter=overdue", action: "פתחי גבייה", severity: "bad" as const },
    { label: "נוכחות חסרה", count: missingAttendance, href: "/dashboard/garden/attendance?filter=missing", action: "סמני נוכחות", severity: "warn" as const },
    { label: "אירועים פתוחים", count: incidentsRes.count ?? 0, href: "/dashboard/garden/incidents?status=open", action: "סגרי טיפול", severity: "bad" as const },
    { label: "מסמכי צוות חסרים", count: staffDocsRes.count ?? 0, href: "/dashboard/garden/documents?filter=missing", action: "בקשי מסמך", severity: "bad" as const },
    { label: "איסופים שלא הושלמו", count: pickupPending, href: "/dashboard/garden/pickup?filter=pending", action: "בדקי מי עדיין בגן", severity: "warn" as const }
  ];
  const smartForgotItems = smartInsights
    .filter((item) => item.severity === "warning" || item.severity === "urgent" || item.severity === "critical")
    .map((item) => ({
      label: item.title,
      count: 1,
      href: item.action_url,
      action: item.recommended_action,
      severity: item.severity === "warning" ? "warn" as const : "bad" as const
    }));
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
          <h1>ברוכה הבאה, {profile.full_name ?? "מנהלת הגן"}.</h1>
          <p>גן: {garden?.name ?? "הגן שלך"}{garden?.city ? ` · ${garden.city}` : ""} · ילדים היום: {childrenRes.count ?? 0} · נוכחים: {presentToday} · חסרים: {missingToday}</p>
          <div className="profile-badge-row">
            <span className="pill good">{roleLabel}</span>
            <span className="pill">הודעות ממתינות: {messagesRes.data?.length ?? 0}</span>
          </div>
        </div>
        <Avatar name={garden?.name} src={garden?.logo_url ?? garden?.image_url} size="lg" />
        <span className={aiRes.count || complaintsRes.count ? "pill bad" : "pill good"}><ShieldCheck size={15} /> {aiRes.count || complaintsRes.count ? "דורש טיפול" : "יום רגוע"}</span>
      </div>

      <div className="grid cols-4 dashboard-kpis zero-click-kpis">
        <StatCard label="ילדים היום" value={childrenRes.count ?? 0} tone="good" href="/dashboard/garden/children" />
        <StatCard label="נוכחים" value={presentToday} tone="good" href="/dashboard/garden/attendance" />
        <StatCard label="חסרים" value={missingToday} tone={missingToday ? "warn" : "good"} href="/dashboard/garden/attendance?filter=missing" />
        <StatCard label="תשלומים לטיפול" value={unpaidRes.count ?? 0} tone={unpaidRes.count ? "bad" : "good"} href="/dashboard/garden/finance?filter=overdue" />
        <StatCard label="ילדים לאישור" value={(pendingParentCompletionRes.count ?? 0) + (pendingApprovalRes.count ?? 0)} tone={(pendingParentCompletionRes.count ?? 0) + (pendingApprovalRes.count ?? 0) ? "warn" : "good"} href="/dashboard/garden/children?status=pending" />
      </div>
      <SimpleCommandCenter title="מה דורש טיפול עכשיו?" subtitle="מנוע התובנות בודק את נתוני הגן ומציג רק פעולות שיש להן הקשר ברור." items={smartCommandItems.length ? smartCommandItems : morningItems} />
      <LiveDayFlow counts={flowCounts} />
      {profile.role === "owner" ? <section className="grid cols-4 dashboard-kpis owner-kpis"><StatCard label="הכנסה צפויה" value={`₪${expectedRevenue}`} tone="good" /><StatCard label="ציון גן" value={garden?.last_inspection_score ?? "-"} /><StatCard label="ציון צוות" value={staffRes.count ? "פעיל" : "חסר"} tone={staffRes.count ? "good" : "warn"} /><StatCard label="סיכוני גבייה" value={unpaidRes.count ?? 0} tone={unpaidRes.count ? "bad" : "good"} /></section> : null}

      <section className="dashboard-section zero-click-shortcuts">
        <div className="section-heading"><h2>פעולות יומיומיות בלי חיפוש</h2><p>הפעולות השכיחות ביותר נשארות קרובות. כל השאר נשאר בתפריט הצד.</p></div>
        <div className="quick-actions-grid compact role-action-grid"><Link className="quick-action" href="/dashboard/garden/children?status=pending">ילד חדש<span>אישור או השלמת פרטי ילד</span></Link><Link className="quick-action" href="/dashboard/garden/staff">צוות<span>הוספה, מסמכים ותפקידים</span></Link><Link className="quick-action" href="/dashboard/garden/cameras">מצלמות<span>חיבור, הרשאות וצפייה</span></Link><Link className="quick-action" href="/dashboard/garden/finance?filter=due">תשלום<span>גבייה, איחורים וסידורים</span></Link><Link className="quick-action" href="/dashboard/garden/children?view=attention">ילדים לתשומת לב<span>בריאות, בגדים ופניות</span></Link><Link className="quick-action" href="/dashboard/garden/child-journal">עדכון יומן יומי<span>ארוחה, שינה ומצב רוח</span></Link><Link className="quick-action" href="/dashboard/garden/pickup">איסוף היום<span>מי נאסף ומי ממתין</span></Link><Link className="quick-action" href="/dashboard/garden/incidents">דיווח אירוע<span>פתיחה מהירה ותיעוד</span></Link></div>
      </section>
      <EndOfDayChecklist items={endDayItems} />

      <section className="grid cols-2 dashboard-panels">
        {newLeadCount || transferRequestsCount ? <article className="card action-panel"><div className="section-heading"><h2>בקשות הצטרפות שדורשות תגובה</h2><p>רק בקשות שצריך לטפל בהן עכשיו מוצגות כאן.</p></div><div className="risk-list"><div><UserPlus /> לידים חדשים <b>{newLeadCount}</b></div><div><UserPlus /> מעבר/קליטת ילד קיים <b>{transferRequestsCount}</b></div></div><Link className="button primary" href="/dashboard/garden/leads?status=new">טפל בבקשות</Link></article> : null}
        {(messagesRes.data?.length ?? 0) || complaintsRes.count || aiRes.count ? <article className="card action-panel"><div className="section-heading"><h2>תקשורת ובטיחות</h2><p>מוצג רק כשיש הודעות, פניות או אירועי בטיחות פתוחים.</p></div><div className="risk-list"><div><Bell /> הודעות <b>{messagesRes.data?.length ?? 0}</b></div><div><AlertTriangle /> פניות דחופות <b>{complaintsRes.count ?? 0}</b></div><div><Camera /> מצלמות ותצפיתן <b>{(camerasRes.count ?? 0) + (aiRes.count ?? 0)}</b></div></div><Link className="button secondary" href="/dashboard/garden/messages?status=open">פתח הודעות</Link></article> : null}
      </section>
      <ForgotSomethingButton items={smartForgotItems.length ? smartForgotItems : forgotItems} />
    </DashboardShell>
  );
}
