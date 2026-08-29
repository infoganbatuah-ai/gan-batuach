import * as Sentry from "@sentry/nextjs";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";

export async function POST() {
  try {
    await requireRole(["admin"]);
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return fail("Sentry DSN אינו מוגדר בסביבת השרת.", 503);
    }

    const eventId = Sentry.captureException(new Error("Gan Batuach controlled Sentry connectivity test"), {
      tags: {
        test_type: "admin_connectivity",
        requested_by_role: "admin"
      },
      contexts: {
        connectivity_test: {
          intentional: true
        }
      }
    });
    const flushed = await Sentry.flush(3000);

    return ok({ eventId, flushed });
  } catch (error) {
    return handleRouteError(error);
  }
}
