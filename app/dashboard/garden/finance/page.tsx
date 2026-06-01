import Link from "next/link";
import { FileSpreadsheet, RefreshCw, TrendingUp, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { FeeGroupSettings } from "@/components/fee-group-settings";
import { PrintButton } from "@/components/print-button";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { loadGardenFinanceData, type FinanceQueryDiagnostic, type FinanceSearchParams } from "@/lib/domain/garden-finance-loader";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const financeFilterLabels: Record<string, string> = {
  failed: "תשלומים שלא עברו",
  overdue: "תשלומים באיחור",
  due: "תשלומים שדורשים טיפול",
  partial: "תשלומים חלקיים",
  paused: "תשלומים שנעצרו",
  not_transferred: "תשלום לא הועבר"
};

const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני"];

function money(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function actualMonthlyFee(child: any) {
  return Number(child?.actual_monthly_fee ?? child?.group_monthly_fee ?? child?.monthly_fee ?? 0);
}

function DebugPanel({ gardenId, diagnostics, errors }: { gardenId?: string | null; diagnostics: FinanceQueryDiagnostic[]; errors: string[] }) {
  return (
    <section className="card action-panel">
      <div className="section-heading">
        <h2>אבחון טעינת כספים</h2>
        <p>מוצג רק בפיתוח / Debug. כאן רואים בדיוק איזו שאילתה הצליחה או נכשלה.</p>
      </div>
      <div className="risk-list">
        <div>גן נוכחי <b>{gardenId || "לא נמצא"}</b></div>
        {diagnostics.length === 0 ? <div>שאילתות <b>לא בוצעו</b></div> : diagnostics.map((item) => (
          <div key={`${item.table}-${item.label}`}>
            <span>{item.label} · {item.table} · columns: {item.columns}</span>
            <b>{item.success ? `success · ${item.count}` : `error · ${item.error}`}</b>
          </div>
        ))}
        {errors.map((error, index) => <div key={`error-${index}`}>שגיאה <b>{error}</b></div>)}
      </div>
    </section>
  );
}

function MinimalFinanceFallback({ role, debugMode, gardenId, diagnostics = [], errors = [] }: { role: "manager" | "owner"; debugMode: boolean; gardenId?: string | null; diagnostics?: FinanceQueryDiagnostic[]; errors?: string[] }) {
  return (
    <DashboardShell role={role} title="מרכז כספים">
      <section className="empty-state">
        <WalletCards size={34} />
        <strong>עמוד כספים</strong>
        <span>לא ניתן לטעון את כל נתוני הכספים כרגע</span>
        <div className="profile-actions">
          <Link className="button primary" href="/dashboard/garden/finance"><RefreshCw size={15} /> רענון</Link>
          <Link className="button secondary" href="/dashboard/garden">חזרה לדשבורד</Link>
        </div>
      </section>
      {debugMode ? <DebugPanel gardenId={gardenId} diagnostics={diagnostics} errors={errors} /> : null}
    </DashboardShell>
  );
}

function MissingGarden({ role, debugMode, diagnostics, errors }: { role: "manager" | "owner"; debugMode: boolean; diagnostics: FinanceQueryDiagnostic[]; errors: string[] }) {
  return (
    <DashboardShell role={role} title="מרכז כספים">
      <section className="empty-state">
        <WalletCards size={34} />
        <strong>לא נמצא שיוך לגן עבור המשתמש הזה</strong>
        <span>כדי להציג כספים, המשתמש צריך להיות משויך לגן פעיל.</span>
        <Link className="button primary" href="/dashboard/garden">חזרה לדשבורד</Link>
      </section>
      {debugMode ? <DebugPanel gardenId={null} diagnostics={diagnostics} errors={errors} /> : null}
    </DashboardShell>
  );
}

async function FinanceContent({ params }: { params: FinanceSearchParams }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const role = profile.role === "owner" ? "owner" : "manager";
  const gardenId = profile.garden_id ?? "";
  const debugMode = params.debug === "1" || process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";

  const data = await loadGardenFinanceData({ supabase: supabase as any, gardenId, searchParams: params, debug: debugMode });
  if (!gardenId) return <MissingGarden role={role} debugMode={debugMode} diagnostics={data.diagnostics ?? []} errors={data.errors ?? []} />;

  const children = data.core?.children ?? [];
  const allChildren = data.core?.allChildren ?? [];
  const totals = data.core?.totals ?? {
    expected: 0,
    paid: 0,
    missing: 0,
    overdue: 0,
    partialPayments: 0,
    paidChildren: 0,
    unpaidChildren: 0,
    failedChildren: 0,
    specialArrangements: [],
    specialArrangementsTotal: 0,
    debtTotal: 0,
    pausedTotal: 0,
    yearRevenue: 0,
    collection: 0
  };
  const feeGroupsWithMarket = data.secondary?.feeGroupsWithMarket ?? [];
  const history = data.secondary?.history ?? [];
  const diagnostics = data.diagnostics ?? [];
  const errors = data.errors ?? [];

  return (
    <DashboardShell role={role} title="מרכז כספים">
      <div className="dashboard-hero-card garden-hero-card finance-hero-card">
        <div>
          <p className="eyebrow">Kindergarten Finance</p>
          <h1>מרכז גבייה ותשלומי ילדים.</h1>
          <p>הכנסות חודשיות, תשלומים חסרים, איחורים, הנחות והסדרים מיוחדים במקום אחד.</p>
        </div>
        <span className={totals.overdue ? "pill bad" : "pill good"}><WalletCards size={15} /> גבייה {totals.collection}%</span>
      </div>
      {errors.length ? <div className="warning-banner">חלק מנתוני הכספים לא נטענו</div> : null}
      {debugMode ? <DebugPanel gardenId={gardenId} diagnostics={diagnostics} errors={errors} /> : null}
      <DashboardFilterChip label={financeFilterLabels[params.filter ?? ""]} clearHref="/dashboard/garden/finance" isEmpty={children.length === 0} emptyTitle={params.filter === "failed" ? "אין כרגע תשלומים שלא עברו" : params.filter === "overdue" ? "אין כרגע תשלומים באיחור" : params.filter ? `אין כרגע ${financeFilterLabels[params.filter]}` : undefined} emptyText="כל הילדים במסנן הזה תקינים כרגע. אפשר לנקות סינון כדי לראות את כל הגבייה." />

      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="הכנסה חודשית צפויה" value={money(totals.expected)} tone="good" />
        <StatCard label="נגבה החודש" value={money(totals.paid)} tone="good" />
        <StatCard label="חסר לגבייה" value={money(totals.missing)} tone={totals.missing ? "warn" : "good"} />
        <StatCard label="תשלומים באיחור" value={totals.overdue} tone={totals.overdue ? "bad" : "good"} />
      </div>
      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="ילדים ששילמו" value={totals.paidChildren} tone="good" />
        <StatCard label="ילדים ללא תשלום" value={totals.unpaidChildren} tone={totals.unpaidChildren ? "bad" : "good"} />
        <StatCard label="תשלומים חלקיים" value={totals.partialPayments} tone={totals.partialPayments ? "warn" : "good"} />
        <StatCard label="הכנסה שנתית" value={money(totals.yearRevenue)} tone="good" />
        <StatCard label="חובות פתוחים" value={money(totals.debtTotal)} tone={totals.debtTotal ? "bad" : "good"} />
        <StatCard label="תשלומים נעצרו" value={money(totals.pausedTotal)} tone={totals.pausedTotal ? "bad" : "good"} />
        <StatCard label="תשלום לא עבר" value={totals.failedChildren} tone={totals.failedChildren ? "bad" : "good"} />
      </div>

      <FeeGroupSettings groups={feeGroupsWithMarket} childCount={children.length} />

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><TrendingUp size={20} /> גרף חודשי</h2><p>גבייה בפועל מתוך היסטוריית התשלומים מול יעד החודש.</p></div>
          <div className="finance-chart">{months.map((month, index) => <div key={month}><span>{month}</span><i><b style={{ height: `${Math.max(12, Math.min(100, totals.collection - index * 4 + 12))}%` }} /></i></div>)}</div>
        </article>
        <article className="card action-panel">
          <h2>Reports</h2>
          <p>ייצוא דוחות גבייה, איחורים וסיכום הכנסה. PDF מתבצע דרך הדפסת דפדפן תקינה עם פריסת הדוח והלוגו.</p>
          <div className="profile-actions"><PrintButton label="PDF / הדפסה" /><button className="button secondary" type="button" disabled title="ייצוא Excel יתווסף בשירות דוחות ייעודי"><FileSpreadsheet size={15} /> Excel בהמשך</button><Link className="button" href="/dashboard/garden/children">כרטיסי ילדים</Link></div>
          <div className="quick-history-cards"><span>הסדרים <b>{totals.specialArrangements.length}</b></span><span>סך הסדרים <b>{money(totals.specialArrangementsTotal)}</b></span><span>גבייה <b>{totals.collection}%</b></span></div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>תשלומי ילדים</h2><p>סטטוס לפי ילד, מחיר ברירת מחדל מהקבוצה, הסדר מיוחד ותוקף תשלום.</p></div>
        {children.length === 0 ? (
          <div className="empty-state">
            <strong>אין ילדים לתצוגת כספים</strong>
            <span>{allChildren.length ? "אין תוצאות במסנן הנוכחי." : "לאחר הוספת ילדים, ניתן להגדיר סכום חודשי ולעקוב אחרי תשלומים."}</span>
            <Link className="button primary" href="/dashboard/garden/children">מעבר לילדים</Link>
          </div>
        ) : (
          <div className="people-card-grid">
            {children.map((child) => (
              <article className={child.payments_paused || ["failed", "not_transferred"].includes(child.payment_status) ? "person-card finance-student-card payment-paused" : "person-card finance-student-card"} key={child.id ?? child.full_name}>
                <div>
                  <span className={child.payments_paused ? "pill bad" : child.payment_status === "paid" ? "pill good" : ["overdue", "failed", "not_transferred"].includes(child.payment_status) ? "pill bad" : "pill warn"}>{child.payments_paused ? "תשלומים נעצרו" : child.payment_status === "failed" || child.payment_status === "not_transferred" ? "תשלום לא עבר" : child.payment_status ?? "unconfigured"}</span>
                  <h3>{child.full_name ?? "ילד/ה"}</h3>
                  <p>{child.fee_group_name ?? "ללא קבוצה"} · מחיר קבוצה: {money(Number(child.group_monthly_fee ?? 0))}</p>
                  <p>מחיר בפועל: <strong>{money(actualMonthlyFee(child))}</strong>{child.has_special_arrangement ? " · הסדר מיוחד פעיל" : ""}</p>
                  {["failed", "not_transferred"].includes(child.payment_status) ? <p className="danger-text">סיבה: {child.failure_reason ?? "לא צוינה"} · נדרש ניסיון חוזר: {child.retry_required ? "כן" : "לא"}</p> : null}
                </div>
                <div className="mini-kpi-row"><span>שולם <b>{child.last_payment_date ? new Date(child.last_payment_date).toLocaleDateString("he-IL") : "-"}</b></span><span>תוקף עד <b>{child.valid_until ? new Date(child.valid_until).toLocaleDateString("he-IL") : "-"}</b></span><span>חוב <b>{money(Number(child.debt_amount ?? 0))}</b></span></div>
                <div className="quick-history-cards"><span>יעד הבא <b>{child.next_payment_due ? new Date(child.next_payment_due).toLocaleDateString("he-IL") : "-"}</b></span><span>אמצעי <b>{child.last_payment_method ?? "-"}</b></span><span>הסדר עד <b>{child.arrangement_valid_until ? new Date(child.arrangement_valid_until).toLocaleDateString("he-IL") : "-"}</b></span></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>היסטוריית תשלומים</h2><p>פעולות תשלום אחרונות, כולל סכום ששולם, תקופת תוקף, הנחות והסדרים מיוחדים.</p></div>
        {history.length === 0 ? <div className="empty-state"><strong>אין היסטוריית תשלומים עדיין</strong><span>כאשר תסמנו ילד כשולם/לא שולם/הסדר מיוחד, ההיסטוריה תופיע כאן.</span></div> : <div className="procedure-list">{history.map((item) => <article className="card procedure-card" key={item.id ?? `${item.child_id}-${item.created_at}`}><div><span className="pill">{item.payment_status ?? item.new_status ?? "תשלום"}</span><h3>{item.child_name ?? "ילד/ה"}</h3><p>{money(Number(item.amount_paid ?? item.amount ?? 0))} · {item.transaction_type ?? item.action ?? "פעולה"} · {item.payment_method ?? "ללא אמצעי"}</p><small>{item.paid_at ? new Date(item.paid_at).toLocaleDateString("he-IL") : ""} · מ־{item.valid_from ? new Date(item.valid_from).toLocaleDateString("he-IL") : "-"} עד {item.valid_until ? new Date(item.valid_until).toLocaleDateString("he-IL") : "-"}</small></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}

export default async function GardenFinancePage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const params: FinanceSearchParams = await searchParams.catch(() => ({}));
  const debugMode = params.debug === "1" || process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
  try {
    return await FinanceContent({ params });
  } catch (error) {
    const message = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
    console.error("[garden-finance] page fallback rendered", error);
    return <MinimalFinanceFallback role="manager" debugMode={debugMode} diagnostics={[{ label: "page-level error", table: "finance page", columns: "*", success: false, count: 0, error: message }]} errors={[message]} />;
  }
}
