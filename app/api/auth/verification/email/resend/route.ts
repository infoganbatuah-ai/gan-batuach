import { cookies } from "next/headers";
import { z } from "zod";
import { handleRouteError, ok } from "@/lib/api";
import { authCallbackUrl } from "@/lib/domain/auth-flow";
import { createClient } from "@/lib/supabase/server";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    await assertRateLimit(privateRateLimitIdentifier({ headers: request.headers }), "management:email-verification-resend", 10, 10 * 60);
    const { email } = schema.parse(await parseBoundedJson(request, 4 * 1024));
    const cookieStore = await cookies();
    cookieStore.set("auth_callback_product", "gan_batuach", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 30,
      path: "/"
    });
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authCallbackUrl("gan_batuach", "/app/verify-contact", "verify") }
    });
    if (error) console.error("Management email verification resend failed", { code: error.code ?? "unknown", status: error.status ?? null });
    return ok({ accepted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
