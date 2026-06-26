import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getProviderActivationInventory } from "@/lib/domain/provider-configuration-validator";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש.", 403);

    const providerInventory = getProviderActivationInventory();
    const payment = providerInventory.find((provider) => provider.type === "payment");
    if (!payment) return fail("לא נמצא מודל כשירות לספק התשלומים.", 503);

    const supabase = !profile.active && isAdminClientConfigured() ? createAdminClient() : await createClient();
    const { data: subscription, error } = await supabase
      .from("kindergarten_subscriptions" as any)
      .select("id, garden_id, status, provider, provider_mode, current_period_end, demo_started_at, demo_expires_at")
      .eq("garden_id", profile.garden_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return fail("לא ניתן לטעון את סטטוס המנוי כרגע.", 400);

    const checkoutStatus = payment.status === "sandbox_ready" ? "sandbox_ready" : "readiness_only";
    const message = checkoutStatus === "sandbox_ready"
      ? "ספק התשלומים מוכן לבדיקת sandbox. לא בוצע חיוב אמיתי."
      : "ספק התשלומים עדיין לא מוגדר ל-sandbox. מוצגת כשירות בלבד ללא חיוב.";

    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "kindergarten_subscriptions",
      entity_id: subscription?.id ?? null,
      action: "subscription_sandbox_checkout_requested",
      after_data: {
        provider: payment.provider,
        mode: payment.mode,
        checkout_status: checkoutStatus,
        live_payment: false,
        missing_env: payment.missingEnv
      }
    });

    await supabase.from("notifications" as any).insert({
      garden_id: profile.garden_id,
      recipient_role: "admin",
      title: "בדיקת sandbox למנוי התבקשה",
      body: "מנהלת/בעלים ביקשו בדיקת תשלום sandbox. לא בוצע חיוב אמיתי.",
      entity_type: "kindergarten_subscriptions",
      entity_id: subscription?.id ?? null,
      severity: checkoutStatus === "sandbox_ready" ? "low" : "medium",
      action_url: "/dashboard/admin/integrations",
      created_by: profile.id,
      metadata: {
        provider: payment.provider,
        mode: payment.mode,
        checkout_status: checkoutStatus,
        live_payment: false
      }
    });

    return ok({
      status: checkoutStatus,
      provider: payment.provider,
      mode: payment.mode,
      subscription_status: subscription?.status ?? null,
      checkout_url: null,
      missing_env: payment.missingEnv,
      message
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
