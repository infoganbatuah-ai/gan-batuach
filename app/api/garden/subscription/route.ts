import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getPaymentProviderAdapter } from "@/lib/domain/billing";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["request_upgrade", "request_renewal"]),
  plan_id: z.string().uuid().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const payload = schema.parse(await request.json());
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש.", 403);
    const supabase = !profile.active && isAdminClientConfigured() ? createAdminClient() : await createClient();
    const subscription = await supabase
      .from("kindergarten_subscriptions" as any)
      .select("*")
      .eq("garden_id", profile.garden_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const provider = getPaymentProviderAdapter("manual");
    const checkout = await provider.createCheckoutSession({
      subscriptionId: subscription.data?.id ?? profile.garden_id,
      amount: 0,
      currency: "ILS",
      successUrl: "/dashboard/garden/subscription",
      cancelUrl: "/dashboard/garden/subscription"
    });

    const notification = await supabase.from("notifications" as any).insert({
      garden_id: profile.garden_id,
      recipient_role: "admin",
      title: payload.action === "request_upgrade" ? "בקשת שדרוג מנוי" : "בקשת חידוש מנוי",
      body: "מנהלת/בעלים ביקשו טיפול במנוי. החיוב עדיין ידני עד חיבור ספק תשלומים.",
      entity_type: "kindergarten_subscriptions",
      entity_id: subscription.data?.id ?? null,
      severity: "medium",
      action_url: "/dashboard/admin/subscriptions",
      created_by: profile.id,
      metadata: { action: payload.action, plan_id: payload.plan_id ?? null, notes: payload.notes ?? null, provider: checkout.provider }
    });
    if (notification.error) console.error("[subscription-request-notification]", notification.error);

    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "kindergarten_subscriptions",
      entity_id: subscription.data?.id ?? null,
      action: payload.action,
      after_data: { ...payload, provider_result: checkout }
    });

    return ok({ status: "sent", provider: checkout.provider, message: "הבקשה נשלחה לאדמין. חיבור ספק תשלומים יתווסף בהמשך." });
  } catch (error) {
    return handleRouteError(error);
  }
}
