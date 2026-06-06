import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import {
  loadGardenFinanceData,
  type FinanceQueryDiagnostic,
  type FinanceSearchParams
} from "@/lib/domain/garden-finance-loader";
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

const financeFilters = [
  { key: "failed", label: "תשלום לא עבר" },
  { key: "overdue", label: "באיחור" },
  { key: "due", label: "דורש טיפול" },
  { key: "partial", label: "חלקי" },
  { key: "paused", label: "נעצר" },
  { key: "not_transferred", label: "לא הועבר" }
];

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0
  }).format(Number(value ?? 0));
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("he-IL");
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function hasCriticalFinanceFailure(diagnostics?: FinanceQueryDiagnostic[]) {
  return asArray(diagnostics).some((item) => !item.success && ["children query", "profile garden", "unexpected loader error"].includes(item.label));
}

function SafeFinanceShell({
  role = "manager",
}: {
  role?: "manager" | "owner";
}) {
  return (
    <DashboardShell role={role} title="מרכז כספים">
      <section className="empty-state">
        <strong>עמוד כספים נטען במצב בטוח</strong>
        <span>לא ניתן לטעון את כל נתוני הכספים כרגע, אבל העמוד לא יפנה למסך שגיאה כללי.</span>
        <div className="profile-actions">
          <Link className="button primary" href="/dashboard/garden/finance">רענון</Link>
          <Link className="button secondary" href="/dashboard/garden">חזרה לדשבורד</Link>
        </div>
      </section>
    </DashboardShell>
  );
}

function MissingGarden({ role }: { role: "manager" | "owner" }) {
  return (
    <DashboardShell role={role} title="מרכז כספים">
      <section className="empty-state">
        <strong>לא נמצא שיוך לגן עבור המשתמש הזה</strong>
        <span>כדי להציג כספים, המשתמש צריך להיות משויך לגן פעיל.</span>
        <div className="profile-actions">
          <Link className="button primary" href="/dashboard/garden">חזרה לדשבורד</Link>
        </div>
      </section>
    </DashboardShell>
  );
}

