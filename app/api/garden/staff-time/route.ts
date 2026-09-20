import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rate"), employment_id: z.string().uuid(), rate_kind: z.enum(["hourly", "monthly"]), amount: z.number().nonnegative().max(1_000_000), effective_from: z.iso.date() }),
  z.object({ action: z.literal("correct"), shift_id: z.string().uuid(), actual_start: z.iso.datetime({ offset: true }), actual_end: z.iso.datetime({ offset: true }), reason: z.string().trim().min(8).max(1000) }),
  z.object({ action: z.literal("approve"), shift_id: z.string().uuid() }),
  z.object({ action: z.literal("reopen"), shift_id: z.string().uuid(), reason: z.string().trim().min(8).max(1000) })
]);

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  // Spreadsheet applications interpret leading formula markers as code.
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const period = z.iso.date().parse(new URL(request.url).searchParams.get("period"));
    if (!period.endsWith("-01")) return fail("יש לבחור את היום הראשון בחודש.", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("management_staff_time_export" as never, {
      p_garden_id: access.gardenId, p_period_start: period
    } as never);
    if (error) return fail("לא ניתן להפיק נתוני שעות עבודה.", 403);
    const rows = (data ?? []) as Record<string, unknown>[];
    if (new URL(request.url).searchParams.get("format") !== "csv") return ok({ period, rows });
    const columns = ["staff_id", "employment_id", "staff_name", "shift_date", "planned_start", "planned_end", "actual_start", "actual_end", "worked_minutes", "approval_state", "rate_kind", "rate_amount", "estimated_labor_cost", "currency", "missing_clock_out"];
    const csv = [columns.map(csvCell).join(","), ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\r\n");
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="staff-time-${period.slice(0, 7)}.csv"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const input = mutation.parse(await request.json());
    const supabase = await createClient();
    const result = input.action === "rate"
      ? await supabase.rpc("management_create_staff_time_rate" as never, { p_employment_id: input.employment_id, p_rate_kind: input.rate_kind, p_amount: input.amount, p_effective_from: input.effective_from } as never)
      : input.action === "correct"
        ? await supabase.rpc("management_correct_staff_shift" as never, { p_shift_id: input.shift_id, p_actual_start: input.actual_start, p_actual_end: input.actual_end, p_reason: input.reason } as never)
        : await supabase.rpc("management_review_staff_shift" as never, { p_shift_id: input.shift_id, p_action: input.action, p_reason: input.action === "reopen" ? input.reason : null } as never);
    if (result.error) return fail("הפעולה נדחתה. בדקו הרשאה, תקופת עבודה ומצב רשומה.", 403);
    return ok(result.data);
  } catch (error) { return handleSafeRouteError(error); }
}
