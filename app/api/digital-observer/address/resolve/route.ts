import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { resolveObserverAddress } from "@/lib/domain/digital-observer/address-provider";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  place_id: z.string().trim().min(4).max(300),
  session_token: z.string().trim().min(8).max(100).optional()
});

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const address = await resolveObserverAddress(payload.place_id, payload.session_token);
    if (!address) return fail("לא ניתן לאמת את הכתובת שנבחרה.", 422);
    return ok({ address });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_PROVIDER_UNAVAILABLE") {
      return fail("שירות הכתובות אינו זמין כרגע. נסו שוב.", 503);
    }
    return handleRouteError(error);
  }
}
