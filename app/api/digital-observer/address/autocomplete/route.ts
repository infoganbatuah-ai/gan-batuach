import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { autocompleteObserverAddress } from "@/lib/domain/digital-observer/address-provider";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  input: z.string().trim().min(3).max(180),
  session_token: z.string().trim().min(8).max(100).optional()
});

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const result = await autocompleteObserverAddress(payload.input, payload.session_token);
    if (!result.configured) return fail("שירות אימות הכתובת עדיין לא הוגדר. אפשר למלא ידנית ולשמור ככתובת שדורשת אימות.", 503);
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_PROVIDER_UNAVAILABLE") {
      return fail("שירות הכתובות אינו זמין כרגע. נסו שוב או המשיכו במילוי ידני.", 503);
    }
    return handleRouteError(error);
  }
}
