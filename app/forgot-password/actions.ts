"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authCallbackUrl } from "@/lib/domain/auth-flow";

export async function requestGanBatuachPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (email.includes("@")) {
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: false,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 30,
      path: "/"
    };
    cookieStore.set("auth_callback_product", "gan_batuach", cookieOptions);
    cookieStore.set("auth_callback_flow", "recovery", cookieOptions);
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl("gan_batuach", "/reset-password", "recovery")
    });
    if (error) {
      console.error("Gan Batuach password recovery email request failed", {
        code: error.code ?? "unknown",
        status: error.status ?? null
      });
    }
  }
  redirect("/forgot-password?sent=1");
}
