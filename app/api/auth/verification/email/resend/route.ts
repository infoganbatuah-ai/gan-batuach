import { cookies } from "next/headers";
import { z } from "zod";
import { handleRouteError, ok } from "@/lib/api";
import { authCallbackUrl } from "@/lib/domain/auth-flow";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
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
