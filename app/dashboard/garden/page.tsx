import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, CalendarCheck, CreditCard, FileText, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AppEmptyState, AppHomeShell } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const appStats = [
    { label: "ילדים", value: childrenCount, hint: "פעילים", href: "/dashboard/garden/children", tone: "good" },
    { label: "בקשות", value: pendingRequests + waitingPaymentRequests, hint: "לטיפול", href: "/dashboard/garden/enrollment-requests", tone: pendingRequests || waitingPaymentRequests ? "warn" : "good" },
    { label: "צוות", value: `${activeStaff}/${staffCount}`, hint: "מאושר", href: "/dashboard/garden/staff", tone: activeStaff ? "good" : "warn" },
    { label: "מסמכים", value: documentsToHandle, hint: "חסרים/בבדיקה", href: "/dashboard/garden/documents", tone: documentsToHandle ? "warn" : "good" }
  ];
  const quickActions = [
    { title: "ילד", text: "הוספה וניהול", href: "/dashboard/garden/children", icon: Baby, tone: "good" },
    { title: "הורה", text: "הזמנה ושיוך", href: "/dashboard/garden/parents", icon: UserPlus },
    { title: "בקשות", text: "רישום לגן", href: "/dashboard/garden/enrollment-requests", icon: ShieldCheck, tone: pendingRequests ? "warn" : "default" },
    { title: "צוות", text: "עובדים ומועמדים", href: "/dashboard/garden/staff", icon: UsersRound },
    { title: "מסמך", text: "העלאה ותוקף", href: "/dashboard/garden/documents", icon: FileText, tone: documentsToHandle ? "warn" : "default" },
    { title: "תשלום", text: "מנוי וגבייה", href: "/dashboard/garden/finance", icon: CreditCard },
    { title: "פיקוח", text: "ביקורות וליקויים", href: "/dashboard/garden/inspections", icon: CalendarCheck }
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בית הגן" appHome>
      <AppHomeShell className="garden-app-home garden-mobile-app-home">
        <section className="garden-phone-hero" aria-label="מסך בית גן">
          <div className="garden-phone-hero-top">
            <span>גן בטוח</span>
            <b className={`garden-mini-status ${toneForStatus(subscriptionStatus)}`}>{statusLabel(subscriptionStatus)}</b>
          </div>
          <div>
            <p className="garden-hello">שלום, {profile.full_name ?? "מנהלת הגן"}</p>
            <h1>{garden.name ?? "הגן"}</h1>
            <p>{garden.city ?? "העיר לא הוגדרה"} · מנוי גן בטוח {monthlyAmount} ₪ לחודש · הכל מנוהל במסך קצר וברור.</p>
          </div>
          <Link className="garden-primary-action" href={todayPriority.href}>
            <span>{todayPriority.title}</span>
            <small>{todayPriority.text}</small>
          </Link>
        </section>

        <section className="garden-today-glance" aria-label="היום בגן">
          {appStats.map((item) => (
            <Link className={`garden-glance-card ${item.tone}`} href={item.href} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.hint}</small>
            </Link>
          ))}
        </section>

        <section className="garden-focus-card">
          <div>
            <p className="premium-eyebrow">מה עכשיו?</p>
            <h2>{todayPriority.title}</h2>
            <p>{todayPriority.text}</p>
          </div>
          <Link className={`button ${todayPriority.tone === "good" ? "secondary" : "primary"}`} href={todayPriority.href}>לטיפול</Link>
        </section>

        <section className="garden-action-dock" aria-label="פעולות מהירות">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link className={`garden-dock-action ${action.tone ?? "default"}`} href={action.href} key={action.title}>
                <Icon size={20} />
                <strong>{action.title}</strong>
                <span>{action.text}</span>
              </Link>
            );
          })}
        </section>

        <details className="garden-management-drawer">
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

        {(pendingRequests || waitingPaymentRequests || documentsToHandle || nextInspection || (messagesRes.count ?? 0)) ? null : (
          <AppEmptyState title="אין פעולות דחופות כרגע" text="המסך נשאר נקי. אפשר להמשיך לניהול מלא או לבצע פעולה מהירה." />
        )}
      </AppHomeShell>
    </DashboardShell>
  );
}
