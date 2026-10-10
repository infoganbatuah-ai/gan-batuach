export type DashboardSourceState = "ready" | "empty" | "unavailable";

type AttendanceRow = { status?: unknown };
type TuitionRow = {
  base_amount?: unknown;
  adjustment_total?: unknown;
  settled_total?: unknown;
  status?: unknown;
  due_at?: unknown;
  currency?: unknown;
};

function finiteMoney(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function deriveAttendanceSummary(rows: AttendanceRow[], expected: number) {
  const present = rows.filter(row => ["present", "late"].includes(String(row.status))).length;
  const absent = rows.filter(row => ["absent", "excused_absence", "sick"].includes(String(row.status))).length;
  const departed = rows.filter(row => ["departed", "checked_out"].includes(String(row.status))).length;
  const recorded = present + absent + departed;
  return {
    expected: Math.max(0, expected),
    present,
    absent,
    departed,
    recorded,
    completion: expected > 0 ? Math.min(100, Math.round((recorded / expected) * 100)) : 0
  };
}

export function deriveTuitionSummary(rows: TuitionRow[], today: string) {
  let dueMinor = 0;
  let settledMinor = 0;
  let outstandingMinor = 0;
  let overdue = 0;
  let reconciliation = 0;
  let currency: string | null = null;
  for (const row of rows) {
    const due = finiteMoney(row.base_amount) + finiteMoney(row.adjustment_total);
    const settled = finiteMoney(row.settled_total);
    const outstanding = Math.max(0, due - settled);
    dueMinor += due;
    settledMinor += settled;
    outstandingMinor += outstanding;
    currency ??= row.currency ? String(row.currency) : null;
    if (row.status === "reconciliation_required") reconciliation += 1;
    if (outstanding > 0 && row.due_at && String(row.due_at) < today) overdue += 1;
  }
  return {
    due: dueMinor / 100,
    settled: settledMinor / 100,
    outstanding: outstandingMinor / 100,
    overdue,
    reconciliation,
    currency: currency ?? "ILS"
  };
}

export function selectAuthorizedChild<T extends { id?: unknown; child_id?: unknown; permanent_child_file_id?: unknown }>(
  children: T[],
  requestedId: string | null
) {
  const childId = (child: T) => String(child.child_id ?? child.permanent_child_file_id ?? child.id ?? "");
  if (requestedId) return children.find(child => childId(child) === requestedId) ?? null;
  return children[0] ?? null;
}

export function safeDashboardMessagePreview(message: { sender?: { full_name?: unknown } | null; subject?: unknown }) {
  return {
    title: String(message.sender?.full_name ?? message.subject ?? "הודעה חדשה"),
    summary: "יש הודעה חדשה בשיחה המורשית"
  };
}

export function safetyCapabilityState(input: {
  configuredCameraCount: number;
  verifiedOperationalCount: number;
  providerReady: boolean;
}) {
  if (!input.configuredCameraCount) return { state: "unavailable" as const, label: "טרם הוגדרה מערכת מצלמות" };
  if (!input.providerReady || input.verifiedOperationalCount <= 0) {
    return { state: "readiness" as const, label: "המערכת בהקמה או בבדיקת מוכנות" };
  }
  return { state: "verified" as const, label: `${input.verifiedOperationalCount} מצלמות במצב תפעולי מאומת` };
}
