import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, CalendarCheck, CreditCard, FileText, LogIn, LogOut, ShieldAlert, ShieldCheck, UserCheck, UserPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid,
  teacherDefaultActions,
  teacherFinanceActions
} from "@/components/teacher-app-ui";

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: "פעיל",
    approved: "מאושר",
    demo_active: "בדמו",
    frozen: "מוקפא",
    suspended: "מושעה",
    payment_failed: "תשלום נכשל",
    approved_pending_subscription: "ממתין למנוי",
    pending_final_approval: "ממתין לאישור",
    pending_final_admin_approval: "ממתין לאישור",
    correction_required: "נדרש תיקון",
    profile_incomplete: "פרופיל חסר"
  };
  return labels[String(status ?? "")] ?? status ?? "בהכנה";
}

function toneForStatus(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (["active", "approved"].includes(String(status))) return "good";
  if (["frozen", "suspended", "payment_failed", "rejected"].includes(String(status))) return "bad";
  if (status) return "warn";
  return "default";
}

export default async function GardenDashboard() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  if (!gardenId) redirect("/onboarding/kindergarten");

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    gardenRes,
    childrenRes,
    enrollmentRes,
    staffRes,
    documentsRes,
    inspectionsRes,
    subscriptionRes,
    messagesRes
  ] = await Promise.all([
    supabase.from("gardens" as any).select("id,name,city,status,approval_flow_status,final_approval_status,safe_status,last_inspection_score,next_inspection_at").eq("id", gardenId).maybeSingle(),
    supabase.from("children" as any).select("id,status", { count: "exact", head: true }).eq("garden_id", gardenId).in("status", ["active", "approved"]),
    supabase.from("kindergarten_enrollment_requests" as any).select("id,status", { count: "exact" }).eq("garden_id", gardenId).in("status", ["submitted", "under_review", "more_information_requested", "approved_pending_payment"]).limit(6),
    supabase.from("staff" as any).select("id,approved_to_work,onboarding_status", { count: "exact" }).eq("garden_id", gardenId).limit(80),
    supabase.from("documents" as any).select("id,status,expires_at", { count: "exact" }).eq("garden_id", gardenId).in("status", ["missing", "expired", "rejected", "pending_review"]).limit(6),
    supabase.from("required_inspections" as any).select("id,title,status,due_at", { count: "exact" }).eq("garden_id", gardenId).neq("status", "done").order("due_at", { ascending: true }).limit(4),
    supabase.from("subscriptions" as any).select("id,status,current_period_end,trial_end,trial_ends_at,monthly_amount,amount,price").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId).is("read_at", null)
  ]);

  const garden = gardenRes.data as any;
  if (!garden) redirect("/onboarding/kindergarten");

  const onboardingStatus = String(garden.approval_flow_status ?? garden.final_approval_status ?? garden.status ?? "");
  const subscription = subscriptionRes.data as any;
  const subscriptionStatus = String(subscription?.status ?? garden.status ?? onboardingStatus);
  const pendingRequests = ((enrollmentRes.data ?? []) as any[]).filter((row) => row.status !== "approved_pending_payment").length;
  const waitingPaymentRequests = ((enrollmentRes.data ?? []) as any[]).filter((row) => row.status === "approved_pending_payment").length;
  const staffRows = (staffRes.data ?? []) as any[];
  const activeStaff = staffRows.filter((member) => member.approved_to_work && member.onboarding_status === "active").length;
  const nextInspection = ((inspectionsRes.data ?? []) as any[])[0];
  const monthlyAmount = Number(subscription?.monthly_amount ?? subscription?.amount ?? subscription?.price ?? 800);
  const documentsToHandle = documentsRes.count ?? 0;
  const childrenCount = childrenRes.count ?? 0;
  const staffCount = staffRes.count ?? staffRows.length;
  const todayPriority = pendingRequests
    ? { title: `${pendingRequests} בקשות רישום מחכות`, text: "אישור, דחייה או בקשת מידע מהורה.", href: "/dashboard/garden/enrollment-requests", tone: "warn" }
    : waitingPaymentRequests
      ? { title: `${waitingPaymentRequests} ילדים ממתינים לתשלום`, text: "לא נפתחת גישה מלאה עד הפעלה או החלטת מנהלת.", href: "/dashboard/garden/enrollment-requests", tone: "warn" }
      : documentsToHandle
        ? { title: `${documentsToHandle} מסמכים דורשים טיפול`, text: "השלמת מסמכים ותוקף לפני שהדבר הופך לבעיה.", href: "/dashboard/garden/documents", tone: "warn" }
        : nextInspection
          ? { title: "פיקוח קרוב", text: `${nextInspection.title ?? "ביקורת"} · ${nextInspection.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"}`, href: "/dashboard/garden/inspections", tone: "default" }
          : { title: "הגן רגוע כרגע", text: "אין פעולות דחופות. אפשר להמשיך לניהול ילדים, צוות או מסמכים.", href: "/dashboard/garden/command-center", tone: "good" };
  const occupancy = childrenCount ? Math.min(99, Math.round((childrenCount / Math.max(childrenCount + pendingRequests + 1, 1)) * 100)) : 0;
  const checkedIn = Math.max(childrenCount - Math.max(waitingPaymentRequests, 0), 0);
  const checkedOut = Math.min(Math.max(waitingPaymentRequests, 0), childrenCount);
  const activityTimeline = [
    ["08:00", "קבלת ילדים", "green"],
    ["09:00", "ארוחת בוקר", "orange"],
    ["10:00", "פעילות למידה", "purple"],
    ["11:30", "חצר ומשחק חופשי", "green"],
    ["12:15", "ארוחת צהריים", "orange"],
    ["13:00", "שעת סיפור", "blue"],
    ["14:00", "מנוחה/שקט", "cyan"]
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בית הגן" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`}
        subtitle={`${garden.name ?? "גן הילדים"}${garden.city ? `, ${garden.city}` : ""}`}
        avatarUrl={(profile as any).avatar_url ?? null}
        active="home"
      >
        <TeacherStatsGrid>
          <TeacherStatCard title="תפוסת הגן" value={`${occupancy}%`} hint={`${childrenCount} ילדים בגן`} icon={UsersRound} tone="purple" href="/dashboard/garden/children" />
          <TeacherStatCard title="נוכחות היום" value={childrenCount} hint={`${checkedIn} נכנסו`} icon={UserCheck} tone="green" href="/dashboard/garden/attendance" />
          <TeacherStatCard title="צ׳ק-אין" value={checkedIn} hint="09:00 ✓" icon={LogIn} tone="blue" href="/dashboard/garden/attendance" />
          <TeacherStatCard title="צ׳ק-אאוט" value={checkedOut} hint="עד כה היום" icon={LogOut} tone="orange" href="/dashboard/garden/attendance" />
        </TeacherStatsGrid>

        <TeacherQuickActions>
          {teacherDefaultActions.map((action) => (
            <TeacherActionTile {...action} key={action.title} />
          ))}
        </TeacherQuickActions>

        <TeacherStatsGrid>
          <TeacherStatCard title="סטטוס מנוי" value={statusLabel(subscriptionStatus)} hint={`${monthlyAmount} ₪ לחודש`} icon={CreditCard} tone={toneForStatus(subscriptionStatus) === "bad" ? "red" : "green"} href="/dashboard/garden/subscription" />
          <TeacherStatCard title="בקשות רישום" value={pendingRequests + waitingPaymentRequests} hint={pendingRequests ? "דורש טיפול" : "רגוע"} icon={UserPlus} tone={pendingRequests ? "orange" : "green"} href="/dashboard/garden/enrollment-requests" />
          <TeacherStatCard title="מסמכים" value={documentsToHandle} hint="חסרים / בבדיקה" icon={FileText} tone={documentsToHandle ? "red" : "green"} href="/dashboard/garden/documents" />
          <TeacherStatCard title="צוות בתפקיד" value={`${activeStaff}/${staffCount}`} hint="מאושר היום" icon={UsersRound} tone="cyan" href="/dashboard/garden/staff" />
        </TeacherStatsGrid>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="לוח זמנים להיום" action={<Link href="/dashboard/garden/daily-journal">צפייה מלאה</Link>}>
            <TeacherCompactList>
              {activityTimeline.map(([time, title, tone]) => (
                <TeacherCompactItem key={time} title={title} subtitle={time} tone={tone as any} meta="•" />
              ))}
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="צוות בתפקיד" action={<Link href="/dashboard/garden/staff">כל הצוות</Link>}>
            <TeacherCompactList>
              <TeacherCompactItem title={profile.full_name ?? "מאיה לוי"} subtitle="גננת" tone="purple" meta="כאן" />
              <TeacherCompactItem title="שרון כהן" subtitle="סייעת" tone="green" meta="כאן" />
              <TeacherCompactItem title="נועה פרידמן" subtitle="סייעת" tone="blue" meta="כאן" />
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="התראות בטיחות" action={<Link href="/dashboard/garden/incidents">כל ההתראות</Link>}>
            <TeacherCompactList>
              {documentsToHandle ? <TeacherCompactItem title="מסמכים לטיפול" subtitle="יש מסמכים שדורשים בדיקה" tone="orange" meta={documentsToHandle} /> : null}
              {nextInspection ? <TeacherCompactItem title="פיקוח קרוב" subtitle={nextInspection.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"} tone="blue" meta="בדיקה" /> : null}
              {!documentsToHandle && !nextInspection ? <TeacherCompactItem title="הכל תקין" subtitle="אין התראות פתוחות כרגע" tone="green" meta="✓" /> : null}
            </TeacherCompactList>
          </TeacherSection>
        </section>

        <TeacherAiInsight metric={occupancy ? `+${Math.min(occupancy, 99)}%` : "+0%"}>
          {todayPriority.title}. {todayPriority.text}
        </TeacherAiInsight>

        <TeacherQuickActions title="עוד פעולות">
          {[...teacherFinanceActions, { title: "פיקוחים", href: "/dashboard/garden/inspections", icon: CalendarCheck, tone: "blue" as const }, { title: "מצלמות", href: "/dashboard/garden/cameras", icon: ShieldCheck, tone: "cyan" as const }, { title: "מסמכים", href: "/dashboard/garden/documents", icon: FileText, tone: "orange" as const }].map((action) => (
            <TeacherActionTile {...action} key={action.title} />
          ))}
        </TeacherQuickActions>

        {(pendingRequests || waitingPaymentRequests || documentsToHandle || nextInspection || (messagesRes.count ?? 0)) ? null : (
          <TeacherEmptyState title="אין פעולות דחופות כרגע" text="המסך נשאר נקי. אפשר להמשיך לניהול מלא או לבצע פעולה מהירה." />
        )}

        <details className="teacher-management-details">
          <summary>ניהול מלא</summary>
          <div>
            <Link href="/dashboard/garden/command-center">מרכז פיקוד מלא</Link>
            <Link href="/dashboard/garden/children">כל הילדים</Link>
            <Link href="/dashboard/garden/parents">הורים ותקשורת</Link>
            <Link href="/dashboard/garden/staff-applications">מועמדויות צוות</Link>
            <Link href="/dashboard/garden/compliance">ציות ומסמכים</Link>
            <Link href="/dashboard/garden/cameras">מצלמות</Link>
            <Link href="/dashboard/garden/trust-center">אמון הורים</Link>
            <Link href="/dashboard/garden/settings">הגדרות הגן</Link>
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
