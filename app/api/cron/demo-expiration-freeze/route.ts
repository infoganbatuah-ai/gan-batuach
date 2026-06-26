import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret");
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return fail("Unauthorized cron request", 401);
    }
    if (!isAdminClientConfigured()) return fail("Supabase service role is required for demo freeze processing.", 503);
    await assertRateLimit("cron", "/api/cron/demo-expiration-freeze", 12, 3600);

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const expired = await admin
      .from("kindergarten_subscriptions" as any)
      .select("id,garden_id,status,trial_ends_at,admin_override,billing_status,metadata,gardens(id,name,manager_id)")
      .in("status", ["demo_active", "trial"])
      .eq("admin_override", false)
      .lte("trial_ends_at", now)
      .limit(100);

    if (expired.error) return fail(expired.error.message, 500);

    const results: Array<Record<string, unknown>> = [];
    for (const subscription of (expired.data ?? []) as any[]) {
      const paid = await admin
        .from("subscription_payments" as any)
        .select("id")
        .eq("subscription_id", subscription.id)
        .in("billing_status", ["paid"])
        .limit(1)
        .maybeSingle();
      if (paid.data?.id) {
        results.push({ subscription_id: subscription.id, action: "skipped_paid_payment_exists" });
        continue;
      }

      const freezeReason = "Demo expired without active subscription payment.";
      const freeze = await admin.from("kindergarten_subscriptions" as any).update({
        status: "frozen",
        billing_status: "suspended",
        trial_status: "expired",
        suspended_at: now,
        suspension_reason: freezeReason,
        updated_at: now,
        metadata: {
          ...(subscription.metadata ?? {}),
          demo_freeze_processed_at: now,
          demo_freeze_reason: freezeReason
        }
      }).eq("id", subscription.id);
      if (freeze.error) {
        results.push({ subscription_id: subscription.id, action: "freeze_failed", error: freeze.error.message });
        continue;
      }

      await Promise.all([
        admin.from("gardens" as any).update({
          activation_payment_status: "frozen",
          frozen_at: now,
          freeze_reason: freezeReason,
          status: "suspended"
        }).eq("id", subscription.garden_id),
        admin.from("kindergarten_activation_events" as any).insert({
          garden_id: subscription.garden_id,
          event_type: "garden_frozen",
          status: "recorded",
          notes: "דמו הסתיים ללא תשלום מנוי פעיל.",
          metadata: { subscription_id: subscription.id, source: "demo_expiration_freeze_cron" }
        }),
        admin.from("notifications" as any).insert({
          garden_id: subscription.garden_id,
          recipient_id: subscription.gardens?.manager_id ?? null,
          recipient_role: "manager",
          title: "הדמו הסתיים והגן הוקפא",
          body: "תקופת הדמו הסתיימה ללא תשלום מנוי פעיל. ניתן להסדיר תשלום כדי להחזיר פעילות מלאה.",
          message: "תקופת הדמו הסתיימה ללא תשלום מנוי פעיל. ניתן להסדיר תשלום כדי להחזיר פעילות מלאה.",
          entity_type: "kindergarten_subscriptions",
          entity_id: subscription.id,
          severity: "urgent",
          action_url: "/dashboard/garden/subscription",
          recipient_profile_id: subscription.gardens?.manager_id ?? null,
          kindergarten_id: subscription.garden_id,
          metadata: { source: "demo_expiration_freeze_cron", subscription_id: subscription.id }
        }),
        admin.from("audit_logs" as any).insert({
          actor_role: "system",
          garden_id: subscription.garden_id,
          entity_type: "kindergarten_subscriptions",
          entity_id: subscription.id,
          action: "demo_expired_subscription_frozen",
          after_data: { status: "frozen", reason: freezeReason, processed_at: now }
        })
      ]);

      results.push({ subscription_id: subscription.id, garden_id: subscription.garden_id, action: "frozen" });
    }

    return ok({ processed: results.length, results });
  } catch (error) {
    return handleRouteError(error);
  }
}
