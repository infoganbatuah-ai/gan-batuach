import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { planTypes } from "@/lib/domain/billing";

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  plan_type: z.enum(planTypes),
  price_amount: z.coerce.number().min(0),
  currency: z.string().trim().default("ILS"),
  duration_days: z.coerce.number().int().min(1).optional().nullable(),
  trial_days: z.coerce.number().int().min(0).default(0),
  active_users_limit: z.coerce.number().int().min(0).optional().nullable(),
  active_children_limit: z.coerce.number().int().min(0).optional().nullable(),
  camera_limit: z.coerce.number().int().min(0).optional().nullable(),
  storage_limit_mb: z.coerce.number().int().min(0).optional().nullable(),
  enabled_features: z.record(z.string(), z.boolean()).default({}),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(100)
});

export async function GET() {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const { data, error } = await supabase.from("subscription_plans" as any).select("*").order("sort_order");
    if (error) return fail("לא ניתן לטעון תוכניות מנוי כרגע.", 500);
    return ok({ plans: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const row = {
      ...payload,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
      created_by: payload.id ? undefined : profile.id
    };
    const mutation = payload.id
      ? await supabase.from("subscription_plans" as any).update(row).eq("id", payload.id).select("*").single()
      : await supabase.from("subscription_plans" as any).insert(row).select("*").single();
    if (mutation.error || !mutation.data) {
      console.error("[subscription-plan-save]", mutation.error);
      return fail("לא ניתן לשמור תוכנית מנוי כרגע.", 500);
    }
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "admin",
      entity_type: "subscription_plans",
      entity_id: mutation.data.id,
      action: payload.id ? "update_subscription_plan" : "create_subscription_plan",
      after_data: mutation.data
    });
    return ok({ plan: mutation.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
