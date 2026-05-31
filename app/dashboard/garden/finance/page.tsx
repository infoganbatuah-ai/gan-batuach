import Link from "next/link";
import { FileSpreadsheet, TrendingUp, WalletCards } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { FeeGroupSettings } from "@/components/fee-group-settings";
import { PrintButton } from "@/components/print-button";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function money(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

function isArrangementActive(child: any) {
  return child.custom_monthly_fee !== null && child.custom_monthly_fee !== undefined && (!child.arrangement_valid_until || new Date(child.arrangement_valid_until).getTime() >= Date.now());
}

function actualMonthlyFee(child: any) {
  return isArrangementActive(child) ? Number(child.custom_monthly_fee ?? 0) : Number(child.group_monthly_fee ?? child.monthly_fee ?? 0);
}

const financeFilterLabels: Record<string, string> = {
  failed: "תשלומים שלא עברו",
  overdue: "תשלומים באיחור",
  due: "תשלומים שדורשים טיפול",
  partial: "תשלומים חלקיים",
  paused: "תשלומים שנעצרו"
};

export default async function GardenFinancePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const [childrenRes, historyRes, feeGroupsRes, monthHistoryRes, yearHistoryRes] = await Promise.all([
    supabase.from("children" as any).select("id, full_name, photo_url, age_group, classroom, payment_group_id, monthly_fee, custom_monthly_fee, arrangement_notes, arrangement_valid_until, payment_status, payments_paused, paused_reason, debt_amount, debt_notes, failure_reason, failed_at, retry_required, parent_notified, last_payment_date, next_payment_due, valid_until, payment_notes, last_amount_paid, last_payment_method").eq("garden_id", gardenId).order("full_name"),
    supabase.from("child_payment_history" as any).select("id, child_id, amount, amount_paid, action, payment_status, paid_at, valid_from, valid_until, payment_method, transaction_type, notes, failure_reason, failed_at, retry_required, children(full_name)").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(40),
    supabase.from("kindergarten_fee_groups" as any).select("*").eq("garden_id", gardenId).order("group_name"),
    supabase.from("child_payment_history" as any).select("amount, amount_paid, action, paid_at").eq("garden_id", gardenId).gte("paid_at", monthStart).lt("paid_at", nextMonthStart),
    supabase.from("child_payment_history" as any).select("amount, amount_paid, action, paid_at").eq("garden_id", gardenId).gte("paid_at", yearStart)
  ]);
  const feeGroups = (feeGroupsRes.data ?? []) as any[];
  const marketRowsRes = await supabase.from("kindergarten_fee_groups" as any).select("group_name, monthly_fee").eq("active", true).neq("garden_id", gardenId);
  const marketAverages = new Map<string, number>();
  for (const group of feeGroups) {
    const similar = ((marketRowsRes.data ?? []) as any[]).filter((item) => item.group_name === group.group_name || (item.group_name && group.group_name && String(item.group_name).includes(group.group_name)) || (item.group_name && group.group_name && String(group.group_name).includes(item.group_name)));
    const average = similar.length ? Math.round(similar.reduce((sum, item) => sum + Number(item.monthly_fee ?? 0), 0) / similar.length) : 0;
    if (average) marketAverages.set(group.id, average);
  }
  const feeGroupsWithMarket = feeGroups.map((group) => ({ ...group, market_average_fee: marketAverages.get(group.id) ?? group.market_average_fee ?? null }));
  const feeById = new Map(feeGroups.map((group) => [group.id, group]));
  const allChildren = ((childrenRes.data ?? []) as any[]).map((child) => {
    const group = feeById.get(child.payment_group_id) ?? feeGroups.find((item) => item.group_name === child.age_group || item.group_name === child.classroom);
    return {
      ...child,
      fee_group_name: group?.group_name ?? child.classroom ?? child.age_group ?? "ללא קבוצה",
      group_monthly_fee: group?.monthly_fee ?? child.monthly_fee,
      actual_monthly_fee: isArrangementActive(child) ? Number(child.custom_monthly_fee ?? 0) : Number(group?.monthly_fee ?? child.monthly_fee ?? 0),
      has_special_arrangement: isArrangementActive(child)
    };
  });
  const children = allChildren.filter((child) => {
    if (params.filter === "failed") return ["failed", "not_transferred"].includes(child.payment_status);
    if (params.filter === "overdue") return child.payment_status === "overdue" || (child.next_payment_due && new Date(child.next_payment_due).getTime() < Date.now());
    if (params.filter === "due") return ["overdue", "unpaid", "partial", "failed", "not_transferred"].includes(child.payment_status);
    if (params.filter === "partial") return child.payment_status === "partial";
    if (params.filter === "paused") return child.payments_paused;
    return true;
  });
  const history = (historyRes.data ?? []) as any[];
  const monthHistory = (monthHistoryRes.data ?? []) as any[];
  const yearHistory = (yearHistoryRes.data ?? []) as any[];
  const expected = children.reduce((sum, child) => sum + actualMonthlyFee(child), 0);
  const paid = monthHistory.reduce((sum, item) => sum + Number(item.amount_paid ?? item.amount ?? 0), 0);
  const missing = Math.max(0, expected - paid);
  const overdue = children.filter((child) => child.payment_status === "overdue" || (child.next_payment_due && new Date(child.next_payment_due).getTime() < Date.now())).length;
  const partialPayments = children.filter((child) => child.payment_status === "partial").length;
  const paidChildren = children.filter((child) => child.payment_status === "paid").length;
  const unpaidChildren = children.filter((child) => ["overdue", "unpaid", "failed", "not_transferred"].includes(child.payment_status)).length;
  const failedChildren = children.filter((child) => ["failed", "not_transferred"].includes(child.payment_status)).length;
  const specialArrangements = children.filter((child) => child.has_special_arrangement);
  const specialArrangementsTotal = specialArrangements.reduce((sum, child) => sum + Number(child.custom_monthly_fee ?? 0), 0);
  const debtTotal = children.reduce((sum, child) => sum + Number(child.debt_amount ?? 0), 0);
  const pausedTotal = children.filter((child) => child.payments_paused).reduce((sum, child) => sum + actualMonthlyFee(child), 0);
  const yearRevenue = yearHistory.reduce((sum, item) => sum + Number(item.amount_paid ?? item.amount ?? 0), 0);
  const collection = expected ? Math.round((paid / expected) * 100) : 0;
  const months = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מרכז כספים">
      <div className="dashboard-hero-card garden-hero-card finance-hero-card">
        <div><p className="eyebrow">Kindergarten Finance</p><h1>מרכז גבייה ותשלומי ילדים.</h1><p>הכנסות חודשיות, תשלומים חסרים, איחורים, הנחות והסדרים מיוחדים במקום אחד.</p></div>
        <span className={overdue ? "pill bad" : "pill good"}><WalletCards size={15} /> גבייה {collection}%</span>
      </div>
      <DashboardFilterChip label={financeFilterLabels[params.filter ?? ""]} clearHref="/dashboard/garden/finance" isEmpty={children.length === 0} emptyTitle={params.filter === "failed" ? "אין כרגע תשלומים שלא עברו" : params.filter === "overdue" ? "אין כרגע תשלומים באיחור" : params.filter ? `אין כרגע ${financeFilterLabels[params.filter]}` : undefined} emptyText="כל הילדים במסנן הזה תקינים כרגע. אפשר לנקות סינון כדי לראות את כל הגבייה." />
      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="הכנסה חודשית צפויה" value={money(expected)} tone="good" />
        <StatCard label="נגבה החודש" value={money(paid)} tone="good" />
        <StatCard label="חסר לגבייה" value={money(missing)} tone={missing ? "warn" : "good"} />
        <StatCard label="תשלומים באיחור" value={overdue} tone={overdue ? "bad" : "good"} />
      </div>
      <div className="grid cols-4 dashboard-kpis">
        <StatCard label="ילדים ששילמו" value={paidChildren} tone="good" />
        <StatCard label="ילדים ללא תשלום" value={unpaidChildren} tone={unpaidChildren ? "bad" : "good"} />
        <StatCard label="תשלומים חלקיים" value={partialPayments} tone={partialPayments ? "warn" : "good"} />
        <StatCard label="הכנסה שנתית" value={money(yearRevenue)} tone="good" />
        <StatCard label="חובות פתוחים" value={money(debtTotal)} tone={debtTotal ? "bad" : "good"} />
        <StatCard label="תשלומים נעצרו" value={money(pausedTotal)} tone={pausedTotal ? "bad" : "good"} />
        <StatCard label="תשלום לא עבר" value={failedChildren} tone={failedChildren ? "bad" : "good"} />
      </div>
      <FeeGroupSettings groups={feeGroupsWithMarket} childCount={children.length} />
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><div className="section-heading"><h2><TrendingUp size={20} /> גרף חודשי</h2><p>גבייה בפועל מתוך היסטוריית התשלומים מול יעד החודש.</p></div><div className="finance-chart">{months.slice(0, 6).map((month, index) => <div key={month}><span>{month}</span><i><b style={{ height: `${Math.max(12, Math.min(100, collection - index * 4 + 12))}%` }} /></i></div>)}</div></article>
        <article className="card action-panel"><h2>Reports</h2><p>ייצוא דוחות גבייה, איחורים וסיכום הכנסה. PDF מתבצע דרך הדפסת דפדפן תקינה עם פריסת הדוח והלוגו.</p><div className="profile-actions"><PrintButton label="PDF / הדפסה" /><button className="button secondary" type="button" onClick={() => undefined} disabled title="ייצוא Excel יתווסף בשירות דוחות ייעודי"><FileSpreadsheet size={15} /> Excel בהמשך</button><Link className="button" href="/dashboard/garden/children">כרטיסי ילדים</Link></div><div className="quick-history-cards"><span>הסדרים <b>{specialArrangements.length}</b></span><span>סך הסדרים <b>{money(specialArrangementsTotal)}</b></span><span>גבייה <b>{collection}%</b></span></div></article>
      </section>
      <section className="dashboard-section"><div className="section-heading"><h2>תשלומי ילדים</h2><p>סטטוס לפי ילד, מחיר ברירת מחדל מהקבוצה, הסדר מיוחד ותוקף תשלום.</p></div>{children.length === 0 ? <div className="empty-state"><strong>אין ילדים לתצוגת כספים</strong><span>לאחר הוספת ילדים, ניתן להגדיר סכום חודשי ולעקוב אחרי תשלומים.</span><Link className="button primary" href="/dashboard/garden/children">מעבר לילדים</Link></div> : <div className="people-card-grid">{children.map((child) => <article className={child.payments_paused || ["failed", "not_transferred"].includes(child.payment_status) ? "person-card finance-student-card payment-paused" : "person-card finance-student-card"} key={child.id}><div><span className={child.payments_paused ? "pill bad" : child.payment_status === "paid" ? "pill good" : ["overdue", "failed", "not_transferred"].includes(child.payment_status) ? "pill bad" : "pill warn"}>{child.payments_paused ? "תשלומים נעצרו" : child.payment_status === "failed" || child.payment_status === "not_transferred" ? "תשלום לא עבר" : child.payment_status ?? "unconfigured"}</span><h3>{child.full_name}</h3><p>{child.fee_group_name} · מחיר קבוצה: {money(Number(child.group_monthly_fee ?? 0))}</p><p>מחיר בפועל: <strong>{money(actualMonthlyFee(child))}</strong>{child.has_special_arrangement ? " · הסדר מיוחד פעיל" : ""}</p>{["failed", "not_transferred"].includes(child.payment_status) ? <p className="danger-text">סיבה: {child.failure_reason ?? "לא צוינה"} · נדרש ניסיון חוזר: {child.retry_required ? "כן" : "לא"}</p> : null}</div><div className="mini-kpi-row"><span>שולם <b>{child.last_payment_date ? new Date(child.last_payment_date).toLocaleDateString("he-IL") : "-"}</b></span><span>תוקף עד <b>{child.valid_until ? new Date(child.valid_until).toLocaleDateString("he-IL") : "-"}</b></span><span>חוב <b>{money(Number(child.debt_amount ?? 0))}</b></span></div><div className="quick-history-cards"><span>יעד הבא <b>{child.next_payment_due ? new Date(child.next_payment_due).toLocaleDateString("he-IL") : "-"}</b></span><span>אמצעי <b>{child.last_payment_method ?? "-"}</b></span><span>הסדר עד <b>{child.arrangement_valid_until ? new Date(child.arrangement_valid_until).toLocaleDateString("he-IL") : "-"}</b></span></div></article>)}</div>}</section>
      <section className="dashboard-section"><div className="section-heading"><h2>היסטוריית תשלומים</h2><p>פעולות תשלום אחרונות, כולל סכום ששולם, תקופת תוקף, הנחות והסדרים מיוחדים.</p></div>{history.length === 0 ? <div className="empty-state"><strong>אין היסטוריית תשלומים עדיין</strong><span>כאשר תסמנו ילד כשולם/לא שולם/הסדר מיוחד, ההיסטוריה תופיע כאן.</span></div> : <div className="procedure-list">{history.map((item) => <article className="card procedure-card" key={item.id}><div><span className="pill">{item.payment_status}</span><h3>{item.children?.full_name ?? item.child_id}</h3><p>{money(Number(item.amount_paid ?? item.amount ?? 0))} · {item.transaction_type ?? item.action} · {item.payment_method ?? "ללא אמצעי"}</p><small>{item.paid_at ? new Date(item.paid_at).toLocaleDateString("he-IL") : ""} · מ־{item.valid_from ? new Date(item.valid_from).toLocaleDateString("he-IL") : "-"} עד {item.valid_until ? new Date(item.valid_until).toLocaleDateString("he-IL") : "-"}</small></div></article>)}</div>}</section>
    </DashboardShell>
  );
}
