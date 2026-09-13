import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
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
  sort_order: z.coerce.number().int().default(100),
  billing_interval: z.enum(["monthly", "annual"]).default("monthly"),
  commitment_months: z.coerce.number().int().min(1).default(12),
  grace_days: z.coerce.number().int().min(0).optional().nullable(),
  is_default: z.coerce.boolean().default(false)
});

async function adminAccess() {
  const { user, profile } = await getSessionProfile();
  if (!user) return { error: fail("נדרשת התחברות מחדש.", 401), profile: null };
  if (profile?.role !== "admin" || profile.active !== true) return { error: fail("נדרשת הרשאת מנהל מערכת.", 403), profile: null };
  return { error: null, profile };
}

export async function GET() {
  try {
    const access = await adminAccess();
    if (access.error) return access.error;
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
    const access = await adminAccess();
    if (access.error) return access.error;
    if (!access.profile) return fail("נדרשת הרשאת מנהל מערכת.", 403);
    const { profile } = access;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    if (payload.id) {
      const versioned = await supabase.rpc("admin_version_platform_plan" as never, {
        target_plan_id: payload.id, proposed_name: payload.name,
        proposed_price: payload.price_amount, proposed_currency: payload.currency,
        proposed_billing_interval: payload.billing_interval,
        proposed_grace_days: payload.grace_days ?? null, make_default: payload.is_default
      } as never);
      if (versioned.error || !versioned.data) return fail("לא ניתן ליצור גרסת תוכנית חדשה.", versioned.error?.code === "42501" ? 403 : 409);
      return ok({ plan: versioned.data });
    }
    const normalizedPlanType = payload.plan_type;
    const row = {
      ...payload,
      id: undefined,
      code: `plan-${crypto.randomUUID()}`,
      version: 1,
      plan_type: normalizedPlanType,
      duration_days: payload.duration_days,
      annual_price: payload.billing_interval === "monthly" ? payload.price_amount * 12 : payload.price_amount,
      monthly_price: payload.billing_interval === "monthly" ? payload.price_amount : null,
      billing_cycle_options: [payload.billing_interval],
      public_purchase_enabled: normalizedPlanType === "annual" ? payload.active : false,
      is_default: false,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
      created_by: profile.id
    };
    const mutation = await supabase.from("subscription_plans" as any).insert(row).select("*").single();
    if (mutation.error || !mutation.data) {
      console.error("[subscription-plan-save]", mutation.error);
      return fail("לא ניתן לשמור תוכנית מנוי כרגע.", 500);
    }
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "admin",
      entity_type: "subscription_plans",
      entity_id: mutation.data.id,
      action: "create_subscription_plan",
      after_data: mutation.data
    });
    return ok({ plan: mutation.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
