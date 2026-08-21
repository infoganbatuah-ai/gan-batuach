import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedOtpTypes = new Set<EmailOtpType>(["email", "signup", "invite", "magiclink", "recovery", "email_change"]);

function isObserverRequest(request: NextRequest) {
  const product = request.nextUrl.searchParams.get("product");
  const requestedProduct = request.cookies.get("auth_callback_product")?.value;
  const redirectTo = request.nextUrl.searchParams.get("redirect_to") ?? "";
  const next = request.nextUrl.searchParams.get("next") ?? "";
  return product === "digital_observer"
    || requestedProduct === "digital_observer"
    || redirectTo.includes("digital-observer")
    || next.includes("digital-observer");
}

function authFailure(request: NextRequest, recovery: boolean, observer: boolean) {
  const path = recovery
    ? observer ? "/digital-observer/forgot-password?error=invalid_link" : "/auth/recovery-invalid"
    : observer ? "/digital-observer/verify?error=invalid_code" : "/login?error=confirmation_failed";
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const typeValue = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const observerRequest = isObserverRequest(request);
  const recovery = typeValue === "recovery";
  if (!tokenHash || !typeValue || !allowedOtpTypes.has(typeValue)) return authFailure(request, recovery, observerRequest);

  const supabase = await createClient();
  let { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: typeValue });

  // Older signup templates used `type=email`, while Supabase issues a signup
  // confirmation token. Retry only that narrow, equivalent verification type.
  if ((error || !data.user) && typeValue === "email") {
    ({ data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" }));
  }
  if (error || !data.user) return authFailure(request, recovery, observerRequest);

  const confirmedObserver = observerRequest
    || data.user.user_metadata?.product === "digital_observer"
    || data.user.app_metadata?.digital_observer_admin === true;

  if (recovery) {
    const response = NextResponse.redirect(new URL(confirmedObserver ? "/digital-observer/set-password" : "/reset-password", request.url));
    response.cookies.delete("auth_callback_product");
    response.cookies.delete("auth_callback_flow");
    return response;
  }

  const pendingEmail = request.cookies.get("do_pending_email")?.value?.trim().toLowerCase();
  const pendingName = request.cookies.get("do_pending_name")?.value ?? null;
  const pendingAccountTypeValue = request.cookies.get("do_pending_account_type")?.value;
  const pendingAccountType = pendingAccountTypeValue === "business" || pendingAccountTypeValue === "home"
    ? pendingAccountTypeValue
    : null;
  const isObserver = confirmedObserver
    || (Boolean(pendingEmail) && pendingEmail === data.user.email?.toLowerCase());
  if (isObserver) {
    const account = await supabase.rpc("ensure_digital_observer_account" as any, {
      requested_name: pendingName ?? data.user.user_metadata?.full_name ?? null,
      requested_account_type: pendingAccountType ?? data.user.user_metadata?.account_type ?? "home"
    });
    if (account.error || account.data !== true) {
      console.error("Digital Observer account preparation failed after email-link verification", {
        code: account.error?.code ?? "unknown",
        message: account.error?.message ?? "No database error returned",
        returnedTrue: account.data === true
      });
    }
    await supabase.auth.signOut();
    const response = NextResponse.redirect(new URL("/digital-observer/login?verified=1", request.url));
    response.cookies.delete("do_pending_email");
    response.cookies.delete("do_pending_name");
    response.cookies.delete("do_pending_account_type");
    response.cookies.delete("auth_callback_product");
    response.cookies.delete("auth_callback_flow");
    return response;
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.delete("auth_callback_product");
  response.cookies.delete("auth_callback_flow");
  return response;
}
