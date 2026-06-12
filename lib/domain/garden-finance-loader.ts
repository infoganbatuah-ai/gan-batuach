import type { SupabaseClient } from "@supabase/supabase-js";

export type FinanceSearchParams = { filter?: string; debug?: string };

export type FinanceQueryDiagnostic = {
  label: string;
  table: string;
  columns: string;
  success: boolean;
  count: number;
  error?: string | null;
};

type LoaderInput = {
  supabase: SupabaseClient<any, any, any>;
  gardenId?: string | null;
  searchParams?: FinanceSearchParams;
  debug?: boolean;
};

function moneyNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortByName(rows: any[], key = "full_name") {
  return [...(rows ?? [])].sort((a, b) => String(a?.[key] ?? "").localeCompare(String(b?.[key] ?? ""), "he"));
}

function sortRecent(rows: any[]) {
  return [...(rows ?? [])].sort((a, b) => new Date(b?.created_at ?? b?.paid_at ?? 0).getTime() - new Date(a?.created_at ?? a?.paid_at ?? 0).getTime());
}

function isWithinDateRange(value: any, from: string, to?: string) {
  if (!value) return false;
  const date = String(value).slice(0, 10);
  return date >= from && (!to || date < to);
}

function isArrangementActive(child: any) {
  return child.custom_monthly_fee !== null && child.custom_monthly_fee !== undefined && (!child.arrangement_valid_until || new Date(child.arrangement_valid_until).getTime() >= Date.now());
}

function actualMonthlyFee(child: any) {
  return isArrangementActive(child) ? moneyNumber(child.custom_monthly_fee) : moneyNumber(child.group_monthly_fee ?? child.monthly_fee);
}

function normalizeChild(row: any) {
  return {
    id: row?.id,
    full_name: row?.full_name ?? "ילד/ה",
    age_group: row?.age_group ?? null,
    classroom: row?.classroom ?? null,
    payment_group_id: row?.payment_group_id ?? null,
    monthly_fee: moneyNumber(row?.monthly_fee),
    custom_monthly_fee: row?.custom_monthly_fee ?? null,
    arrangement_valid_until: row?.arrangement_valid_until ?? null,
    payment_status: row?.payment_status ?? "unconfigured",
    next_payment_due: row?.next_payment_due ?? null,
    payments_paused: Boolean(row?.payments_paused),
    debt_amount: moneyNumber(row?.debt_amount),
    failure_reason: row?.failure_reason ?? null,
    retry_required: Boolean(row?.retry_required),
    last_payment_date: row?.last_payment_date ?? null,
    valid_until: row?.valid_until ?? null,
    last_payment_method: row?.last_payment_method ?? null,
    last_payment_amount: row?.last_payment_amount ?? row?.last_amount_paid ?? null
  };
}

function errorText(error: any) {
  return [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" · ") || String(error);
}

