import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, MessageCircle, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { FinanceFrame } from "@/components/finance-platform-frame";
import { FinanceEmpty, FinanceHero, FinanceMetric, FinanceMetrics, FinanceSection, FinanceStatus, FinanceTruthBanner, dateText, money, periodText } from "@/components/finance-platform-ui";
import { requireRole } from "@/lib/auth";
import { guardianChildIds } from "@/lib/management/family-link";
import { createClient } from "@/lib/supabase/server";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";

type Enrollment = { id: string; child_id?: string | null; permanent_child_file_id: string; children?: { full_name?: string | null; photo_url?: string | null } | null; gardens?: { name?: string | null } | null };
type Search = { child?: string; status?: string };

export default async function ParentPaymentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { profile } = await requireRole(["parent"]);
  const params = await searchParams;
  const supabase = await createClient();
  const authorizedChildIds = await guardianChildIds(supabase, profile.id);
  const enrollmentsRes = authorizedChildIds.length ? await supabase.from("child_kindergarten_enrollments" as never)
    .select("id,child_id,permanent_child_file_id,children(full_name,photo_url),gardens(name)" as never).in("permanent_child_file_id", authorizedChildIds).order("created_at", { ascending: false }) : { data: [], error: null };
  const enrollments = (enrollmentsRes.data ?? []) as unknown as Enrollment[];
  const allowedSelection = params.child && authorizedChildIds.includes(params.child) ? params.child : authorizedChildIds[0];
  const selectedEnrollmentIds = enrollments.filter((item) => !allowedSelection || item.permanent_child_file_id === allowedSelection).map((item) => item.id);
  const periodsRes = selectedEnrollmentIds.length ? await supabase.from("tuition_billing_periods" as never)
    .select("id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never)
    .in("enrollment_id", selectedEnrollmentIds).order("period_start", { ascending: false }).limit(100) : { data: [], error: null };
  const periodRows = ((periodsRes.data ?? []) as unknown as TuitionPeriod[]).map((item) => projectTuitionPeriod(item));
  const periods = periodRows.filter((item) => !params.status || item.status === params.status);
  const byEnrollment = new Map(enrollments.map((item) => [item.id, item]));
  const selectedEnrollment = enrollments.find((item) => item.permanent_child_file_id === allowedSelection);
  const selectedName = selectedEnrollment?.children?.full_name ?? "הילד/ה שלי";
  const totalDue = periodRows.reduce((sum, item) => sum + item.amount_due, 0);
  const paid = periodRows.reduce((sum, item) => sum + item.amount_settled, 0);
  const outstanding = periodRows.reduce((sum, item) => sum + item.outstanding, 0);
  const attention = periodRows.filter((item) => ["overdue", "reconciliation_required"].includes(item.status));
  const nextDue = periodRows.filter((item) => item.outstanding > 0 && item.due_at).sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))[0];
  const financeUnavailable = Boolean(enrollmentsRes.error || periodsRes.error);

  return <DashboardShell role="parent" title="שכר לימוד" appHome>
    <FinanceFrame role="parent" name={profile.full_name} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url} activeHref="/dashboard/parent/payments" title="שכר לימוד" subtitle="חיובים ותשלומים של הילדים שלי">
      <FinanceHero eyebrow={selectedEnrollment?.gardens?.name ?? "הגן המשויך"} title={`התשלומים של ${selectedName}`} text="יתרה, תקופות חיוב והיסטוריית תשלומים לכל ילד — עם הפרדה מלאה ממנוי הפלטפורמה של הגן." action={<Link className="button secondary" href="/dashboard/parent/messages"><MessageCircle size={17} /> שאלה לגן</Link>} />
      {authorizedChildIds.length > 1 ? <nav className="finance-child-switcher" aria-label="בחירת ילד">{authorizedChildIds.map((fileId) => { const enrollment = enrollments.find((item) => item.permanent_child_file_id === fileId); const name = enrollment?.children?.full_name ?? "ילד/ה"; return <Link className={fileId === allowedSelection ? "active" : ""} href={`/dashboard/parent/payments?child=${fileId}`} key={fileId}><span>{name.slice(0, 1)}</span>{name}</Link>; })}</nav> : null}
      {enrollmentsRes.error || periodsRes.error ? <FinanceTruthBanner kind="warning" title="נתוני שכר הלימוד אינם זמינים במלואם" text="המערכת אינה מציגה סכום אפס במקום נתונים שנכשלו. אפשר לנסות שוב מאוחר יותר." /> : null}
      <FinanceMetrics>
        <FinanceMetric label="יתרה פתוחה" value={financeUnavailable ? "לא זמין" : money(outstanding)} hint={financeUnavailable ? "מקור הנתונים לא נטען" : outstanding ? "דורש טיפול מול הגן" : "אין יתרה"} icon={WalletCards} tone={financeUnavailable ? "neutral" : outstanding ? "orange" : "green"} />
        <FinanceMetric label="נרשם כשולם" value={financeUnavailable ? "לא זמין" : money(paid)} hint={financeUnavailable ? "לא מוצג סכום חלופי" : `מתוך ${money(totalDue)}`} icon={CheckCircle2} tone={financeUnavailable ? "neutral" : "green"} />
        <FinanceMetric label="דורש בדיקה" value={financeUnavailable ? "לא זמין" : attention.length} hint={financeUnavailable ? "הספירה אינה ידועה" : "איחור או התאמה"} icon={ShieldCheck} tone={financeUnavailable ? "neutral" : attention.length ? "red" : "green"} />
        <FinanceMetric label="מועד הבא" value={financeUnavailable ? "לא זמין" : nextDue ? dateText(nextDue.due_at) : "לא נקבע"} hint={financeUnavailable ? "נדרש רענון" : nextDue ? money(nextDue.outstanding) : "אין חיוב קרוב"} icon={CalendarClock} tone="blue" />
      </FinanceMetrics>
      <FinanceTruthBanner title="שכר הלימוד שייך לגן" text="גן בטוח מציג את הספר הקנוני. תשלום ידני מופיע רק אחרי אישור הגן; אין כאן חיוב אוטומטי או אישור ספק מדומה." />
      <div className="finance-two-column">
        <FinanceSection title="תקופות חיוב" text="פירוט לפי חודש עבור הילד שנבחר" action={<nav className="finance-filter-bar" aria-label="סינון סטטוס"><Link className={!params.status ? "active" : ""} href={`/dashboard/parent/payments?child=${allowedSelection ?? ""}`}>הכל</Link><Link className={params.status === "overdue" ? "active" : ""} href={`/dashboard/parent/payments?child=${allowedSelection ?? ""}&status=overdue`}>באיחור</Link><Link className={params.status === "paid" ? "active" : ""} href={`/dashboard/parent/payments?child=${allowedSelection ?? ""}&status=paid`}>שולם</Link></nav>}>
          <div className="finance-ledger"><div className="finance-ledger-head"><span>ילד/ה</span><span>תקופה</span><span>לחיוב</span><span>שולם</span><span>יתרה</span><span>סטטוס</span></div>{periods.map((period) => { const enrollment = byEnrollment.get(period.enrollment_id); const name = enrollment?.children?.full_name ?? selectedName; return <article className="finance-ledger-row" key={period.id}><div className="finance-ledger-person"><span className="finance-ledger-avatar">{name.slice(0, 1)}</span><span><b>{name}</b><small>{enrollment?.gardens?.name ?? "הגן המשויך"}</small></span></div><div className="finance-ledger-cell"><b>{periodText(period.period_start)}</b><small>{period.due_at ? `עד ${dateText(period.due_at)}` : "מועד לא הוגדר"}</small></div><div className="finance-ledger-cell"><b>{money(period.amount_due)}</b></div><div className="finance-ledger-cell"><b>{money(period.amount_settled)}</b></div><div className="finance-ledger-cell"><b>{money(period.outstanding)}</b>{period.unapplied_credit_total ? <small>זיכוי בבדיקה {money(period.unapplied_credit_total)}</small> : null}</div><FinanceStatus status={period.status} /></article>; })}{!financeUnavailable && !periods.length ? <FinanceEmpty title="אין תקופות חיוב להצגה" text="הגן ייצור תקופה רק לאחר שיש הרשמה פעילה ומחיר מוסכם." /> : null}</div>
        </FinanceSection>
        <FinanceSection title="מצב נוכחי" text="פרטי התקופה האחרונה">
          <div className="finance-balance-card"><div><h3>יתרה לתשלום</h3><strong>{financeUnavailable ? "לא זמין" : money(outstanding)}</strong><p>{selectedName} · {selectedEnrollment?.gardens?.name ?? "גן משויך"}</p></div><WalletCards size={42} /></div>
          <div className="finance-history" style={{ marginTop: 12 }}>{periodRows.slice(0, 4).map((period) => <article className="finance-history-row" key={period.id}><span><ReceiptText size={21} /></span><div><b>{periodText(period.period_start)} · {money(period.amount_settled)}</b><small>{period.amount_settled > 0 ? "תשלום שנרשם בידי הגן" : "טרם נרשם תשלום"}</small></div><FinanceStatus status={period.status} /></article>)}</div>
        </FinanceSection>
      </div>
      <div className="finance-three-column">
        <div className="finance-domain-card"><header><span><FileText size={22} /></span><h3>קבלות ומסמכים</h3></header><p>מסמך יוצג רק אם קיים מקור קנוני מאושר. אין מספרי קבלה או חשבונית מומצאים.</p><FinanceStatus status="pending">ספק מסמכים לא זמין</FinanceStatus></div>
        <div className="finance-domain-card"><header><span><AlertTriangle size={22} /></span><h3>תשלום חלקי</h3></header><p>תשלום חלקי אינו מסומן כשולם. היתרה נשארת גלויה עד הסילוק.</p><b>{periodRows.filter((item) => item.status === "partially_paid").length} תקופות</b></div>
        <div className="finance-domain-card"><header><span><ShieldCheck size={22} /></span><h3>פרטיות המשפחה</h3></header><p>מוצגים רק ילדים המקושרים לחשבון ההורה. מעבר ילד מעדכן את כל הנתונים.</p><FinanceStatus status="verified">גישה מאומתת</FinanceStatus></div>
      </div>
      <FinanceTruthBanner kind="warning" title="תשלום אלקטרוני אינו זמין" text="לא מוצגים אשראי, Apple Pay, Google Pay או אמצעי חיצוני כפעיל ללא ספק מאומת. ניתן לפנות לגן להסדר ידני." />
    </FinanceFrame>
  </DashboardShell>;
}
