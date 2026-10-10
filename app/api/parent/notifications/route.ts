import { fail, handleRouteError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { GET as listOwnNotifications } from "@/app/api/notifications/route";

export const GET = listOwnNotifications;

// Domain events create notifications server-side; clients may not forge recipients or content.
export async function POST() {
  try {
    await requireUser();
    return fail("התראות נוצרות מאירועי מערכת בלבד", 405);
  } catch (error) {
    return handleRouteError(error);
  }
}
