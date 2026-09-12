import { Baby, CalendarDays, CheckCircle2, CreditCard, FileText, Phone, UserPlus, UserRoundCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { EnrollmentRequestActionButtons } from "@/components/garden-request-action-buttons";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { ManualEnrollmentActivationForm } from "@/components/manual-enrollment-activation-form";
import { requireRole } from "@/lib/auth";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherFilterPills,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

const actions = [
  { value: "review", label: "סימון בבדיקה" },
  { value: "request_information", label: "בקשת מידע נוסף" },
  { value: "approve", label: "אישור ושמירת מקום לפני תשלום" },
  { value: "waitlist", label: "העברה לרשימת המתנה" },
  { value: "reject", label: "דחייה" }
];

export default async function GardenEnrollmentRequestsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const context = await resolveManagementGardenContext(profile);
  const gardenId = context.activeGarden?.id ?? "";
  const [requestsRes, gardenRes, classroomsRes] = await Promise.all([
    supabase.from("kindergarten_enrollment_requests" as any)
      .select("id,parent_id,child_profile_id,garden_id,requested_classroom_id,status,requested_age_group,parent_message,published_price_snapshot,payment_status,decision_reason,information_request,information_response,requested_at,created_at,permanent_child_files:child_profile_id(full_name,birth_date,duplicate_flags),profiles:parent_id(full_name,phone,email)")
      .eq("garden_id", gardenId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("gardens" as any).select("name, city").eq("id", gardenId).maybeSingle(),
    supabase.from("classrooms").select("id,name").eq("garden_id",gardenId).eq("status","active").order("sort_order")
  ]);
  const rows = (requestsRes.data ?? []) as any[];
  const open = rows.filter((row) => ["submitted", "resubmitted", "under_review", "information_required", "awaiting_payment", "waitlisted"].includes(String(row.status)));
  const selected = rows[0];

  return (
    <DashboardShell role="manager" title="בקשות הצטרפות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת"}`} subtitle={(gardenRes.data as any)?.name ?? "בקשות הורים וקליטה"} avatarUrl={(profile as any).profile_image_url ?? null} active="children">
        <TeacherPageTitle icon={UserPlus} title="בקשות הצטרפות חדשות" subtitle="בקשות מהאתר הציבורי להצטרפות לגן" />

        <TeacherStatsGrid>
          <TeacherStatCard title="בקשות חדשות" value={open.length} hint="לטיפול" icon={UserPlus} tone="purple" />
          <TeacherStatCard title="ממתינות לבדיקה" value={rows.filter((row) => row.status === "under_review").length} hint="בדיקה" icon={CalendarDays} tone="blue" />
          <TeacherStatCard title="נדרש מידע" value={rows.filter((row) => row.status === "information_required").length} hint="ממתין להורה" icon={CalendarDays} tone="orange" />
          <TeacherStatCard title="ממתינים לתשלום" value={rows.filter((row) => row.status === "awaiting_payment").length} hint="המקום נשמר" icon={FileText} tone="red" />
        </TeacherStatsGrid>

        <TeacherFilterPills
          items={[
            { label: "היום", href: "/dashboard/garden/enrollment-requests", active: true },
            { label: "השבוע", href: "/dashboard/garden/enrollment-requests" },
            { label: "הכל", href: "/dashboard/garden/enrollment-requests" },
            { label: "קבוצת גיל", href: "/dashboard/garden/enrollment-requests" },
            { label: "סטטוס", href: "/dashboard/garden/enrollment-requests" }
          ]}
        />

        <section className="teacher-children-layout">
          <TeacherSection title="בקשות אחרונות" action={<a href="/dashboard/garden/enrollment-requests">הצג עוד בקשות</a>}>
            {rows.length ? (
              <TeacherCompactList>
                {rows.slice(0, 6).map((row) => (
                  <TeacherCompactItem
                    key={row.id}
                    title={row.permanent_child_files?.full_name ?? "ילד/ה"}
                    subtitle={`${row.requested_age_group ?? "קבוצת גיל"} · ${row.profiles?.full_name ?? "הורה"} · הגיע מהאתר הציבורי`}
                    tone={row.status === "rejected" ? "red" : row.status === "approved" ? "green" : "purple"}
                    meta={row.status === "approved" ? "אושר" : row.status === "rejected" ? "נדחה" : "חדש"}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין בקשות הצטרפות" text="כאשר הורה יבחר את הגן שלך, הבקשה תופיע כאן." />
            )}
          </TeacherSection>

          <TeacherSection title={selected?.permanent_child_files?.full_name ?? "פרטי בקשה"} subtitle={selected ? `${selected.requested_age_group ?? "קבוצת גיל"} · ${selected.profiles?.full_name ?? "הורה"}` : "בחרי בקשה מהרשימה"}>
            {selected ? (
              <div className="teacher-request-detail">
                <TeacherCompactItem title="פרטי הילד" subtitle={`תאריך לידה: ${selected.permanent_child_files?.birth_date ? new Date(selected.permanent_child_files.birth_date).toLocaleDateString("he-IL") : "-"}`} tone="blue" meta={<Baby size={16} />} />
                <TeacherCompactItem title="פרטי ההורה" subtitle={`${selected.profiles?.phone ?? "טלפון חסר"} · ${selected.profiles?.email ?? "אימייל חסר"}`} tone="green" meta={<Phone size={16} />} />
                <TeacherCompactItem title="הערת רישום" subtitle={selected.parent_message ?? "אין הערה מיוחדת"} tone="purple" meta="💬" />
                <EnrollmentRequestActionButtons requestId={selected.id} />
              </div>
            ) : (
              <TeacherEmptyState title="אין בקשה להצגה" text="בקשות חדשות יוצגו כאן עם פרטים ופעולות." />
            )}
          </TeacherSection>
        </section>

        <TeacherAiInsight>
          {selected ? "הילד מתאים לקבוצת הגיל המבוקשת. מומלץ לתאם שיחה קצרה עם ההורה לפני אישור סופי." : "אין בקשות פתוחות כרגע. כשהורה יגיש בקשה, תופיע כאן המלצת המשך טיפול."}
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות בקשה">
          <TeacherActionTile title="אשר המשך טיפול" href="/dashboard/garden/enrollment-requests" icon={CheckCircle2} tone="purple" />
          <TeacherActionTile title="בקשת פרטים נוספים" href="/dashboard/garden/enrollment-requests" icon={FileText} tone="orange" />
          <TeacherActionTile title="קבע פגישה" href="/dashboard/garden/messages" icon={CalendarDays} tone="blue" />
          <TeacherActionTile title="צור קשר" href="/dashboard/garden/messages" icon={Phone} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details">
          <summary>ניהול מלא של בקשות</summary>
          <div className="procedure-list">
            {rows.map((row) => (
              <article className="card procedure-card" key={row.id}>
                <div>
                  <span className={row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status}</span>
                  <h3>{row.permanent_child_files?.full_name ?? "ילד/ה"}</h3>
                  <p>{row.profiles?.full_name ?? "הורה"} · {row.profiles?.phone ?? ""} · תשלום {row.payment_status}</p>
                  <small>קבוצת גיל: {row.requested_age_group ?? "-"} · מחיר שפורסם: {row.published_price_snapshot ? `${row.published_price_snapshot} ₪` : "לא פורסם"}</small>
                  {Array.isArray(row.permanent_child_files?.duplicate_flags) && row.permanent_child_files.duplicate_flags.length ? <span className="pill warn">כפילות אפשרית לבדיקה</span> : null}
                </div>
                <div className="procedure-meta">
                  <Baby />
                  <ApplicationDecisionForm endpoint={`/api/garden/enrollment-requests/${row.id}`} actions={actions} classrooms={(classroomsRes.data ?? []) as Array<{ id: string; name: string }>} />
                  {row.status === "awaiting_payment" ? <ManualEnrollmentActivationForm requestId={row.id} suggestedAmount={row.published_price_snapshot} /> : null}
                  {row.status === "payment_reconciliation_required" ? <span className="pill bad">נדרשת בדיקת תשלום ידנית</span> : null}
                </div>
              </article>
            ))}
            {rows.length === 0 ? <div className="empty-state"><UserRoundCheck /><strong>אין בקשות הצטרפות</strong><span>כאשר הורה יבחר את הגן שלך, הבקשה תופיע כאן.</span></div> : null}
          </div>
        </details>

        <TeacherQuickActions title="עוד">
          <TeacherActionTile title="כספים" href="/dashboard/garden/finance" icon={CreditCard} tone="green" />
          <TeacherActionTile title="ילדי הגן" href="/dashboard/garden/children" icon={UsersRound} tone="purple" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
