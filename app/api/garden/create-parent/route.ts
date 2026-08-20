import { fail, handleRouteError } from "@/lib/api";
import { requireRole } from "@/lib/auth";

/**
 * Kept as a guarded compatibility endpoint so old clients cannot create a
 * direct parent-to-kindergarten link without the parent's approval.
 */
export async function POST() {
  try {
    await requireRole(["manager", "owner"]);
    return fail(
      "יצירת הורה ישירה הוחלפה בהזמנה מאובטחת. יש להשתמש במסך הזמנת הורים, והשיוך יושלם רק לאחר אישור ההורה.",
      409,
      { replacement_endpoint: "/api/garden/parent-invitations", parent_acceptance_required: true }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
