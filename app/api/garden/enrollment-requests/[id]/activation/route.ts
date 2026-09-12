import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  method: z.enum(["bank_transfer", "standing_order", "checks"]),
  amount: z.coerce.number().min(0).max(1_000_000),
  covered_from: z.string().date(),
  covered_until: z.string().date(),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional()
}).refine((value) => value.covered_until >= value.covered_from, { message: "טווח הכיסוי אינו תקין." });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const target = await supabase.from("kindergarten_enrollment_requests" as never)
      .select("id,status" as never).eq("id", id).eq("garden_id", access.gardenId).maybeSingle();
    if (target.error || !target.data) return fail("בקשת ההצטרפות לא נמצאה בגן הפעיל.", 404);
    const result = await supabase.rpc("record_manual_enrollment_arrangement" as never, {
      target_request_id: id,
      target_method: payload.method,
      target_amount: payload.amount,
      target_covered_from: payload.covered_from,
      target_covered_until: payload.covered_until,
      target_reference: payload.reference ?? null,
      target_note: payload.note ?? null
    } as never);
    if (result.error) {
      return fail(result.error.code === "42501" ? "אין הרשאה לאשר הסדר תשלום עבור בקשה זו." : "לא ניתן להפעיל את ההרשמה במצב הנוכחי.", result.error.code === "42501" ? 403 : 409);
    }
    const data = result.data as { status?: string } | null;
    if (data?.status === "payment_reconciliation_required") return fail("הסדר התשלום נשמר, אך הפעלת ההרשמה דורשת בדיקה ידנית.", 409, data);
    return ok(data);
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
