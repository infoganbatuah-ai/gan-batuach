import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedOtpTypes = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);

function observerFailure(request: NextRequest) {
  return NextResponse.redirect(new URL("/digital-observer/verify?error=invalid_code", request.url));
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const typeValue = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const product = request.nextUrl.searchParams.get("product");
  if (!tokenHash || !typeValue || !allowedOtpTypes.has(typeValue)) return observerFailure(request);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeValue });
  if (error || !data.user) return observerFailure(request);

  const isObserver = product === "digital_observer" || data.user.user_metadata?.product === "digital_observer";
  if (isObserver) {
    const account = await supabase.rpc("ensure_digital_observer_account" as any, {
      requested_name: data.user.user_metadata?.full_name ?? null,
      requested_account_type: data.user.user_metadata?.account_type ?? "home"
    });
    if (account.error || account.data !== true) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/digital-observer/verify?error=account_setup_failed", request.url));
    }
    await supabase.auth.signOut();
    const response = NextResponse.redirect(new URL("/digital-observer/login?verified=1", request.url));
    response.cookies.delete("do_pending_email");
    return response;
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