export async function loadGardenFinanceData({ supabase, gardenId, searchParams = {}, debug = false }: LoaderInput) {
  const diagnostics: FinanceQueryDiagnostic[] = [];
  const errors: string[] = [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

  const empty = {
    ok: false,
    core: {
      gardenId: gardenId ?? null,
      allChildren: [] as any[],
      children: [] as any[],
      totals: {
        expected: 0,
        paid: 0,
        missing: 0,
        overdue: 0,
        partialPayments: 0,
        paidChildren: 0,
        unpaidChildren: 0,
        failedChildren: 0,
        specialArrangements: [] as any[],
        specialArrangementsTotal: 0,
        debtTotal: 0,
        pausedTotal: 0,
        yearRevenue: 0,
        collection: 0
      }
    },
    secondary: {
      feeGroups: [] as any[],
      feeGroupsWithMarket: [] as any[],
      history: [] as any[],
      transfers: [] as any[],
      payoutConfigurations: [] as any[],
      parentPaymentAuthorizations: [] as any[],
      parentPaymentTransactions: [] as any[],
      diagnostics,
      errors
    },
    diagnostics,
    errors
  };

  if (!gardenId) {
    errors.push("missing garden id");
    diagnostics.push({ label: "profile garden", table: "profiles", columns: "garden_id", success: false, count: 0, error: "missing garden id" });
    return empty;
  }

  async function runQuery<T>(label: string, table: string, columns: string, queryFactory: () => PromiseLike<{ data: T[] | null; error: any }>, fallback: T[] = []) {
    try {
      const result = await queryFactory();
      if (result.error) {
        const message = errorText(result.error);
        errors.push(`${label}: ${message}`);
        diagnostics.push({ label, table, columns, success: false, count: 0, error: message });
        if (debug) console.error("[garden-finance-loader] query failed", { label, table, columns, garden_id: gardenId, error: result.error });
        return fallback;
      }
      const rows = result.data ?? fallback;
      diagnostics.push({ label, table, columns, success: true, count: rows.length, error: null });
      return rows;
    } catch (error) {
      const message = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
      errors.push(`${label}: ${message}`);
      diagnostics.push({ label, table, columns, success: false, count: 0, error: message });
      if (debug) console.error("[garden-finance-loader] thrown query failed", { label, table, columns, garden_id: gardenId, error });
      return fallback;
    }
  }

  try {
    const [childrenRows, historyRowsRaw, feeGroupsRaw, enrollmentRows, marketRowsRaw, transferRows, payoutRows, authorizationRows, transactionRows] = await Promise.all([
      runQuery<any>("children query", "children", "*", () => supabase.from("children" as any).select("*").eq("garden_id", gardenId)),
      runQuery<any>("payment history query", "child_payment_history", "*", () => supabase.from("child_payment_history" as any).select("*").eq("garden_id", gardenId)),
      runQuery<any>("fee groups query", "kindergarten_fee_groups", "*", () => supabase.from("kindergarten_fee_groups" as any).select("*").eq("garden_id", gardenId)),
      runQuery<any>("child enrollments query", "child_kindergarten_enrollments", "*", () => supabase.from("child_kindergarten_enrollments" as any).select("*").eq("garden_id", gardenId)),
      runQuery<any>("recommended averages query", "kindergarten_fee_groups", "*", () => supabase.from("kindergarten_fee_groups" as any).select("*").eq("active", true).neq("garden_id", gardenId)),
      runQuery<any>("transfers query", "child_transfer_requests", "*", () => supabase.from("child_transfer_requests" as any).select("*").or(`target_garden_id.eq.${gardenId},current_garden_id.eq.${gardenId}`)),
      runQuery<any>("payout configuration query", "kindergarten_payout_configurations", "*", () => supabase.from("kindergarten_payout_configurations" as any).select("*").eq("garden_id", gardenId)),
      runQuery<any>("parent payment authorization query", "parent_payment_authorizations", "*", () => supabase.from("parent_payment_authorizations" as any).select("*").eq("garden_id", gardenId)),
      runQuery<any>("parent payment transaction query", "parent_payment_transactions", "*", () => supabase.from("parent_payment_transactions" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(80))
    ]);

    const feeGroups = sortByName(feeGroupsRaw, "group_name");
    const marketAverages = new Map<string, number>();
    for (const group of feeGroups) {
      const similar = (marketRowsRaw ?? []).filter((item) => item?.group_name === group?.group_name || (item?.group_name && group?.group_name && String(item.group_name).includes(group.group_name)) || (item?.group_name && group?.group_name && String(group.group_name).includes(item.group_name)));
      const average = similar.length ? Math.round(similar.reduce((sum, item) => sum + moneyNumber(item?.monthly_fee), 0) / similar.length) : 0;
      if (average && group?.id) marketAverages.set(group.id, average);
    }
    const feeGroupsWithMarket = feeGroups.map((group) => ({ ...group, market_average_fee: group?.id ? marketAverages.get(group.id) ?? group.market_average_fee ?? null : null }));
    const feeById = new Map(feeGroups.map((group) => [group?.id, group]));
    const enrollmentByChildId = new Map((enrollmentRows ?? []).filter((row) => row?.child_id).map((row) => [row.child_id, row]));
    const allChildren = sortByName(childrenRows).map(normalizeChild).map((child) => {
      const enrollment = enrollmentByChildId.get(child.id);
      const group = feeById.get(child.payment_group_id) ?? feeById.get(enrollment?.age_group_id) ?? feeGroups.find((item) => item?.group_name === child.age_group || item?.group_name === child.classroom || item?.group_name === enrollment?.classroom_name);
      return {
        ...child,
        fee_group_name: group?.group_name ?? child.classroom ?? child.age_group ?? "ללא קבוצה",
        group_monthly_fee: moneyNumber(group?.monthly_fee ?? child.monthly_fee),
        actual_monthly_fee: isArrangementActive(child) ? moneyNumber(child.custom_monthly_fee) : moneyNumber(group?.monthly_fee ?? child.monthly_fee),
        has_special_arrangement: isArrangementActive(child)
      };
    });

    const filter = searchParams.filter ?? "";
    const children = allChildren.filter((child) => {
      if (filter === "failed") return ["failed", "not_transferred"].includes(child.payment_status);
      if (filter === "not_transferred") return child.payment_status === "not_transferred";
      if (filter === "overdue") return child.payment_status === "overdue" || (child.next_payment_due && new Date(child.next_payment_due).getTime() < Date.now());
      if (filter === "due") return ["overdue", "unpaid", "partial", "failed", "not_transferred", "paused"].includes(child.payment_status) || child.payments_paused;
      if (filter === "partial") return child.payment_status === "partial";
      if (filter === "paused") return child.payments_paused;
      return true;
    });

    const childNameById = new Map(allChildren.map((child) => [child.id, child.full_name]));
    const historyRows = sortRecent(historyRowsRaw).slice(0, 40);
    const history = historyRows.map((item) => ({ ...item, child_name: childNameById.get(item.child_id) ?? item.child_id }));
    const monthHistory = (historyRowsRaw ?? []).filter((item) => isWithinDateRange(item.paid_at ?? item.created_at, monthStart, nextMonthStart));
    const yearHistory = (historyRowsRaw ?? []).filter((item) => isWithinDateRange(item.paid_at ?? item.created_at, yearStart));

    const expected = allChildren.reduce((sum, child) => sum + actualMonthlyFee(child), 0);
    const paid = monthHistory.reduce((sum, item) => sum + moneyNumber(item.amount_paid ?? item.amount), 0);
    const missing = Math.max(0, expected - paid);
    const overdue = allChildren.filter((child) => child.payment_status === "overdue" || (child.next_payment_due && new Date(child.next_payment_due).getTime() < Date.now())).length;
    const partialPayments = allChildren.filter((child) => child.payment_status === "partial").length;
    const paidChildren = allChildren.filter((child) => child.payment_status === "paid").length;
    const unpaidChildren = allChildren.filter((child) => ["overdue", "unpaid", "failed", "not_transferred"].includes(child.payment_status)).length;
    const failedChildren = allChildren.filter((child) => ["failed", "not_transferred"].includes(child.payment_status)).length;
    const specialArrangements = allChildren.filter((child) => child.has_special_arrangement);
    const specialArrangementsTotal = specialArrangements.reduce((sum, child) => sum + moneyNumber(child.custom_monthly_fee), 0);
    const debtTotal = allChildren.reduce((sum, child) => sum + moneyNumber(child.debt_amount), 0);
    const pausedTotal = allChildren.filter((child) => child.payments_paused).reduce((sum, child) => sum + actualMonthlyFee(child), 0);
    const yearRevenue = yearHistory.reduce((sum, item) => sum + moneyNumber(item.amount_paid ?? item.amount), 0);
    const collection = expected ? Math.round((paid / expected) * 100) : 0;

    return {
      ok: errors.length === 0,
      core: {
        gardenId,
        allChildren,
        children,
        totals: { expected, paid, missing, overdue, partialPayments, paidChildren, unpaidChildren, failedChildren, specialArrangements, specialArrangementsTotal, debtTotal, pausedTotal, yearRevenue, collection }
      },
      secondary: {
        feeGroups,
        feeGroupsWithMarket,
        history,
        transfers: transferRows ?? [],
        payoutConfigurations: payoutRows ?? [],
        parentPaymentAuthorizations: authorizationRows ?? [],
        parentPaymentTransactions: transactionRows ?? [],
        diagnostics,
        errors
      },
      diagnostics,
      errors
    };
  } catch (error) {
    const message = error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ""}` : String(error);
    errors.push(`loader unexpected error: ${message}`);
    diagnostics.push({ label: "unexpected loader error", table: "finance loader", columns: "*", success: false, count: 0, error: message });
    if (debug) console.error("[garden-finance-loader] unexpected failure", { garden_id: gardenId, error });
    return empty;
  }
}
