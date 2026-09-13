import Link from "next/link";
import { CalendarClock, CheckCircle2, CreditCard, MessageCircle, ShieldCheck, WalletCards } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentMetricCard, ParentSection } from "@/components/parent-app-ui";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { guardianChildIds } from "@/lib/management/family-link";
import { createClient } from "@/lib/supabase/server";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "לא נקבע";
}

type PendingEnrollmentRequest = {
  id: string;
  status: string;
  payment_status: string;
  gardens?: { name?: string | null } | null;
};

export default async function ParentPaymentsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const authorizedChildIds = await guardianChildIds(supabase, profile.id);
  const tuitionEnrollments = authorizedChildIds.length ? await supabase.from("child_kindergarten_enrollments" as never)
    .select("id,permanent_child_file_id,children(full_name),gardens(name)" as never).in("permanent_child_file_id", authorizedChildIds) : { data: [] };
  const tuitionEnrollmentIds = ((tuitionEnrollments.data ?? []) as unknown as Array<{ id: string }>).map(item => item.id);
  const tuitionEnrollmentById = new Map(((tuitionEnrollments.data ?? []) as unknown as Array<{ id: string; children?: { full_name?: string } | null; gardens?: { name?: string } | null }>).map(item => [item.id, item]));
  const tuitionRows = tuitionEnrollmentIds.length ? await supabase.from("tuition_billing_periods" as never)
    .select("id,garden_id,enrollment_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never)
    .in("enrollment_id", tuitionEnrollmentIds).order("period_start", { ascending: false }).limit(100) : { data: [] };
  const tuitionPeriods = ((tuitionRows.data ?? []) as unknown as TuitionPeriod[]).map(item => projectTuitionPeriod(item));
  const pendingRequests = authorizedChildIds.length ? await supabase.from("kindergarten_enrollment_requests" as never)
    .select("id,child_profile_id,status,payment_status,gardens(name)" as never).eq("parent_id", profile.id)
    .in("child_profile_id", authorizedChildIds).in("status", ["awaiting_payment", "payment_reconciliation_required"]) : { data: [] };
  const children = (family.enrollments as any[]).map((child) => ({
    ...child,
    id: child.child_id ?? child.permanent_child_file_id,
    garden_name: (family.gardens as any[]).find((garden) => garden.id === (child.garden_id ?? child.kindergarten_id))?.name
  }));
  const totalDebt = tuitionPeriods.reduce((sum, period) => sum + period.outstanding, 0);
  const attention = tuitionPeriods.filter(period => period.status === "overdue" || period.status === "reconciliation_required");
  const nextPayments = tuitionPeriods.filter(period => period.due_at && period.outstanding > 0).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));

  return (
    <DashboardShell role="parent" title="תשלומים" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="תשלומים וחיובים" subtitle="תמונה פשוטה וברורה של התשלומים לגן" />

        <section className="parent-metrics-grid">
          <ParentMetricCard title="יתרה פתוחה" value={tuitionPeriods.length ? `₪${totalDebt.toLocaleString("he-IL")}` : "לא הוגדר"} hint={tuitionPeriods.length ? (totalDebt ? "דורש טיפול" : "אין חוב") : "טרם נוצרו תקופות חיוב"} icon={WalletCards} tone={totalDebt ? "orange" : "green"} />
          <ParentMetricCard title="ילדים לתשלום" value={children.length} hint="משויכים" icon={CheckCircle2} tone="purple" />
          <ParentMetricCard title="דורש בדיקה" value={attention.length} hint="סטטוס תשלום" icon={ShieldCheck} tone={attention.length ? "orange" : "green"} />
          <ParentMetricCard title="תשלום קרוב" value={nextPayments[0]?.due_at ? dateText(nextPayments[0].due_at) : "לא נקבע"} hint="מועד הבא" icon={CalendarClock} tone="blue" />
        </section>

        <section className="parent-payment-notice">
          תשלומי הורים שייכים לגן הילדים. גן בטוח מציג ומאשר את התהליך, אך לא מקבל את כספי שכר הלימוד.
        </section>

        <ParentSection title="ספר חיובים לפי חודש" subtitle="תשלום ידני נרשם רק לאחר אישור הגן; אין חיוב אלקטרוני במסך זה">
          {tuitionPeriods.length ? <div className="parent-payment-list">{tuitionPeriods.map(period => <article className="parent-payment-card" key={period.id}>
            <strong>{tuitionEnrollmentById.get(period.enrollment_id)?.children?.full_name ?? "ילד/ה"} · {tuitionEnrollmentById.get(period.enrollment_id)?.gardens?.name ?? "גן"} · {period.period_start.slice(0, 7)}</strong>
            <span>לחיוב ₪{period.amount_due} · נרשם ₪{period.amount_settled} · יתרה ₪{period.outstanding}</span>
            {period.unapplied_credit_total > 0 ? <span>זיכוי שלא שויך עדיין ₪{period.unapplied_credit_total}</span> : null}
            <span>{period.status === "reconciliation_required" ? "נדרשת בדיקת תשלום" : period.status === "paid" ? "שולם" : period.status === "overdue" ? "באיחור" : period.status === "partially_paid" ? "שולם חלקית" : "ממתין"}</span>
          </article>)}</div> : <ParentEmptyState title="אין עדיין תקופות חיוב" text="הגן יגדיר תקופת חיוב ומחיר מוסכם לפני שיוצג סכום לתשלום." />}
        </ParentSection>

        <ParentSection title="חיובים לפי ילד" subtitle="כל ילד מוצג רק להורה המשויך אליו">
          {children.length === 0 ? <ParentEmptyState title="אין ילדים משויכים לתשלום" text="לאחר אישור הגן, פרטי התשלום יוצגו כאן." /> : (
            <div className="parent-payment-list">
              {children.map((child) => {
                return (
                  <article className="parent-payment-card" key={child.id ?? child.enrollment_id}>
                    <div className="selected-child-strip">
                      <Avatar name={child.full_name} src={child.photo_url} />
                      <div>
                        <strong>{child.full_name}</strong>
                        <span>{child.garden_name ?? "גן משויך"}</span>
                      </div>
                    </div>
                    <div className="parent-trust-list"><span>תקופות החיוב והיתרות המוסכמות מוצגות בספר החיובים למעלה.</span></div>
                    <div className="profile-actions">
                      <Link className="button secondary tiny" href="/dashboard/parent/messages"><MessageCircle size={14} /> שאלה לגן</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </ParentSection>

        <ParentSection title="הרשמות לפני הפעלה" subtitle="אישור הגן עדיין אינו הרשמה פעילה">
          {(pendingRequests.data ?? []).length === 0 ? <ParentEmptyState title="אין הרשמות שממתינות להסדר תשלום" text="בקשה שאושרה תופיע כאן עד להפעלה בפועל." /> : (
            <div className="parent-payment-list">{((pendingRequests.data ?? []) as unknown as PendingEnrollmentRequest[]).map((request) => <article className="parent-payment-card" key={request.id}>
              <strong>{request.gardens?.name ?? "גן"}</strong>
              <span>{request.status === "payment_reconciliation_required" ? "נדרשת בדיקת תשלום ידנית" : "ממתין להסדר תשלום"}</span>
              <span className={`parent-status-chip ${request.status === "payment_reconciliation_required" ? "orange" : "purple"}`}>{request.payment_status === "reconciliation_required" ? "בעיה בבדיקת התשלום" : "טרם הופעל"}</span>
            </article>)}</div>
          )}
        </ParentSection>

        <section className="parent-payment-methods">
          <article><CheckCircle2 /><h2>ברור</h2><p>הורה רואה רק את מצב התשלום של הילדים שלו.</p></article>
          <article><CalendarClock /><h2>רגוע</h2><p>אין חיוב אוטומטי במסך הזה. שאלות עוברות לגן.</p></article>
          <article><CreditCard /><h2>אמצעי תשלום</h2><p>מוכן לספק מאושר וללא שמירת פרטי אשראי גולמיים.</p></article>
        </section>
      </ParentAppFrame>
    </DashboardShell>
  );
}
