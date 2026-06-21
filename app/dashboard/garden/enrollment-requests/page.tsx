import { Baby, CalendarDays, CheckCircle2, CreditCard, FileText, Phone, UserPlus, UserRoundCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { EnrollmentRequestActionButtons } from "@/components/garden-request-action-buttons";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
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
  { value: "under_review", label: "סימון בבדיקה" },
  { value: "request_more_information", label: "בקשת מידע נוסף" },
  { value: "approve_pending_payment", label: "אישור ממתין לתשלום" },
  { value: "approve_without_payment", label: "אישור והפעלה ללא תשלום" },
  { value: "mark_payment_paid", label: "תשלום הושלם והפעלה" },
  { value: "reject", label: "דחייה" }
];

export default async function GardenEnrollmentRequestsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const requestsRes = await supabase.from("kindergarten_enrollment_requests" as any)
    .select("*, permanent_child_files:child_profile_id(full_name,birth_date,allergies,medical_notes,important_notes,duplicate_flags), profiles:parent_id(full_name,phone,email)")
    .eq("garden_id", gardenId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (requestsRes.data ?? []) as any[];
  const open = rows.filter((row) => ["submitted", "under_review", "more_information_requested", "approved_pending_payment"].includes(String(row.status)));
  const paymentPending = rows.filter((row) => row.status === "approved_pending_payment");
  const selected = rows[0];

  return (
    <DashboardShell role="manager" title="בקשות הצטרפות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="גן שמש, תל אביב" avatarUrl={(profile as any).avatar_url ?? null} active="children">
        <TeacherPageTitle icon={UserPlus} title="בקשות הצטרפות חדשות" subtitle="בקשות מהאתר הציבורי להצטרפות לגן" />

        <TeacherStatsGrid>
          <TeacherStatCard title="בקשות חדשות" value={open.length} hint="לטיפול" icon={UserPlus} tone="purple" />
          <TeacherStatCard title="ממתינות לבדיקה" value={rows.filter((row) => row.status === "under_review").length} hint="בדיקה" icon={CalendarDays} tone="blue" />
          <TeacherStatCard title="פגישה נקבעה" value={rows.filter((row) => row.status === "more_information_requested").length} hint="השלמת מידע" icon={CalendarDays} tone="orange" />
          <TeacherStatCard title="חסרים מסמכים" value={rows.filter((row) => row.status === "approved_pending_payment").length} hint="תשלום/מסמך" icon={FileText} tone="red" />
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
                  {row.permanent_child_files?.allergies || row.permanent_child_files?.medical_notes ? <small>מידע רפואי נשלח לבדיקת הגן ונדרש טיפול דיסקרטי.</small> : null}
                  {Array.isArray(row.duplicate_flags) && row.duplicate_flags.length ? <span className="pill warn">כפילות אפשרית לבדיקה</span> : null}
                </div>
                <div className="procedure-meta">
                  <Baby />
                  <ApplicationDecisionForm endpoint={`/api/garden/enrollment-requests/${row.id}`} actions={actions} />
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
