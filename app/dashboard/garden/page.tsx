import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, CalendarCheck, CreditCard, FileText, ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AppEmptyState, AppHomeGrid, AppHomeHero, AppHomeSection, AppHomeShell, AppQuickAction, AppStatusCard } from "@/components/premium-dashboard";
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

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בית הגן">
      <AppHomeShell className="garden-app-home">
        <AppHomeHero
          eyebrow="בית הגן"
          title={`${garden.name ?? "הגן"} מוכן לניהול יומי`}
          subtitle="המסך הראשון מציג רק את מה שצריך עכשיו. כל הניהול המלא נשאר זמין בכפתורים ובתפריט."
          badge={statusLabel(subscriptionStatus)}
          badgeTone={toneForStatus(subscriptionStatus)}
          actions={<><Link className="button primary" href="/dashboard/garden/command-center">מרכז פיקוד מלא</Link><Link className="button secondary" href="/dashboard/garden/settings">פרופיל הגן</Link></>}
        />

        <AppHomeGrid compact>
          <AppStatusCard label="ילדים פעילים" value={childrenRes.count ?? 0} hint="רשומות פעילות בגן" tone="good" href="/dashboard/garden/children" />
          <AppStatusCard label="בקשות רישום" value={pendingRequests} hint={`${waitingPaymentRequests} ממתינות לתשלום`} tone={pendingRequests || waitingPaymentRequests ? "warn" : "good"} href="/dashboard/garden/enrollment-requests" />
          <AppStatusCard label="צוות פעיל" value={`${activeStaff}/${staffRes.count ?? staffRows.length}`} hint="מאושר ומשויך" tone={activeStaff ? "good" : "warn"} href="/dashboard/garden/staff" />
          <AppStatusCard label="מנוי גן בטוח" value={statusLabel(subscriptionStatus)} hint={`החל מ-${monthlyAmount} ₪ לחודש`} tone={toneForStatus(subscriptionStatus)} href="/dashboard/garden/subscription" />
          <AppStatusCard label="מסמכים לטיפול" value={documentsRes.count ?? 0} hint="חסרים/פגי תוקף/בבדיקה" tone={(documentsRes.count ?? 0) ? "warn" : "good"} href="/dashboard/garden/documents" />
          <AppStatusCard label="פיקוח הבא" value={nextInspection?.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "לא נקבע"} hint={nextInspection?.title ?? "תכנון פיקוח"} tone={nextInspection ? "warn" : "good"} href="/dashboard/garden/inspections" />
        </AppHomeGrid>

        <AppHomeSection title="פעולות מהירות" subtitle="הפעולות שמנהלת גן צריכה להגיע אליהן בלי לחפש.">
          <AppHomeGrid>
            <AppQuickAction title="הוסף ילד" text="יצירת כרטיס ילד" href="/dashboard/garden/children" icon={Baby} tone="good" />
            <AppQuickAction title="הזמן הורה" text="חיבור הורה לילד" href="/dashboard/garden/parents" icon={UserPlus} />
            <AppQuickAction title="בקשות רישום" text="אישור או בקשת מידע" href="/dashboard/garden/enrollment-requests" icon={ShieldCheck} tone={pendingRequests ? "warn" : "default"} />
            <AppQuickAction title="הוסף איש צוות" text="צוות ומועמדויות" href="/dashboard/garden/staff" icon={UsersRound} />
            <AppQuickAction title="העלאת מסמך" text="מסמכי גן ותוקף" href="/dashboard/garden/documents" icon={FileText} tone={(documentsRes.count ?? 0) ? "warn" : "default"} />
            <AppQuickAction title="תשלומים" text="מנוי וגבייה" href="/dashboard/garden/finance" icon={CreditCard} />
            <AppQuickAction title="פיקוחים" text="ביקורות וליקויים" href="/dashboard/garden/inspections" icon={CalendarCheck} />
          </AppHomeGrid>
        </AppHomeSection>

        <AppHomeSection title="מה דורש טיפול עכשיו" subtitle="אם אין נתונים, המסך נשאר נקי וברור.">
          {(pendingRequests || waitingPaymentRequests || (documentsRes.count ?? 0) || nextInspection || (messagesRes.count ?? 0)) ? (
            <div className="app-home-list">
              {pendingRequests ? <Link href="/dashboard/garden/enrollment-requests"><strong>{pendingRequests} בקשות רישום מחכות</strong><span>סקירה, אישור או בקשת מידע מהורה</span></Link> : null}
              {waitingPaymentRequests ? <Link href="/dashboard/garden/enrollment-requests"><strong>{waitingPaymentRequests} ילדים ממתינים לתשלום</strong><span>לא לפתוח גישה מלאה לפני הפעלה</span></Link> : null}
              {(documentsRes.count ?? 0) ? <Link href="/dashboard/garden/documents"><strong>{documentsRes.count} מסמכים דורשים טיפול</strong><span>בדיקה, העלאה או חידוש</span></Link> : null}
              {nextInspection ? <Link href="/dashboard/garden/inspections"><strong>פיקוח קרוב</strong><span>{nextInspection.due_at ? new Date(nextInspection.due_at).toLocaleDateString("he-IL") : "תאריך לא נקבע"} · {nextInspection.title ?? "פעולת פיקוח"}</span></Link> : null}
              {(messagesRes.count ?? 0) ? <Link href="/dashboard/garden/messages"><strong>{messagesRes.count} הודעות שלא נקראו</strong><span>תקשורת עם הורים/צוות</span></Link> : null}
            </div>
          ) : (
            <AppEmptyState title="אין פעולות דחופות כרגע" text="אפשר לפתוח את מרכז הפיקוד המלא או להמשיך לניהול ילדים, צוות ומסמכים." action={<Link className="button secondary" href="/dashboard/garden/command-center">מרכז פיקוד מלא</Link>} />
          )}
        </AppHomeSection>
      </AppHomeShell>
    </DashboardShell>
  );
}
