import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { assertGanAddressProviderBudget, searchGanAddresses } from "@/lib/management/verified-address";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";

const schema = z.object({
  input: z.string().trim().min(6).max(120),
  session_token: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const payload = schema.parse(await parseBoundedJson(request, 1024));
    await assertGanAddressProviderBudget(privateRateLimitIdentifier({ headers: request.headers }));
    const result = await searchGanAddresses(payload.input, payload.session_token);
    if (!result.configured) return fail("שירות הכתובות אינו זמין כעת. אפשר להזין כתובת ידנית שתסומן כלא מאומתת.", 503);
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ADDRESS_PROVIDER_UNAVAILABLE") return fail("שירות הכתובות אינו זמין כעת.", 503);
    return handleRouteError(error);
  }
}
