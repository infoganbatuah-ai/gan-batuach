import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, Building2, FileText, MessageCircle, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
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
    <DashboardShell role="parent" title="אזור הורה">
      <section className="dashboard-hero-card parent-hero-card">
        <div>
          <p className="eyebrow">הורה לא משויך</p>
          <h1>מצאו את הגן של ילדכם והגישו בקשת הצטרפות.</h1>
          <p>עד אישור מנהלת והפעלת תשלום אם נדרש, מוצגים רק הפרופיל שלכם, כרטיסי הילדים שיצרתם, רשימת גנים ציבורית ובקשות שלכם.</p>
        </div>
        <StatusBadge tone={approvedPendingPayment.length ? "warn" : pending.length ? "warn" : "good"}>{formatStatus(selfServiceRes.data?.status)}</StatusBadge>
      </section>

      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="כרטיסי ילדים" value={childProfiles.length} tone={childProfiles.length ? "good" : "warn"} />
        <RoleMetricCard label="בקשות פתוחות" value={pending.length} tone={pending.length ? "warn" : "good"} />
        <RoleMetricCard label="ממתין לתשלום" value={approvedPendingPayment.length} tone={approvedPendingPayment.length ? "warn" : "good"} />
        <RoleMetricCard label="גישה לגן" value={parent?.garden_id ? "פעילה" : "מוגבלת"} tone={parent?.garden_id ? "good" : "warn"} />
      </section>

      <section className="staff-action-grid">
        <ActionCard title="גילוי גנים" text="רשימת גנים עם מידע ציבורי בלבד" href="/dashboard/parent/discover-kindergartens" icon={Building2} tone="good" />
        <ActionCard title="בקשות שלי" text={`${requests.length} בקשות הצטרפות`} href="#requests" icon={FileText} />
        <ActionCard title="הודעות" text="עדכונים על בקשות ואישור" href="/dashboard/parent/notifications" icon={MessageCircle} />
        <ActionCard title="פרופיל" text="פרטי קשר ואימות" href="/dashboard/parent/settings" icon={ShieldCheck} />
      </section>

      <ParentChildProfileForm />

      <section className="dashboard-section" id="requests">
        <div className="section-heading"><h2>בקשות הצטרפות</h2><p>סטטוס בקשות שהגשתם לגנים.</p></div>
        {requests.length === 0 ? <div className="empty-state"><Baby /><strong>עוד לא הוגשה בקשה</strong><span>צרו כרטיס ילד ואז בחרו גן מרשימת הגנים הציבורית.</span></div> : <div className="procedure-list">{requests.map((request) => (
          <article className="card procedure-card" key={request.id}>
            <div>
            <span className={request.status === "approved" ? "pill good" : request.status === "rejected" ? "pill bad" : "pill warn"}>{formatStatus(request.status)}</span>
              <h3>{request.gardens?.name ?? "גן"}</h3>
              <p>{request.gardens?.city ?? ""} · תשלום: {request.payment_status}</p>
              <small>מחיר שפורסם בעת הבקשה: {request.published_price_snapshot ? `${request.published_price_snapshot} ₪` : "לא פורסם"}</small>
            </div>
            {request.status === "approved_pending_payment" ? <Link className="button primary tiny" href="/dashboard/parent/payments">מעבר לתשלום</Link> : null}
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
