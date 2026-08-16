import Link from "next/link";
import { CalendarClock, CheckCircle2, CreditCard, MessageCircle, ShieldCheck, WalletCards } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentMetricCard, ParentSection } from "@/components/parent-app-ui";
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
  if (status === "paid" && debt <= 0) return "green" as const;
  if (status === "overdue" || status === "failed" || status === "not_transferred" || debt > 0) return "orange" as const;
  return "purple" as const;
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
  const attention = children.filter((child) => paymentTone(child.payment_status, Number(child.debt_amount ?? 0)) === "orange");
  const nextPayments = children.filter((child) => child.next_payment_due).sort((a, b) => String(a.next_payment_due).localeCompare(String(b.next_payment_due)));

  return (
    <DashboardShell role="parent" title="תשלומים" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="תשלומים וחיובים" subtitle="תמונה פשוטה וברורה של התשלומים לגן" />

        <section className="parent-metrics-grid">
          <ParentMetricCard title="יתרה פתוחה" value={`₪${totalDebt.toLocaleString("he-IL")}`} hint={totalDebt ? "דורש טיפול" : "אין חוב"} icon={WalletCards} tone={totalDebt ? "orange" : "green"} />
          <ParentMetricCard title="ילדים לתשלום" value={children.length} hint="משויכים" icon={CheckCircle2} tone="purple" />
          <ParentMetricCard title="דורש בדיקה" value={attention.length} hint="סטטוס תשלום" icon={ShieldCheck} tone={attention.length ? "orange" : "green"} />
          <ParentMetricCard title="תשלום קרוב" value={nextPayments[0]?.next_payment_due ? dateText(nextPayments[0].next_payment_due) : "לא נקבע"} hint="מועד הבא" icon={CalendarClock} tone="blue" />
        </section>

        <section className="parent-payment-notice">
          תשלומי הורים שייכים לגן הילדים. גן בטוח מציג ומאשר את התהליך, אך לא מקבל את כספי שכר הלימוד.
        </section>

        <ParentSection title="חיובים לפי ילד" subtitle="כל ילד מוצג רק להורה המשויך אליו">
          {children.length === 0 ? <ParentEmptyState title="אין ילדים משויכים לתשלום" text="לאחר אישור הגן, פרטי התשלום יוצגו כאן." /> : (
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
                      <span className={`parent-status-chip ${paymentTone(child.payment_status, debt)}`}>{paymentLabel(child.payment_status)}</span>
                      <Link className="button secondary tiny" href="/dashboard/parent/messages"><MessageCircle size={14} /> שאלה לגן</Link>
                    </div>
                  </article>
                );
              })}
            </div>
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
