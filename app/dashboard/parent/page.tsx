import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, Building2, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AppEmptyState, AppHomeGrid, AppHomeHero, AppHomeSection, AppHomeShell, AppQuickAction, AppStatusCard, StatusBadge } from "@/components/premium-dashboard";
import { ParentChildProfileForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    draft: "טיוטה",
    submitted: "נשלח",
    under_review: "בבדיקה",
    more_information_requested: "נדרש מידע נוסף",
    approved_pending_payment: "אושר, ממתין לתשלום",
    approved: "מאושר",
    rejected: "נדחה",
    cancelled: "בוטל",
    expired: "פג תוקף",
    pending_affiliation: "ממתין לשיוך",
    active: "פעיל"
  };
  return map[status ?? ""] ?? status ?? "-";
}

export default async function ParentDashboard() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const [parentRes, childrenRes, requestsRes, selfServiceRes] = await Promise.all([
    supabase.from("parents" as any).select("id,status,onboarding_status,completed_profile,garden_id").or(`profile_id.eq.${profile.id},user_id.eq.${profile.id}`).eq("status", "active").limit(1).maybeSingle(),
    supabase.from("permanent_child_files" as any).select("id,full_name,birth_date,owner_status,duplicate_flags,created_at").eq("primary_parent_profile_id", profile.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("kindergarten_enrollment_requests" as any).select("id,status,payment_status,requested_at,decided_at,published_price_snapshot,gardens(name,city)").eq("parent_id", profile.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("self_service_user_profiles" as any).select("*").eq("profile_id", profile.id).maybeSingle()
  ]);
  const parent = parentRes.data as any;
  if (parent?.garden_id && parent.completed_profile && parent.onboarding_status === "active") redirect("/dashboard/parent/family-home");
  const childProfiles = (childrenRes.data ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const pending = requests.filter((request) => !["approved", "rejected", "cancelled", "expired"].includes(String(request.status)));
  const approvedPendingPayment = requests.filter((request) => request.status === "approved_pending_payment");

  return (
    <DashboardShell role="parent" title="אזור הורה" appHome>
      <AppHomeShell className="parent-app-home">
        <AppHomeHero
          eyebrow="בית הורה"
          title={childProfiles.length ? "הילד עדיין לא משויך לגן" : "עדיין לא נוסף ילד לחשבון שלך"}
          subtitle="כאן מתחילים: מוסיפים כרטיס ילד, מוצאים גן בטוח ומגישים בקשת הצטרפות. עד אישור הגן מוצג רק המידע שלך."
          badge={formatStatus(selfServiceRes.data?.status)}
          badgeTone={approvedPendingPayment.length || pending.length ? "warn" : "good"}
          actions={<><Link className="button primary" href="#child-profile">הוסף ילד</Link><Link className="button secondary" href="/dashboard/parent/discover-kindergartens">מצא גן בטוח</Link></>}
        />

        <AppHomeGrid compact>
          <AppStatusCard label="כרטיסי ילדים" value={childProfiles.length} hint={childProfiles.length ? "נוצרו בחשבון שלך" : "צריך להוסיף ילד"} tone={childProfiles.length ? "good" : "warn"} href="#child-profile" />
          <AppStatusCard label="בקשות פתוחות" value={pending.length} hint="ממתינות לגן" tone={pending.length ? "warn" : "good"} href="#requests" />
          <AppStatusCard label="ממתין לתשלום" value={approvedPendingPayment.length} hint="אחרי אישור מנהלת" tone={approvedPendingPayment.length ? "warn" : "good"} href="/dashboard/parent/payments" />
          <AppStatusCard label="גישה לגן" value={parent?.garden_id ? "פעילה" : "מוגבלת"} hint="נפתחת רק אחרי אישור" tone={parent?.garden_id ? "good" : "warn"} />
        </AppHomeGrid>

        <AppHomeSection title="הפעולה הבאה שלך" subtitle="מסך קצר וברור, בלי מידע פנימי של גנים לפני אישור.">
          <AppHomeGrid>
            <AppQuickAction title="הוסף ילד" text="כרטיס ילד פרטי שלך" href="#child-profile" icon={Baby} tone="good" />
            <AppQuickAction title="מצא גן בטוח" text="רק מידע ציבורי מאושר" href="/dashboard/parent/discover-kindergartens" icon={Building2} tone={childProfiles.length ? "good" : "default"} />
            <AppQuickAction title="בקשות שלי" text={`${requests.length} בקשות הצטרפות`} href="#requests" icon={FileText} tone={pending.length ? "warn" : "default"} />
            <AppQuickAction title="התראות" text="עדכונים על בקשה ואישור" href="/dashboard/parent/notifications" icon={MessageCircle} />
            <AppQuickAction title="פרופיל" text="פרטי קשר ואימות" href="/dashboard/parent/settings" icon={ShieldCheck} />
          </AppHomeGrid>
        </AppHomeSection>

        <AppHomeSection title="בקשות הצטרפות" subtitle="סטטוס הבקשות שהגשתם לגנים." action={<Link className="button secondary" href="/dashboard/parent/discover-kindergartens">הגשת בקשה חדשה</Link>}>
          {requests.length === 0 ? <AppEmptyState title="עוד לא הוגשה בקשה" text="צרו כרטיס ילד ואז בחרו גן מרשימת הגנים הציבורית." /> : <div className="app-home-list">{requests.map((request) => (
            <Link href={request.status === "approved_pending_payment" ? "/dashboard/parent/payments" : "#requests"} key={request.id}>
              <strong>{request.gardens?.name ?? "גן"} · {formatStatus(request.status)}</strong>
              <span>{request.gardens?.city ?? ""} · תשלום: {formatStatus(request.payment_status)}</span>
            </Link>
          ))}</div>}
        </AppHomeSection>

        <AppHomeSection title="כרטיס ילד" subtitle="המידע נשאר שלך עד שתבחרו גן ותשלחו בקשה." action={<StatusBadge tone="warn">מידע פרטי</StatusBadge>}>
          <div id="child-profile">
            <ParentChildProfileForm />
          </div>
        </AppHomeSection>
      </AppHomeShell>
    </DashboardShell>
  );
}
