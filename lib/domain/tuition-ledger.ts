export type TuitionPeriod = {
  id: string;
  garden_id: string;
  enrollment_id: string;
  child_id?: string;
  period_start: string;
  period_end: string;
  due_at: string | null;
  base_amount: number;
  adjustment_total: number;
  settled_total: number;
  unapplied_credit_total?: number;
  status: string;
  reconciliation_reason?: string | null;
};

export function projectTuitionPeriod(period: TuitionPeriod, asOf = new Date().toISOString().slice(0, 10)) {
  const amountDue = Number(period.base_amount) + Number(period.adjustment_total);
  const amountSettled = Number(period.settled_total);
  const outstanding = Math.max(0, amountDue - amountSettled);
  const status = (period.status === "pending" || period.status === "partially_paid") && period.due_at && period.due_at < asOf && outstanding > 0
    ? "overdue" : period.status;
  return { ...period, amount_due: amountDue, amount_settled: amountSettled, outstanding, unapplied_credit_total: Number(period.unapplied_credit_total ?? 0), status };
}
