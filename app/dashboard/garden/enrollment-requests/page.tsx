import { Baby, CreditCard, UserRoundCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <DashboardShell role="manager" title="בקשות הצטרפות">
      <section className="dashboard-hero-card manager-hero-card">
        <div>
          <p className="eyebrow">Enrollment Requests</p>
          <h1>בקשות הורים להצטרפות לגן.</h1>
          <p>מוצגים רק ילדים והורים שבחרו לשלוח בקשה לגן שלך. אישור לא פותח גישה עד הפעלה ותשלום אם נדרש.</p>
        </div>
        <span className={open.length ? "pill warn" : "pill good"}>{open.length} פתוחות</span>
      </section>
      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="כל הבקשות" value={rows.length} />
        <RoleMetricCard label="פתוחות" value={open.length} tone={open.length ? "warn" : "good"} />
        <RoleMetricCard label="ממתינות לתשלום" value={paymentPending.length} tone={paymentPending.length ? "warn" : "good"} />
        <RoleMetricCard label="הופעלו" value={rows.filter((row) => row.status === "approved").length} tone="good" />
      </section>
      <section className="procedure-list">
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
      </section>
      <section className="staff-action-grid">
        <ActionCard title="כספים" text="תשלומי הורים נשארים זרם נפרד מהכנסות גן בטוח" href="/dashboard/garden/finance" icon={CreditCard} />
      </section>
    </DashboardShell>
  );
}
