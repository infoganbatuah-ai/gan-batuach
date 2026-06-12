import Link from "next/link";
import { CalendarClock, CheckCircle2, MessageCircle, WalletCards } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

function paymentLabel(status?: string | null) {
  if (status === "paid") return "שולם";
  if (status === "overdue") return "באיחור";
  if (status === "failed" || status === "not_transferred") return "צריך בדיקה";
  if (status === "partial") return "שולם חלקית";
  if (status === "unpaid") return "ממתין לתשלום";
  return "לא עודכן";
}

function paymentTone(status?: string | null, debt = 0) {
  if (status === "paid" && debt <= 0) return "good" as const;
  if (status === "overdue" || status === "failed" || status === "not_transferred" || debt > 0) return "warn" as const;
  return "default" as const;
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL") : "לא נקבע";
}

export default async function ParentPaymentsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const children = (family.enrollments as any[]).map((child) => ({
    ...child,
    id: child.child_id ?? child.permanent_child_file_id,
    garden_name: (family.gardens as any[]).find((garden) => garden.id === (child.garden_id ?? child.kindergarten_id))?.name
  }));
  const totalDebt = children.reduce((sum, child) => sum + Number(child.debt_amount ?? 0), 0);
  const attention = children.filter((child) => paymentTone(child.payment_status, Number(child.debt_amount ?? 0)) === "warn");
  const nextPayments = children.filter((child) => child.next_payment_due).sort((a, b) => String(a.next_payment_due).localeCompare(String(b.next_payment_due)));

  return (
    <DashboardShell role="parent" title="תשלומים">
      <div className="parent-experience-shell">
        <div className="parent-page-head">
          <div>
            <p className="eyebrow">תשלומים</p>
            <h1>תמונה פשוטה של התשלומים לגן.</h1>
            <p>יתרה, תשלום קרוב ופרטי ילד במקום אחד. התשלום מועבר ישירות לחשבון הגן, לא דרך גן בטוח.</p>
          </div>
          <span className={attention.length ? "pill warn" : "pill good"}><WalletCards size={15} /> {attention.length ? "דורש בדיקה" : "מסודר"}</span>
        </div>

        <section className="parent-metric-strip">
          <RoleMetricCard label="יתרה פתוחה" value={`₪${totalDebt.toLocaleString("he-IL")}`} tone={totalDebt ? "warn" : "good"} />
          <RoleMetricCard label="ילדים לתשלום" value={children.length} tone="default" />
          <RoleMetricCard label="דורש בדיקה" value={attention.length} tone={attention.length ? "warn" : "good"} />
          <RoleMetricCard label="תשלום קרוב" value={nextPayments[0]?.next_payment_due ? dateText(nextPayments[0].next_payment_due) : "לא נקבע"} tone="default" />
        </section>

        <section className="warning-banner finance-routing-banner">
          תשלומי הורים שייכים לגן הילדים. גן בטוח מציג ומאשר את התהליך, אך לא מקבל את כספי שכר הלימוד.
        </section>

        <section className="dashboard-section">
          {children.length === 0 ? <EmptyState title="אין ילדים משויכים לתשלום" text="לאחר אישור הגן, פרטי התשלום יוצגו כאן." /> : (
            <div className="parent-payment-list">
              {children.map((child) => {
                const debt = Number(child.debt_amount ?? 0);
                return (
                  <article className="parent-payment-card" key={child.id ?? child.enrollment_id}>
                    <div className="selected-child-strip">
                      <Avatar name={child.full_name} src={child.photo_url} />
                      <div>
                        <strong>{child.full_name}</strong>
                        <span>{child.garden_name ?? "גן משויך"}</span>
                      </div>
                    </div>
                    <div className="parent-trust-list">
                      <span>סטטוס <b>{paymentLabel(child.payment_status)}</b></span>
                      <span>תשלום הבא <b>{dateText(child.next_payment_due)}</b></span>
                      <span>יתרה <b>₪{debt.toLocaleString("he-IL")}</b></span>
                      <span>תשלום אחרון <b>{dateText(child.last_payment_date)}</b></span>
                    </div>
                    <div className="profile-actions">
                      <StatusBadge tone={paymentTone(child.payment_status, debt)}>{paymentLabel(child.payment_status)}</StatusBadge>
                      <Link className="button secondary tiny" href="/dashboard/parent/messages"><MessageCircle size={14} /> שאלה לגן</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="parent-camera-promise">
          <article><CheckCircle2 /><h2>ברור</h2><p>הורה רואה רק את מצב התשלום של הילדים שלו.</p></article>
          <article><CalendarClock /><h2>רגוע</h2><p>אין חיוב אוטומטי במסך הזה. שאלות עוברות לגן.</p></article>
          <article><WalletCards /><h2>אמצעי תשלום</h2><p>מוכן לאשראי, Apple Pay ו-Google Pay דרך ספק מאושר וללא שמירת פרטי אשראי גולמיים.</p></article>
        </section>
      </div>
    </DashboardShell>
  );
}
