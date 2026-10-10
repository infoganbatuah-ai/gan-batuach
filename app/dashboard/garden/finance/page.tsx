import Link from "next/link";
import { PermissionDeniedState } from "@/components/global-state-system";
import { BarChart3, CheckCircle2, CircleDollarSign, Clock3, CreditCard, Landmark, ReceiptText, RefreshCcw, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { FinanceFrame } from "@/components/finance-platform-frame";
import { FinanceEmpty, FinanceHero, FinanceMetric, FinanceMetrics, FinanceQuickActions, FinanceSection, FinanceStatus, FinanceTruthBanner, dateText, money, periodText } from "@/components/finance-platform-ui";
import { loadGardenSubscriptionData } from "@/lib/domain/billing";
import { projectTuitionPeriod, type TuitionPeriod } from "@/lib/domain/tuition-ledger";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Search = { status?: string; period?: string };
type Enrollment = { id: string; child_id: string; children?: { full_name?: string | null; photo_url?: string | null } | null };
type LedgerEntry = { id: string; period_id: string; entry_kind: string; amount: number; method?: string | null; reason?: string | null; created_at: string };

export default async function GardenFinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await getManagementGardenContext();
  if (!access.allowed) return <PermissionDeniedState backHref="/dashboard/garden" description="מרכז הכספים זמין רק לבעלי תפקיד מורשים בגן הפעיל." />;
  const params = await searchParams;
  const role = access.session.profile.role === "owner" ? "owner" : "manager";
  const supabase = await createClient();
  const [periodsRes, enrollmentsRes, entriesRes, gardenRes, subscription] = await Promise.all([
    supabase.from("tuition_billing_periods" as never).select("id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason" as never).eq("garden_id", access.gardenId).order("period_start", { ascending: false }).limit(200),
    supabase.from("child_kindergarten_enrollments" as never).select("id,child_id,children(full_name,photo_url)" as never).eq("garden_id", access.gardenId).eq("status", "active").limit(200),
    supabase.from("tuition_ledger_entries" as never).select("id,period_id,entry_kind,amount,method,reason,created_at" as never).eq("garden_id", access.gardenId).order("created_at", { ascending: false }).limit(12),
    supabase.from("gardens" as never).select("name" as never).eq("id", access.gardenId).maybeSingle(),
    loadGardenSubscriptionData(supabase as never, access.gardenId)
  ]);
  const sourceError = periodsRes.error || enrollmentsRes.error || entriesRes.error || gardenRes.error;
  const tuitionUnavailable = Boolean(sourceError);
  const subscriptionUnavailable = subscription.errors.length > 0;
  const enrollments = (enrollmentsRes.data ?? []) as unknown as Enrollment[];
  const enrollmentById = new Map(enrollments.map((item) => [item.id, item]));
  const allPeriods = ((periodsRes.data ?? []) as unknown as TuitionPeriod[]).map((item) => projectTuitionPeriod(item));
  const periods = allPeriods.filter((item) => (!params.status || item.status === params.status) && (!params.period || item.period_start.startsWith(params.period)));
  const entries = (entriesRes.data ?? []) as unknown as LedgerEntry[];
  const periodById = new Map(allPeriods.map((item) => [item.id, item]));
  const expected = allPeriods.reduce((sum, item) => sum + item.amount_due, 0);
  const collected = allPeriods.reduce((sum, item) => sum + item.amount_settled, 0);
  const outstanding = allPeriods.reduce((sum, item) => sum + item.outstanding, 0);
  const overdue = allPeriods.filter((item) => item.status === "overdue");
  const reconciliation = allPeriods.filter((item) => item.status === "reconciliation_required");
  const partial = allPeriods.filter((item) => item.status === "partially_paid");
  const collectionRate = expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const currentSubscription = subscription.subscription as Record<string, unknown> | null;
  const gardenName = String((gardenRes.data as { name?: string } | null)?.name ?? "הגן הפעיל");

  return <DashboardShell role={role} title="מרכז כספים" appHome>
    <FinanceFrame role={role} name={access.session.profile.full_name} avatarUrl={(access.session.profile as { profile_image_url?: string | null }).profile_image_url} activeHref="/dashboard/garden/finance">
      <FinanceHero eyebrow={gardenName} title="מרכז הכספים של הגן" text="גביית שכר לימוד, מעקב יתרות והתאמות — לצד מנוי גן בטוח במסלול נפרד וברור." action={<><Link className="button primary" href="/dashboard/garden/tuition-ledger"><WalletCards size={18} /> פתיחת ספר שכר לימוד</Link><Link className="button secondary" href="/dashboard/garden/reports"><BarChart3 size={18} /> דוחות</Link></>} />
      {sourceError ? <FinanceTruthBanner kind="warning" title="חלק מנתוני הכספים אינם זמינים" text="המסך אינו מחליף מקור נתונים שנכשל בסכום אפס. נסו לרענן או חזרו מאוחר יותר." /> : null}
      <FinanceMetrics>
        <FinanceMetric label="צפוי בתקופות המוצגות" value={tuitionUnavailable ? "לא זמין" : money(expected)} hint={tuitionUnavailable ? "מקור הנתונים לא נטען" : `${allPeriods.length} תקופות חיוב`} icon={CircleDollarSign} tone="blue" />
        <FinanceMetric label="נרשם כשולם" value={tuitionUnavailable ? "לא זמין" : money(collected)} hint={tuitionUnavailable ? "לא מוצג סכום חלופי" : `${collectionRate}% מהחיוב`} icon={CheckCircle2} tone={tuitionUnavailable ? "neutral" : "green"} />
        <FinanceMetric label="יתרה פתוחה" value={tuitionUnavailable ? "לא זמין" : money(outstanding)} hint={tuitionUnavailable ? "נדרש רענון" : `${allPeriods.filter((item) => item.outstanding > 0).length} ילדים/תקופות`} icon={WalletCards} tone={tuitionUnavailable ? "neutral" : outstanding ? "orange" : "green"} />
        <FinanceMetric label="דורש טיפול" value={tuitionUnavailable ? "לא זמין" : overdue.length + reconciliation.length} hint={tuitionUnavailable ? "הספירה אינה ידועה" : `${overdue.length} באיחור · ${reconciliation.length} להתאמה`} icon={Clock3} tone={tuitionUnavailable ? "neutral" : overdue.length + reconciliation.length ? "red" : "green"} />
      </FinanceMetrics>
      <FinanceTruthBanner title="שני מסלולים, שתי מטרות" text="שכר לימוד עובר מהורה לגן. מנוי הפלטפורמה משולם מהגן לגן בטוח. יתרות ומסמכים אינם מתערבבים." />

      <div className="finance-two-column">
        <FinanceSection title="ספר שכר לימוד" text="תמונה קנונית לפי ילד ותקופת חיוב" action={<Link className="button secondary tiny" href="/dashboard/garden/tuition-ledger">לניהול מלא</Link>}>
          <nav className="finance-filter-bar" aria-label="סינון שכר לימוד">
            {[["", "הכל"], ["pending", "לתשלום"], ["partially_paid", `חלקי ${partial.length}`], ["overdue", `באיחור ${overdue.length}`], ["reconciliation_required", `להתאמה ${reconciliation.length}`], ["paid", "שולם"]].map(([key, label]) => <Link className={(params.status ?? "") === key ? "active" : ""} href={key ? `/dashboard/garden/finance?status=${key}` : "/dashboard/garden/finance"} key={key}>{label}</Link>)}
          </nav>
          <div className="finance-ledger" style={{ marginTop: 14 }}>
            <div className="finance-ledger-head"><span>ילד/ה</span><span>תקופה</span><span>לחיוב</span><span>שולם</span><span>יתרה</span><span>סטטוס</span></div>
            {periods.slice(0, 8).map((period) => { const enrollment = enrollmentById.get(period.enrollment_id); const name = enrollment?.children?.full_name ?? "ילד/ה"; return <article className="finance-ledger-row" key={period.id}>
              <div className="finance-ledger-person"><span className="finance-ledger-avatar">{name.slice(0, 1)}</span><span><b>{name}</b><small>{period.due_at ? `לפירעון ${dateText(period.due_at)}` : "מועד לא הוגדר"}</small></span></div>
              <div className="finance-ledger-cell"><b>{periodText(period.period_start)}</b><small>{period.reconciliation_reason ? "נדרש עיון" : "תקופה חודשית"}</small></div>
              <div className="finance-ledger-cell"><b>{money(period.amount_due)}</b></div><div className="finance-ledger-cell"><b>{money(period.amount_settled)}</b></div><div className="finance-ledger-cell"><b>{money(period.outstanding)}</b>{period.unapplied_credit_total ? <small>זיכוי {money(period.unapplied_credit_total)}</small> : null}</div><FinanceStatus status={period.status} />
            </article>; })}
            {!tuitionUnavailable && !periods.length ? <FinanceEmpty title="אין תקופות חיוב במסנן הזה" text="תקופת חיוב מופיעה רק לאחר יצירה קנונית מתוך הרשמה פעילה ומחיר מוסכם." action={<Link className="button primary" href="/dashboard/garden/tuition-ledger">יצירת תקופה</Link>} /> : null}
          </div>
        </FinanceSection>

        <FinanceSection title="פעולות מהירות" text="גישה ישירה למרחבי הכספים"><FinanceQuickActions /></FinanceSection>
      </div>

      <div className="finance-two-column">
        <FinanceSection title="היסטוריית פעולות" text="רישומים קנוניים שנשמרו עם תאריך, שיטה וסיבה">
          <div className="finance-history">{entries.map((entry) => { const period = periodById.get(entry.period_id); const name = enrollmentById.get(period?.enrollment_id ?? "")?.children?.full_name ?? "ילד/ה"; return <article className="finance-history-row" key={entry.id}><span><ReceiptText size={21} /></span><div><b>{name} · {money(entry.amount)}</b><small>{entry.entry_kind === "manual_settlement" ? "תשלום ידני מאומת בידי הגן" : entry.entry_kind === "adjustment" ? `התאמה · ${entry.reason ?? "סיבה מתועדת"}` : "זיכוי שממתין להתאמה"}</small></div><time>{dateText(entry.created_at)}</time></article>; })}{!tuitionUnavailable && !entries.length ? <FinanceEmpty title="אין עדיין היסטוריית פעולות" text="תשלום ידני, התאמה או זיכוי יופיעו כאן לאחר שמירתם בספר הקנוני." /> : null}</div>
        </FinanceSection>
        <FinanceSection title="מנוי הפלטפורמה" text="גן → גן בטוח · מסלול נפרד משכר לימוד">
          <div className="finance-domain-card subscription"><header><span><CreditCard size={23} /></span><div><h3>{subscriptionUnavailable ? "נתוני המנוי אינם זמינים" : String((currentSubscription?.subscription_plans as { name?: string } | undefined)?.name ?? "מנוי טרם הוגדר")}</h3><p>{subscriptionUnavailable ? "מקור המנוי לא נטען; לא מוצג מצב חלופי" : currentSubscription ? "נתוני המנוי של הגן הפעיל" : "לא נמצאה רשומת מנוי פעילה"}</p></div></header><div className="finance-ledger-cell"><b>{subscriptionUnavailable ? "לא זמין" : currentSubscription?.unit_price_snapshot == null ? "מחיר לא אומת" : money(currentSubscription.unit_price_snapshot)}</b><small>סטטוס: {subscriptionUnavailable ? "לא זמין" : String(currentSubscription?.status ?? "לא הוגדר")}</small></div><Link className="button primary" href="/dashboard/garden/subscription"><Landmark size={17} /> למנוי גן בטוח</Link></div>
          <FinanceTruthBanner kind="warning" title="סליקה אלקטרונית אינה מאומתת" text="אין במסך זה חיוב אשראי, Apple Pay, Google Pay או אישור ספק מדומה. הסדר ידני נשאר זמין." />
        </FinanceSection>
      </div>
      <FinanceSection title="בקרת איכות פיננסית" text="מצבים שדורשים החלטה, בלי לשנות חיוב מקורי">
        <div className="finance-three-column"><div className="finance-domain-card"><b>תשלומים חלקיים</b><strong>{partial.length}</strong><p>היתרה נשארת פתוחה עד לסילוק מלא.</p></div><div className="finance-domain-card"><b>זיכויים והתאמות</b><strong>{allPeriods.filter((item) => item.adjustment_total !== 0 || item.unapplied_credit_total > 0).length}</strong><p>החיוב המקורי והסיבה נשמרים בביקורת.</p></div><div className="finance-domain-card"><b>יישוב חריגים</b><strong>{reconciliation.length}</strong><p>תשלום יתר אינו נבלע אוטומטית.</p></div></div>
      </FinanceSection>
      <FinanceTruthBanner kind="success" title="הנתונים ניתנים לרענון" text="השרת הוא מקור האמת לכל סכום וסטטוס." action={<Link className="button secondary tiny" href="/dashboard/garden/finance"><RefreshCcw size={16} /> רענון</Link>} />
    </FinanceFrame>
  </DashboardShell>;
}
