import Link from "next/link";
import { redirect } from "next/navigation";
import { Baby, Bell, Building2, Camera, Car, FileText, MessageCircle, Palette, ShieldCheck, Utensils, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentChildProfileForm } from "@/components/self-service-forms";
import {
  ParentActionTile,
  ParentAppFrame,
  ParentChildCard,
  ParentEmptyState,
  ParentHero,
  ParentListRow,
  ParentMetricCard,
  ParentSection,
  parentDefaultActions
} from "@/components/parent-app-ui";
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
  const selectedChild = childProfiles[0];
  const selectedGarden = requests[0]?.gardens;

  return (
    <DashboardShell role="parent" title="אזור הורה" appHome>
      <ParentAppFrame active="dashboard" avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="דשבורד הורים" subtitle="מעקב חכם אחר הילד והגן" />

        {selectedChild ? (
          <ParentChildCard
            name={selectedChild.full_name ?? "הילד שלי"}
            meta={`${selectedGarden?.name ?? "עדיין לא משויך לגן"} · ${selectedGarden?.city ?? "בקשת הצטרפות"}`}
            image={(selectedChild as any).photo_url ?? null}
            status={parent?.garden_id ? "הכל תקין" : "ממתין לשיוך"}
            secondary={parent?.garden_id ? "נוכח/ת" : "בקשה פתוחה"}
          />
        ) : (
          <section className="parent-child-card no-child">
            <div>
              <h2>עדיין לא נוסף ילד לחשבון שלך</h2>
              <p>הוסף ילד כדי להגיש בקשת רישום לגן בטוח באזור שלך.</p>
              <div className="parent-child-badges">
                <a className="green" href="#child-profile"><Baby size={18} /> הוסף ילד</a>
                <Link className="blue" href="/dashboard/parent/discover-kindergartens"><Building2 size={18} /> מצא גן בטוח</Link>
              </div>
            </div>
          </section>
        )}

        <section className="parent-metrics-grid">
          <ParentMetricCard title="הודעות חדשות" value={3} hint="לא נקראו" icon={MessageCircle} tone="purple" href="/dashboard/parent/messages" />
          <ParentMetricCard title="סטטוס תשלום" value={approvedPendingPayment.length ? "לטיפול" : "סדר"} hint={approvedPendingPayment.length ? "ממתין לתשלום" : "אין חובות"} icon={WalletCards} tone={approvedPendingPayment.length ? "orange" : "green"} href="/dashboard/parent/payments" />
          <ParentMetricCard title="ציון בטיחות" value={parent?.garden_id ? 95 : "-"} hint={parent?.garden_id ? "מעולה" : "לא פעיל"} icon={ShieldCheck} tone="purple" href="/dashboard/parent/trust-center" />
          <ParentMetricCard title="בקשות פתוחות" value={pending.length} hint="ממתינות לגן" icon={FileText} tone={pending.length ? "orange" : "green"} href="#requests" />
        </section>

        <ParentSection title="ניטור בזמן אמת" subtitle={parent?.garden_id ? selectedGarden?.name ?? "גן הילד" : "ייפתח לאחר אישור הגן"} action={<Link href="/dashboard/parent/cameras">צפה עכשיו</Link>}>
          <div className="parent-camera-card">
            <div className="parent-camera-preview">
              <span>LIVE</span>
            </div>
            <div>
              <span className="parent-camera-icon"><Camera size={30} /></span>
              <h3>{parent?.garden_id ? "כיתה מרכזית" : "מצלמות ייפתחו לאחר אישור"}</h3>
              <p>{parent?.garden_id ? "צפייה לפי מדיניות הגן והרשאות" : "אין גישה למצלמות לפני שיוך פעיל לגן"}</p>
              <Link className="parent-outline-button" href="/dashboard/parent/cameras">צפה עכשיו</Link>
            </div>
          </div>
        </ParentSection>

        <section className="parent-action-grid">
          {parentDefaultActions.map((action) => (
            <ParentActionTile key={action.title} title={action.title} href={action.href} icon={action.icon} tone={action.tone} />
          ))}
        </section>

        <section className="parent-two-columns">
          <ParentSection title="היום בגן">
            <ParentListRow title="ארוחת בוקר" subtitle="הושלם" time="08:15" icon={Utensils} tone="green" />
            <ParentListRow title="מנוחה" subtitle="12:30-13:30" time="12:30" icon={ShieldCheck} tone="purple" />
            <ParentListRow title="פעילות" subtitle="יצירה ומשחק" time="10:45" icon={Palette} tone="purple" />
            <ParentListRow title="שעת איסוף" subtitle="תזכורת פעילה" time="16:15" icon={Car} tone="blue" />
          </ParentSection>

          <ParentSection title="התראות אחרונות">
            {requests.length ? requests.slice(0, 3).map((request) => (
              <ParentListRow
                key={request.id}
                title={`${request.gardens?.name ?? "גן"} · ${formatStatus(request.status)}`}
                subtitle={`${request.gardens?.city ?? ""} · תשלום: ${formatStatus(request.payment_status)}`}
                time={request.requested_at ? new Date(request.requested_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : undefined}
                icon={Bell}
                tone={request.status === "approved" ? "green" : request.status === "rejected" ? "red" : "purple"}
              />
            )) : <ParentEmptyState title="אין התראות חדשות" text="כשתוגש בקשה או יתקבל עדכון מהגן, הוא יופיע כאן." />}
          </ParentSection>
        </section>

        <section className="parent-management-section" id="requests">
          <div className="parent-section-head">
            <div>
              <h3>בקשות הצטרפות</h3>
              <p>סטטוס הבקשות שהגשתם לגנים.</p>
            </div>
            <Link href="/dashboard/parent/discover-kindergartens">הגשת בקשה חדשה</Link>
          </div>
          {requests.length === 0 ? (
            <ParentEmptyState title="עוד לא הוגשה בקשה" text="צרו כרטיס ילד ואז בחרו גן מרשימת הגנים הציבורית." action={<Link className="parent-outline-button" href="/dashboard/parent/discover-kindergartens">מצא גן בטוח</Link>} />
          ) : (
            <div className="parent-request-list">
              {requests.map((request) => (
                <Link href={request.status === "approved_pending_payment" ? "/dashboard/parent/payments" : "#requests"} key={request.id}>
                  <strong>{request.gardens?.name ?? "גן"} · {formatStatus(request.status)}</strong>
                  <span>{request.gardens?.city ?? ""} · תשלום: {formatStatus(request.payment_status)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <ParentSection title="כרטיס ילד" subtitle="המידע נשאר שלך עד שתבחרו גן ותשלחו בקשה." className="parent-management-section">
          <div id="child-profile">
            <ParentChildProfileForm />
          </div>
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
