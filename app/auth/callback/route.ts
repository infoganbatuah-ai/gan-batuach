import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null, product: string | null) {
  if (product === "digital_observer") {
    return value?.startsWith("/digital-observer") && !value.startsWith("//") ? value : "/digital-observer/login?verified=1";
  }
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const product = requestUrl.searchParams.get("product");
  const next = safeNext(requestUrl.searchParams.get("next"), product);

  if (!code && product === "digital_observer") {
    return NextResponse.redirect(new URL("/digital-observer/login?error=confirmation_failed", requestUrl.origin));
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const failurePath = product === "digital_observer" ? "/digital-observer/login?error=confirmation_failed" : "/login?error=confirmation_failed";
      return NextResponse.redirect(new URL(failurePath, requestUrl.origin));
    }
    if (product === "digital_observer" || data.user?.user_metadata?.product === "digital_observer") {
      const account = await supabase.rpc("ensure_digital_observer_account" as any, {
        requested_name: data.user?.user_metadata?.full_name ?? null,
        requested_account_type: data.user?.user_metadata?.account_type ?? "home"
      });
      if (account.error || account.data !== true) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/digital-observer/login?error=observer_setup_required", requestUrl.origin));
      }
      await supabase.auth.signOut();
    }
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin));
  if (product === "digital_observer") response.cookies.delete("do_pending_email");
  return response;
}
