import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  garden_id: z.string().uuid(),
  plan_id: z.string().uuid().optional().nullable(),
  action: z.enum(["create_pending", "adopt_plan", "manual_activate", "reactivate", "suspend", "mark_past_due", "enter_grace", "renew", "cancel"]),
  reason: z.string().trim().max(500).optional().nullable()
});

export async function GET() {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const [subscriptions, plans, gardens] = await Promise.all([
      supabase.from("kindergarten_subscriptions" as any).select("*, gardens(name, city), subscription_plans(name, price_amount, currency)").order("created_at", { ascending: false }).limit(250),
      supabase.from("subscription_plans" as any).select("*").order("sort_order"),
      supabase.from("gardens" as any).select("id,name,city").order("name").limit(500)
    ]);
    if (subscriptions.error || plans.error || gardens.error) return fail("לא ניתן לטעון מנויים כרגע.", 500);
    return ok({ subscriptions: subscriptions.data ?? [], plans: plans.data ?? [], gardens: gardens.data ?? [] });
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    if (payload.action === "create_pending") {
      const ensured = await supabase.rpc("ensure_platform_subscription" as never, {
        target_garden_id: payload.garden_id, requested_plan_id: payload.plan_id ?? null
      } as never);
      if (ensured.error || !ensured.data) return fail("לא ניתן ליצור מנוי גן ממתין.", ensured.error?.code === "42501" ? 403 : 409);
      return ok({ subscription: ensured.data, provider_payment_confirmed: false });
    }
    const current = await supabase.from("kindergarten_subscriptions" as any).select("id")
      .eq("garden_id", payload.garden_id).not("status", "in", "(cancelled,expired)")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (current.error || !current.data) return fail("לא נמצא מנוי נוכחי לגן.", 404);
    if (payload.action === "adopt_plan") {
      if (!payload.plan_id) return fail("יש לבחור תוכנית פעילה.", 422);
      const adopted = await supabase.rpc("admin_adopt_platform_plan" as never, {
        target_subscription_id: current.data.id, target_plan_id: payload.plan_id,
        action_reason: payload.reason ?? null
      } as never);
      if (adopted.error || !adopted.data) return fail("אימוץ תוכנית נדחה; יש לתעד סיבה ולבדוק את סטטוס המנוי.", adopted.error?.code === "42501" ? 403 : 409);
      return ok({ subscription: adopted.data, provider_payment_confirmed: false });
    }
    const changed = await supabase.rpc("admin_transition_platform_subscription" as never, {
      target_subscription_id: current.data.id, requested_action: payload.action, action_reason: payload.reason ?? null
    } as never);
    if (changed.error || !changed.data) return fail("שינוי מצב המנוי נדחה; יש לבדוק את התנאים והסיבה.", changed.error?.code === "42501" ? 403 : 409);
    return ok({ subscription: changed.data, provider_payment_confirmed: false });
  } catch (error) { return handleRouteError(error); }
}
