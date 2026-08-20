import Link from "next/link";
import { Baby, Bell, Building2, CalendarDays, Camera, FileText, MessageCircle, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentChildProfileForm } from "@/components/self-service-forms";
import { ParentKindergartenInvitationsPanel } from "@/components/parent-kindergarten-invitations-panel";
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
import { cleanSyntheticLabel, isSyntheticLabel } from "@/lib/domain/display-label";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
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
  const family = await getParentFamilyContext(supabase as any, profile);
  const parent = parentRes.data as any;
  const childProfiles = (childrenRes.data ?? []) as any[];
  const requests = (requestsRes.data ?? []) as any[];
  const pending = requests.filter((request) => !["approved", "rejected", "cancelled", "expired"].includes(String(request.status)));
  const approvedPendingPayment = requests.filter((request) => request.status === "approved_pending_payment");
  const activeEnrollment = (family.enrollments as any[]).find((enrollment) => ["active", "approved"].includes(String(enrollment.status))) ?? (family.enrollments as any[])[0];
  const selectedChild = activeEnrollment ?? childProfiles[0];
  const selectedGarden = (family.gardens as any[]).find((garden) => garden.id === (activeEnrollment?.garden_id ?? activeEnrollment?.kindergarten_id)) ?? requests[0]?.gardens;
  const hasActiveKindergarten = Boolean((family.gardenIds ?? []).length || parent?.garden_id);
  const scheduleRes = hasActiveKindergarten && (family.gardenIds ?? []).length
    ? await supabase
      .from("schedule_items" as any)
      .select("id,title,description,starts_at,visible_to_parents")
      .in("garden_id", family.gardenIds)
      .eq("visible_to_parents", true)
      .order("starts_at", { ascending: true })
      .limit(4)
    : { data: [] };
  const scheduleItems = (scheduleRes.data ?? []) as any[];
  const safetyScore = selectedGarden?.last_inspection_score ?? null;
  const unreadOrPendingCount = pending.length;
  const syntheticSession = [profile.full_name, selectedChild?.full_name, selectedGarden?.name].some(isSyntheticLabel);

  return (
    <DashboardShell role="parent" title="אזור הורה" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="דשבורד הורים" subtitle="מעקב חכם אחר הילד והגן" />

        {syntheticSession ? <div className="dashboard-environment-notice" role="status">סביבת בדיקה עם נתונים סינתטיים בלבד. נתוני ילדים והורים אמיתיים אינם מופעלים כאן.</div> : null}

        <ParentKindergartenInvitationsPanel />

        {selectedChild ? (
          <ParentChildCard
            name={cleanSyntheticLabel(selectedChild.full_name, "הילד שלי")}
            meta={`${cleanSyntheticLabel(selectedGarden?.name, "עדיין לא משויך לגן")} · ${cleanSyntheticLabel(selectedGarden?.city, "בקשת הצטרפות")}`}
            image={(selectedChild as any).photo_url ?? null}
            status={hasActiveKindergarten ? "משויך לגן" : "ממתין לשיוך"}
            secondary={hasActiveKindergarten ? "מידע לפי הרשאה" : "בקשה פתוחה"}
            href={`/dashboard/parent/children/${selectedChild.child_id ?? selectedChild.permanent_child_file_id ?? selectedChild.id}`}
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
          <ParentMetricCard title="עדכונים פתוחים" value={unreadOrPendingCount} hint="בקשות/התראות לטיפול" icon={MessageCircle} tone={unreadOrPendingCount ? "orange" : "green"} href="/dashboard/parent/messages" />
          <ParentMetricCard title="סטטוס תשלום" value={approvedPendingPayment.length ? "לטיפול" : hasActiveKindergarten ? "אין דרישה" : "טרם הוגדר"} hint={approvedPendingPayment.length ? "ממתין לתשלום" : hasActiveKindergarten ? "אין דרישת תשלום פתוחה" : "יופיע לאחר אישור הצטרפות"} icon={WalletCards} tone={approvedPendingPayment.length ? "orange" : hasActiveKindergarten ? "green" : "neutral"} href="/dashboard/parent/payments" />
          <ParentMetricCard title="ציון בטיחות" value={safetyScore ?? "לא פורסם"} hint={safetyScore !== null ? "סיכום שאושר להצגה" : "יופיע אחרי פרסום הגן"} icon={ShieldCheck} tone={safetyScore !== null ? "purple" : "neutral"} href="/dashboard/parent/trust-center" />
          <ParentMetricCard title="בקשות פתוחות" value={pending.length} hint="ממתינות לגן" icon={FileText} tone={pending.length ? "orange" : "green"} href="#requests" />
        </section>

        <ParentSection title="מצב מצלמות" subtitle={hasActiveKindergarten ? cleanSyntheticLabel(selectedGarden?.name, "גן הילד") : "ייפתח לאחר אישור הגן"} action={<Link href="/dashboard/parent/cameras">בדיקת זמינות</Link>}>
          <div className="parent-camera-card">
            <div className="parent-camera-preview">
              <Camera size={44} />
              <strong>אין שידור חי במסך הבית</strong>
              <span>{hasActiveKindergarten ? "בדיקת הרשאה נדרשת" : "ממתין לשיוך"}</span>
            </div>
            <div>
              <span className="parent-camera-icon"><Camera size={30} /></span>
              <h3>{hasActiveKindergarten ? "צפיית הורים נעולה עד לבדיקת הרשאה" : "מצלמות ייפתחו רק לאחר אישור"}</h3>
              <p>{hasActiveKindergarten ? "מסך הסטטוס יבדוק אם הגן, המדיניות והשער המאובטח מאפשרים צפייה. אין כאן תצוגת וידאו מדומה." : "אין גישה למצלמות לפני שיוך פעיל לגן."}</p>
              <Link className="parent-outline-button" href="/dashboard/parent/cameras">בדוק זמינות</Link>
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
            {scheduleItems.length ? scheduleItems.map((item) => (
              <ParentListRow
                key={item.id}
                title={item.title ?? "פעילות"}
                subtitle={item.description ?? "פורסם על ידי הגן"}
                time={item.starts_at ? new Date(item.starts_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : undefined}
                icon={CalendarDays}
                tone="purple"
              />
            )) : <ParentEmptyState title="אין לו״ז מפורסם כרגע" text="כאשר הגן יפרסם סדר יום להורים, הוא יופיע כאן." />}
          </ParentSection>

          <ParentSection title="התראות אחרונות">
            {requests.length ? requests.slice(0, 3).map((request) => (
              <ParentListRow
                key={request.id}
                title={`${cleanSyntheticLabel(request.gardens?.name, "גן")} · ${formatStatus(request.status)}`}
                subtitle={`${cleanSyntheticLabel(request.gardens?.city)} · תשלום: ${formatStatus(request.payment_status)}`}
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
                  <strong>{cleanSyntheticLabel(request.gardens?.name, "גן")} · {formatStatus(request.status)}</strong>
                  <span>{cleanSyntheticLabel(request.gardens?.city)} · תשלום: {formatStatus(request.payment_status)}</span>
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
