import { timingSafeEqual } from "node:crypto";
import { fail, ok } from "@/lib/api";
import { processManagementDeliveryBatch } from "@/lib/management/external-delivery";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.GB_M31_DELIVERY_WORKER_SECRET;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected) return fail("Delivery worker is not configured.", 503);
  const a = Buffer.from(expected); const b = Buffer.from(presented);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail("Unauthorized.", 401);
  try { return ok(await processManagementDeliveryBatch()); }
  catch { return fail("Delivery batch requires reconciliation.", 503); }
}