function SafeStat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "good" | "warn" | "bad" }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default async function GardenFinancePage({ searchParams }: { searchParams: Promise<FinanceSearchParams> }) {
  const params: FinanceSearchParams = await searchParams.catch(() => ({}));

  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const role = profile.role === "owner" ? "owner" : "manager";
    const gardenId = profile.garden_id ?? "";
    const supabase = await createClient();
    const data = await loadGardenFinanceData({
      supabase: supabase as any,
      gardenId,
      searchParams: params,
      debug: false
    });

    if (!gardenId) {
      return <MissingGarden role={role} />;
    }

    const children = asArray(data.core?.children);
    const allChildren = asArray(data.core?.allChildren);
    const history = asArray(data.secondary?.history);
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
    const activeFilter = params.filter ?? "";
    const criticalFinanceFailure = hasCriticalFinanceFailure(data.diagnostics);

    return (
      <DashboardShell role={role} title="מרכז כספים">
        <PremiumDashboardHero eyebrow="כספים" title="גבייה חודשית פשוטה." subtitle="מי שילם, מה חסר ומה דורש שיחה קצרה." badge={`גבייה ${Number(totals.collection ?? 0)}%`} badgeTone={Number(totals.overdue ?? 0) ? "warn" : "good"} />

        {criticalFinanceFailure ? <div className="warning-banner">חלק מנתוני הכספים לא נטענו</div> : null}

        <section className="card action-panel">
          <div className="section-heading">
            <h2>סינון מהיר</h2>
            <p>{activeFilter ? `מציג: ${financeFilterLabels[activeFilter] ?? activeFilter}` : "כל הילדים והתשלומים."}</p>
          </div>
          <div className="profile-actions">
            <Link className={activeFilter ? "button secondary" : "button primary"} href="/dashboard/garden/finance">הכל</Link>
            {financeFilters.map((filter) => (
              <Link className={activeFilter === filter.key ? "button primary" : "button secondary"} href={`/dashboard/garden/finance?filter=${filter.key}`} key={filter.key}>
                {filter.label}
              </Link>
            ))}
          </div>
        </section>

        <div className="grid cols-4 dashboard-kpis">
          <SafeStat label="הכנסה חודשית צפויה" value={money(totals.expected)} tone="good" />
          <SafeStat label="נגבה החודש" value={money(totals.paid)} tone="good" />
          <SafeStat label="חסר לגבייה" value={money(totals.missing)} tone={Number(totals.missing ?? 0) ? "warn" : "good"} />
          <SafeStat label="תשלומים באיחור" value={Number(totals.overdue ?? 0)} tone={Number(totals.overdue ?? 0) ? "bad" : "good"} />
          <SafeStat label="ילדים ששילמו" value={Number(totals.paidChildren ?? 0)} tone="good" />
          <SafeStat label="ילדים ללא תשלום" value={Number(totals.unpaidChildren ?? 0)} tone={Number(totals.unpaidChildren ?? 0) ? "bad" : "good"} />
          <SafeStat label="תשלומים חלקיים" value={Number(totals.partialPayments ?? 0)} tone={Number(totals.partialPayments ?? 0) ? "warn" : "good"} />
          <SafeStat label="תשלום לא עבר" value={Number(totals.failedChildren ?? 0)} tone={Number(totals.failedChildren ?? 0) ? "bad" : "good"} />
        </div>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>תשלומי ילדים</h2>
            <p>כרטיס קצר לכל ילד ותשלום.</p>
          </div>
          {children.length === 0 ? (
            <div className="empty-state">
              <strong>{activeFilter ? `אין כרגע ${financeFilterLabels[activeFilter] ?? "תוצאות במסנן הזה"}` : "אין ילדים לתצוגת כספים"}</strong>
              <span>{allChildren.length ? "אפשר לנקות סינון כדי לראות את כל הילדים." : "לאחר הוספת ילדים, נתוני התשלום יופיעו כאן."}</span>
              <div className="profile-actions">
                {activeFilter ? <Link className="button primary" href="/dashboard/garden/finance">ניקוי סינון</Link> : null}
                <Link className="button secondary" href="/dashboard/garden/children">מעבר לילדים</Link>
              </div>
            </div>
          ) : (
            <div className="people-card-grid">
              {children.map((child: any, index) => {
                const status = child?.payments_paused ? "תשלומים נעצרו" : child?.payment_status === "failed" || child?.payment_status === "not_transferred" ? "תשלום לא עבר" : child?.payment_status ?? "לא הוגדר";
                const statusClass = child?.payments_paused || ["failed", "not_transferred", "overdue"].includes(child?.payment_status) ? "pill bad" : child?.payment_status === "paid" ? "pill good" : "pill warn";
                return (
                  <article className="person-card finance-student-card" key={child?.id ?? `${child?.full_name ?? "child"}-${index}`}>
                    <div>
                      <span className={statusClass}>{status}</span>
                      <h3>{child?.full_name ?? "ילד/ה"}</h3>
                      <p>{child?.fee_group_name ?? child?.classroom ?? child?.age_group ?? "ללא קבוצת גיל"} · מחיר חודשי: {money(child?.actual_monthly_fee ?? child?.group_monthly_fee ?? child?.monthly_fee)}</p>
                    </div>
                    <div className="mini-kpi-row">
                      <span>שולם <b>{formatDate(child?.last_payment_date)}</b></span>
                      <span>תוקף עד <b>{formatDate(child?.valid_until)}</b></span>
                      <span>חוב <b>{money(child?.debt_amount)}</b></span>
                    </div>
                    {["failed", "not_transferred"].includes(child?.payment_status) ? (
                      <p className="danger-text">תשלום דורש טיפול: {child?.failure_reason ?? "לא צוינה סיבה"}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>היסטוריית תשלומים</h2>
            <p>נתון משני. אם הטבלה חסרה או חסומה, העמוד ממשיך להיטען.</p>
          </div>
          {history.length === 0 ? (
            <div className="empty-state">
              <strong>אין היסטוריית תשלומים זמינה כרגע</strong>
              <span>ניתן עדיין לראות את מצב הגבייה לפי הילדים למעלה.</span>
            </div>
          ) : (
            <div className="procedure-list">
              {history.map((item: any, index) => (
                <article className="card procedure-card" key={item?.id ?? `${item?.child_id ?? "payment"}-${index}`}>
                  <div>
                    <span className="pill">{item?.payment_status ?? item?.new_status ?? "תשלום"}</span>
                    <h3>{item?.child_name ?? "ילד/ה"}</h3>
                    <p>{money(item?.amount_paid ?? item?.amount)} · {item?.transaction_type ?? item?.action ?? "פעולה"}</p>
                    <small>{formatDate(item?.paid_at ?? item?.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </DashboardShell>
    );
  } catch (error) {
    console.error("[garden-finance] safe page fallback rendered", error);
    return (
      <SafeFinanceShell />
    );
  }
}
