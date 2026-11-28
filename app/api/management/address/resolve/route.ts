import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { assertGanAddressProviderBudget, resolveGanAddress } from "@/lib/management/verified-address";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";

const schema = z.object({
  place_id: z.string().trim().min(4).max(300),
  session_token: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const payload = schema.parse(await parseBoundedJson(request, 1024));
    await assertGanAddressProviderBudget(privateRateLimitIdentifier({ headers: request.headers }));
    const address = await resolveGanAddress(payload.place_id, payload.session_token);
    if (!address) return fail("לא ניתן לאמת את הכתובת שנבחרה בישראל.", 422);
    return ok({ address });
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_PROVIDER_UNAVAILABLE") return fail("שירות הכתובות אינו זמין כעת.", 503);
    return handleRouteError(error);
  }
}
