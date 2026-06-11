import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Baby, Camera, ClipboardCheck, FileClock, HeartPulse, MessageSquare, ShieldCheck, Star, UsersRound, WalletCards } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createNotificationsForUrgentInsights, generateSmartInsights, syncSmartInsights } from "@/lib/domain/smart-kindergarten-engine";
import { createClient } from "@/lib/supabase/server";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toneForCount(count: number) {
  return count > 0 ? "warn" as const : "good" as const;
}

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);

  const [
    gardenRes,
    childrenRes,
    staffRes,
    attendanceRes,
    shiftsRes,
    tasksRes,
    parentRequestsRes,
    complaintsRes,
    incidentsRes,
    documentsRes,
    pendingDocsRes,
    pendingChildrenRes,
    staffDocsRes,
    cameraIssuesRes,
    aiRes,
    paymentsRes,
    inspectionsRes,
    journalsRes,
    messagesRes
  ] = await Promise.all([
    supabase.from("gardens" as any).select("id, name, city, logo_url, image_url, safe_status, approval_flow_status, final_approval_status, admin_correction_note, last_inspection_score").eq("id", gardenId).maybeSingle(),
    supabase.from("children" as any).select("id, full_name, photo_url, allergies, medical_notes, regular_medications, status, has_change_clothes, payment_status, monthly_fee", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("staff" as any).select("id, profile_id, full_name, role_title, approved_to_work", { count: "exact" }).eq("garden_id", gardenId),
    supabase.from("attendance" as any).select("id, child_id, status, pickup_name", { count: "exact" }).eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("staff_shifts" as any).select("staff_id, clock_in_at, clock_out_at", { count: "exact" }).eq("garden_id", gardenId).eq("shift_date", today),
    supabase.from("tasks" as any).select("id, title, priority, status, category, due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("created_at", { ascending: false }).limit(8),
    supabase.from("parent_child_requests" as any).select("id, request_type, status", { count: "exact" }).eq("garden_id", gardenId).in("status", ["new", "viewed"]),
    supabase.from("complaints" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).neq("status", "closed"),
    supabase.from("incident_reports" as any).select("id, title, severity, status", { count: "exact" }).eq("garden_id", gardenId).neq("status", "closed").limit(6),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["missing", "expired", "rejected"]),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("status", "pending_review"),
    supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["pending_manager_approval", "missing_info", "request_missing_details", "pending_parent_completion"]),
    supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["missing", "expired", "rejected"]),
    supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).or("active.eq.false,status.in.(offline,failed,error,disabled,pending_gateway)"),
    supabase.from("ai_events" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).neq("status", "closed"),
    supabase.from("children" as any).select("id, monthly_fee, payment_status").eq("garden_id", gardenId).in("payment_status", ["overdue", "unpaid", "partial", "failed", "not_transferred"]),
    supabase.from("required_inspections" as any).select("id, title, due_at, status").eq("garden_id", gardenId).neq("status", "done").order("due_at", { ascending: true }).limit(4),
    supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).eq("recipient_id", profile.id).is("read_at", null)
  ]);

  const garden = gardenRes.data as any;
  const onboardingStatus = String(garden?.approval_flow_status ?? garden?.final_approval_status ?? "");
  if ([
    "lead_approved_credentials_sent",
    "profile_incomplete",
    "credentials_sent",
    "onboarding_in_progress",
    "onboarding_submitted",
    "pending_final_approval",
    "pending_final_admin_approval",
    "correction_required"
  ].includes(onboardingStatus)) redirect("/onboarding/kindergarten");

  const children = (childrenRes.data ?? []) as any[];
  const staff = (staffRes.data ?? []) as any[];
  const attendance = (attendanceRes.data ?? []) as any[];
  const journals = (journalsRes.data ?? []) as any[];
  const presentChildren = attendance.filter((row: any) => row.status === "present").length;
  const missingAttendance = Math.max(0, (childrenRes.count ?? 0) - attendance.length);
  const staffPresent = ((shiftsRes.data ?? []) as any[]).filter((row) => row.clock_in_at && !row.clock_out_at).length;
  const missingMeal = Math.max(0, (childrenRes.count ?? 0) - journals.filter((row: any) => Array.isArray(row.meals) && row.meals.length > 0).length);
  const missingSleep = Math.max(0, (childrenRes.count ?? 0) - journals.filter((row: any) => row.sleep_summary).length);
  const healthChildren = children.filter((child) => child.allergies || child.medical_notes || child.regular_medications);
  const clothesMissing = children.filter((child) => child.has_change_clothes === false).length;
  const paymentIssues = (paymentsRes.data ?? []) as any[];
  const expectedIncome = children.reduce((sum, child) => sum + Number(child.monthly_fee ?? 0), 0);
  const unresolvedIssues = (tasksRes.count ?? 0) + (parentRequestsRes.count ?? 0) + (complaintsRes.count ?? 0) + (incidentsRes.count ?? 0) + (cameraIssuesRes.count ?? 0) + (aiRes.count ?? 0);
  const attendanceCompletion = childrenRes.count ? ((attendance.length / childrenRes.count) * 100) : 100;
  const documentCompliance = clampScore(100 - (documentsRes.count ?? 0) * 8 - (staffDocsRes.count ?? 0) * 6);
  const inspectionReadiness = clampScore(100 - (inspectionsRes.data?.length ?? 0) * 12);
  const safetyReadiness = clampScore(100 - (incidentsRes.count ?? 0) * 10 - (aiRes.count ?? 0) * 8);
  const staffReadiness = staffRes.count ? clampScore((staff.filter((member) => member.approved_to_work).length / staffRes.count) * 100) : 80;
  const healthScore = clampScore((attendanceCompletion + documentCompliance + inspectionReadiness + safetyReadiness + staffReadiness) / 5);

  let smartInsights: Awaited<ReturnType<typeof generateSmartInsights>> = [];
  try {
    smartInsights = await syncSmartInsights(supabase as any, await generateSmartInsights(supabase as any, profile));
    await createNotificationsForUrgentInsights(supabase as any, smartInsights);
  } catch (error) {
    console.error("[garden-dashboard] smart insights failed", { garden_id: gardenId, error });
  }

  const attentionItems = [
    { title: "ילדים בלי נוכחות", count: missingAttendance, href: "/dashboard/garden/attendance?filter=missing", tone: toneForCount(missingAttendance), text: "סימון נוכחות חסר" },
    { title: "ילדים בלי ארוחה", count: missingMeal, href: "/dashboard/garden/child-journal?missing=meal", tone: toneForCount(missingMeal), text: "עדכון יומן קצר" },
    { title: "ילדים בלי שינה", count: missingSleep, href: "/dashboard/garden/child-journal?missing=sleep", tone: toneForCount(missingSleep), text: "השלמת מנוחה" },
    { title: "ילדים עם דגש בריאותי", count: healthChildren.length, href: "/dashboard/garden/children?view=attention&filter=health", tone: healthChildren.length ? "warn" as const : "good" as const, text: "אלרגיות/תרופות" },
    { title: "מסמכים לבדיקה", count: pendingDocsRes.count ?? 0, href: "/dashboard/garden/documents?filter=pending", tone: toneForCount(pendingDocsRes.count ?? 0), text: "ממתין לאישור" },
    { title: "ילדים לאישור", count: pendingChildrenRes.count ?? 0, href: "/dashboard/garden/children?status=pending", tone: toneForCount(pendingChildrenRes.count ?? 0), text: "בקשות הורים" }
  ];

  const assistantQuestions = [
    { label: "אילו ילדים צריכים תשומת לב?", href: "/dashboard/garden/children?view=attention" },
    { label: "מה נשאר פתוח היום?", href: "/dashboard/garden/tasks" },
    { label: "אילו מסמכים עומדים לפוג?", href: "/dashboard/garden/documents?filter=missing" },
    { label: "מה מצב התשלומים?", href: "/dashboard/garden/finance?filter=due" },
    { label: "מה התצפיתן ממליץ לבדוק?", href: "/dashboard/garden/observer-intelligence" }
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מפקדת גן">
      <div className="manager-command-shell">
        <section className="manager-command-hero">
          <div className="manager-health-score">
            <span>בריאות גן</span>
            <strong>{healthScore}</strong>
            <small>מתוך 100</small>
          </div>
          <div>
            <p className="eyebrow">מה צריך טיפול עכשיו?</p>
            <h1>{garden?.name ?? "הגן שלך"} במבט אחד.</h1>
            <p>{garden?.city ? `${garden.city} · ` : ""}{presentChildren} ילדים נוכחים, {staffPresent} אנשי צוות במשמרת, {unresolvedIssues} נושאים פתוחים.</p>
            <div className="parent-status-row">
              <span className={healthScore >= 85 ? "pill good" : healthScore >= 70 ? "pill warn" : "pill bad"}>{healthScore >= 85 ? "יום יציב" : "דורש תשומת לב"}</span>
              <span className="pill good">{profile.role === "owner" ? "בעלים" : "מנהלת גן"}</span>
              <span className={smartInsights.length ? "pill warn" : "pill good"}>{smartInsights.length || "אין"} המלצות</span>
            </div>
          </div>
          <Avatar name={garden?.name} src={garden?.logo_url ?? garden?.image_url} size="lg" />
        </section>

        <section className="manager-kpi-strip">
          <RoleMetricCard label="נוכחות היום" value={`${presentChildren}/${childrenRes.count ?? 0}`} hint={`${missingAttendance} חסרים לסימון`} tone={missingAttendance ? "warn" : "good"} href="/dashboard/garden/attendance" />
          <RoleMetricCard label="צוות נוכח" value={`${staffPresent}/${staffRes.count ?? 0}`} hint="לפי שעון נוכחות" tone={staffPresent ? "good" : "warn"} href="/dashboard/garden/staff" />
          <RoleMetricCard label="נושאים פתוחים" value={unresolvedIssues} hint="משימות, פניות ובטיחות" tone={unresolvedIssues ? "warn" : "good"} href="/dashboard/garden/tasks" />
          <RoleMetricCard label="תשלומים לטיפול" value={paymentIssues.length} hint={`צפי ${expectedIncome.toLocaleString("he-IL")} ש״ח`} tone={paymentIssues.length ? "bad" : "good"} href="/dashboard/garden/finance" />
          <RoleMetricCard label="מצלמות ותצפיתן" value={(cameraIssuesRes.count ?? 0) + (aiRes.count ?? 0)} hint="דורש בדיקה" tone={(cameraIssuesRes.count ?? 0) + (aiRes.count ?? 0) ? "warn" : "good"} href="/dashboard/garden/observer-intelligence" />
        </section>

        <section className="manager-two-column">
          <article className="manager-priority-card">
            <div className="section-heading"><h2>מרכז תפעול יומי</h2><p>כל מה שצריך לסגור היום.</p></div>
            <div className="manager-attention-grid">{attentionItems.map((item) => <Link className={`manager-attention-item ${item.tone}`} href={item.href} key={item.title}><strong>{item.count}</strong><span>{item.title}</span><small>{item.text}</small></Link>)}</div>
          </article>
          <article className="manager-assistant-card">
            <ShieldCheck />
            <h2>עוזר מנהלת</h2>
            <p>שאלות מוכנות על בסיס נתוני הגן הקיימים.</p>
            <div>{assistantQuestions.map((item) => <Link href={item.href} key={item.label}>{item.label}</Link>)}</div>
          </article>
        </section>

        <section className="manager-action-grid">
          <ActionCard title="מרכז פיקוד" text="תמונת מצב ניהולית" href="/dashboard/garden/command-center" icon={ShieldCheck} tone="good" />
          <ActionCard title="מערכת הפעלה" text="כל הגן במקום אחד" href="/dashboard/garden/operations" icon={ShieldCheck} tone="good" />
          <ActionCard title="הוספת ילד" text="רישום ואישור ילדים" href="/dashboard/garden/children" icon={Baby} tone="good" />
          <ActionCard title="הוספת צוות" text="תפקידים ומסמכים" href="/dashboard/garden/staff" icon={UsersRound} />
          <ActionCard title="שליחת הודעה" text="פנייה להורים" href="/dashboard/garden/communication" icon={MessageSquare} />
          <ActionCard title="משימה חדשה" text="מעקב וביצוע" href="/dashboard/garden/tasks" icon={ClipboardCheck} />
          <ActionCard title="ביקורת" text="פעולות פיקוח" href="/dashboard/garden/inspections" icon={ShieldCheck} />
          <ActionCard title="דירוג הגן" text="ציון והמלצות שיפור" href="/dashboard/garden/rating" icon={Star} />
          <ActionCard title="סיכון ומניעה" text="דפוסים והמלצות רגועות" href="/dashboard/garden/risk" icon={AlertTriangle} tone={unresolvedIssues ? "warn" : "good"} />
          <ActionCard title="התראות" text="אירועים ותצפיתן" href="/dashboard/garden/observer-intelligence" icon={AlertTriangle} tone={(aiRes.count ?? 0) ? "warn" : "default"} />
        </section>

        <section className="manager-two-column">
          <article className="manager-priority-card">
            <div className="section-heading"><h2>צוות ומשמרות</h2><p>נוכחות, אישורי עבודה ומסמכים.</p></div>
            <div className="manager-health-list">
              <span>נוכחים עכשיו <b>{staffPresent}</b></span>
              <span>מאושרים לעבודה <b>{staff.filter((member) => member.approved_to_work).length}</b></span>
              <span>מסמכי צוות חסרים <b>{staffDocsRes.count ?? 0}</b></span>
              <span>ציון מוכנות צוות <b>{staffReadiness}</b></span>
            </div>
            <Link className="button secondary" href="/dashboard/garden/staff">פתיחת מרכז צוות</Link>
          </article>
          <article className="manager-priority-card">
            <div className="section-heading"><h2>פיקוח ותאימות</h2><p>ביקורות, מסמכים ופעולות חובה.</p></div>
            <div className="manager-health-list">
              <span>פעולות פיקוח <b>{inspectionsRes.data?.length ?? 0}</b></span>
              <span>מסמכים חסרים <b>{documentsRes.count ?? 0}</b></span>
              <span>אירועים פתוחים <b>{incidentsRes.count ?? 0}</b></span>
              <span>ציון מוכנות <b>{inspectionReadiness}</b></span>
            </div>
            <Link className="button secondary" href="/dashboard/garden/inspections">פתיחת פיקוח</Link>
          </article>
        </section>

        <section className="manager-two-column">
          <article className="manager-priority-card">
            <div className="section-heading"><h2>תקשורת הורים</h2><p>פניות, תלונות והודעות שלא נקראו.</p></div>
            <div className="manager-health-list">
              <span>פניות הורים <b>{parentRequestsRes.count ?? 0}</b></span>
              <span>הודעות לא נקראו <b>{messagesRes.count ?? 0}</b></span>
              <span>פניות דחופות <b>{complaintsRes.count ?? 0}</b></span>
              <span>ילדים בלי בגדים להחלפה <b>{clothesMissing}</b></span>
            </div>
            <Link className="button secondary" href="/dashboard/garden/parents">פתיחת מרכז הורים</Link>
          </article>
          <article className="manager-priority-card">
            <div className="section-heading"><h2>כספים, מצלמות ותצפיתן</h2><p>סיכום קצר בלי לפתוח כמה מסכים.</p></div>
            <div className="manager-health-list">
              <span>הכנסה צפויה <b>₪{expectedIncome.toLocaleString("he-IL")}</b></span>
              <span>תשלומים לטיפול <b>{paymentIssues.length}</b></span>
              <span>מצלמות דורשות בדיקה <b>{cameraIssuesRes.count ?? 0}</b></span>
              <span>עדכוני תצפיתן <b>{aiRes.count ?? 0}</b></span>
            </div>
            <div className="profile-actions"><Link className="button secondary" href="/dashboard/garden/finance">כספים</Link><Link className="button secondary" href="/dashboard/garden/cameras">מצלמות</Link></div>
          </article>
        </section>

        <section className="manager-report-row">
          <span><HeartPulse /> נוכחות: {Math.round(attendanceCompletion)}%</span>
          <span><FileClock /> מסמכים: {documentCompliance}%</span>
          <span><ShieldCheck /> פיקוח: {inspectionReadiness}%</span>
          <span><AlertTriangle /> בטיחות: {safetyReadiness}%</span>
          <span><UsersRound /> צוות: {staffReadiness}%</span>
        </section>
      </div>
    </DashboardShell>
  );
}
