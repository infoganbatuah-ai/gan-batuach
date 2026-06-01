import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
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

function errorMessage(error: unknown) {
  return error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
}

function isDebugEnabled(params: FinanceSearchParams) {
  return params.debug === "1" || process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";
}

function DebugPanel({
  gardenId,
  diagnostics,
  errors,
  thrownError
}: {
  gardenId?: string | null;
  diagnostics?: FinanceQueryDiagnostic[];
  errors?: string[];
  thrownError?: string | null;
}) {
  const items = asArray(diagnostics);
  const allErrors = asArray(errors);

  return (
    <section className="card action-panel">
      <div className="section-heading">
        <h2>אבחון טעינת כספים</h2>
        <p>מוצג רק בפיתוח / Debug. העמוד הרגיל ממשיך להיטען גם אם אחת השאילתות נכשלה.</p>
      </div>
      <div className="risk-list">
        <div>
          <span>גן נוכחי</span>
          <b>{gardenId || "לא נמצא"}</b>
        </div>
        {items.length === 0 ? (
          <div>
            <span>שאילתות</span>
            <b>לא בוצעו או לא דווחו</b>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={`${item.table}-${item.label}-${index}`}>
              <span>{item.label} · {item.table} · columns: {item.columns}</span>
              <b>{item.success ? `success · ${item.count}` : `error · ${item.error ?? "unknown"}`}</b>
            </div>
          ))
        )}
        {allErrors.map((item, index) => (
          <div key={`finance-error-${index}`}>
            <span>שגיאה</span>
            <b>{item}</b>
          </div>
        ))}
        {thrownError ? (
          <div>
            <span>שגיאת רינדור / טעינה כללית</span>
            <b>{thrownError}</b>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SafeFinanceShell({
  role = "manager",
  gardenId,
  debugMode,
  diagnostics,
  errors,
  thrownError
}: {
  role?: "manager" | "owner";
  gardenId?: string | null;
  debugMode: boolean;
  diagnostics?: FinanceQueryDiagnostic[];
  errors?: string[];
  thrownError?: string | null;
}) {
  return (
    <DashboardShell role={role} title="מרכז כספים">
      <section className="empty-state">
        <strong>עמוד כספים נטען במצב בטוח</strong>
        <span>לא ניתן לטעון את כל נתוני הכספים כרגע, אבל העמוד לא יפנה למסך שגיאה כללי.</span>
        <div className="profile-actions">
          <Link className="button primary" href="/dashboard/garden/finance">רענון</Link>
          <Link className="button secondary" href="/dashboard/garden">חזרה לדשבורד</Link>
          <Link className="button secondary" href="/dashboard/garden/finance-debug?debug=1">אבחון כספים</Link>
        </div>
      </section>
      {debugMode ? (
        <DebugPanel gardenId={gardenId} diagnostics={diagnostics} errors={errors} thrownError={thrownError} />
      ) : null}
    </DashboardShell>
  );
}

function MissingGarden({ role, debugMode, diagnostics, errors }: { role: "manager" | "owner"; debugMode: boolean; diagnostics?: FinanceQueryDiagnostic[]; errors?: string[] }) {
  return (
    <DashboardShell role={role} title="מרכז כספים">
      <section className="empty-state">
        <strong>לא נמצא שיוך לגן עבור המשתמש הזה</strong>
        <span>כדי להציג כספים, המשתמש צריך להיות משויך לגן פעיל.</span>
        <div className="profile-actions">
          <Link className="button primary" href="/dashboard/garden">חזרה לדשבורד</Link>
          <Link className="button secondary" href="/dashboard/garden/finance-debug?debug=1">אבחון כספים</Link>
        </div>
      </section>
      {debugMode ? <DebugPanel gardenId={null} diagnostics={diagnostics} errors={errors} /> : null}
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
  const debugMode = isDebugEnabled(params);
  console.error("[finance-page] route started", { debugMode, filter: params.filter ?? null });

  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const role = profile.role === "owner" ? "owner" : "manager";
    const gardenId = profile.garden_id ?? "";
    const supabase = await createClient();
    const data = await loadGardenFinanceData({
      supabase: supabase as any,
      gardenId,
      searchParams: params,
      debug: debugMode
    });
    console.error("[finance-page] loader completed", {
      role,
      gardenId: gardenId || null,
      ok: data.ok,
      children: data.core?.children?.length ?? 0,
      diagnostics: data.diagnostics?.length ?? 0,
      errors: data.errors?.length ?? 0
    });

    if (!gardenId) {
      return <MissingGarden role={role} debugMode={debugMode} diagnostics={data.diagnostics} errors={data.errors} />;
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

    return (
      <DashboardShell role={role} title="מרכז כספים">
        <section className="dashboard-hero-card garden-hero-card finance-hero-card">
          <div>
            <p className="eyebrow">Kindergarten Finance</p>
            <h1>עמוד כספים נטען במצב בטוח</h1>
            <p>גבייה חודשית, תשלומים חסרים, איחורים ותשלום שלא עבר, בלי תלות ברכיבי תצוגה מורכבים.</p>
          </div>
          <span className={Number(totals.overdue ?? 0) ? "pill bad" : "pill good"}>גבייה {Number(totals.collection ?? 0)}%</span>
        </section>

        {asArray(data.errors).length ? <div className="warning-banner">חלק מנתוני הכספים לא נטענו</div> : null}
        {debugMode ? <DebugPanel gardenId={gardenId} diagnostics={data.diagnostics} errors={data.errors} /> : null}

        <section className="card action-panel">
          <div className="section-heading">
            <h2>סינון מהיר</h2>
            <p>{activeFilter ? `מציג: ${financeFilterLabels[activeFilter] ?? activeFilter}` : "מציג את כל הילדים והתשלומים."}</p>
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
            <p>כרטיסים מינימליים ובטוחים. אם מסנן פעיל ואין תוצאות, המשמעות היא שאין כרגע פריטים מסוג זה.</p>
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
    const message = errorMessage(error);
    console.error("[garden-finance] safe page fallback rendered", error);
    return (
      <SafeFinanceShell
        debugMode={debugMode}
        diagnostics={[{ label: "page-level try/catch", table: "finance page", columns: "*", success: false, count: 0, error: message }]}
        errors={[message]}
        thrownError={message}
      />
    );
  }
}
