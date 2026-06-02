import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const monitoringModes = ["always_on", "custom_schedule", "night_only", "business_hours", "event_only"] as const;
const subscriptionStatuses = ["trial", "active", "pending_payment", "expired", "suspended", "cancelled"] as const;

const packageSchema = z.object({
  action: z.literal("save_package"),
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(2),
  package_key: z.string().trim().min(2).regex(/^[a-z0-9_]+$/),
  description: z.string().trim().optional().nullable(),
  package_type: z.enum(["home", "business", "enterprise", "custom"]),
  camera_limit: z.coerce.number().int().min(0).optional().nullable(),
  monitoring_mode: z.enum(monitoringModes),
  monitoring_hours: z.record(z.string(), z.unknown()).default({}),
  event_retention_days: z.coerce.number().int().min(1).default(30),
  recording_retention_days: z.coerce.number().int().min(0).default(0),
  ai_event_types_enabled: z.array(z.string().trim()).default([]),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
  sms_alerts_enabled: z.coerce.boolean().default(false),
  whatsapp_alerts_enabled: z.coerce.boolean().default(false),
  human_review_required: z.coerce.boolean().default(true),
  monthly_price: z.coerce.number().min(0).default(0),
  annual_price: z.coerce.number().min(0).default(0),
  currency: z.string().trim().default("ILS"),
  active: z.coerce.boolean().default(true),
  sort_order: z.coerce.number().int().default(100)
});

const assignmentSchema = z.object({
  action: z.literal("assign_package"),
  observer_site_id: z.string().uuid(),
  package_id: z.string().uuid(),
  status: z.enum(subscriptionStatuses).default("trial"),
  trial_start: z.string().optional().nullable(),
  trial_end: z.string().optional().nullable(),
  renewal_date: z.string().optional().nullable(),
  override_limits: z.record(z.string(), z.unknown()).default({}),
  monitoring_schedule: z.record(z.string(), z.unknown()).default({}),
  timezone: z.string().trim().default("Asia/Jerusalem"),
  active_days: z.array(z.string()).default([]),
  active_hours: z.record(z.string(), z.unknown()).default({})
});

const usageSchema = z.object({
  action: z.literal("snapshot_usage"),
  observer_site_id: z.string().uuid(),
  period_start: z.string().optional(),
  period_end: z.string().optional()
});

const payloadSchema = z.discriminatedUnion("action", [packageSchema, assignmentSchema, usageSchema]);

async function countRows(supabase: Awaited<ReturnType<typeof createClient>>, table: string, filters: Array<[string, string, unknown]>) {
  try {
    let query = supabase.from(table as any).select("id", { count: "exact", head: true });
    filters.forEach(([column, operator, value]) => {
      query = (query as any).filter(column, operator, value);
    });
    const result = await query;
    if (result.error) return { count: 0, error: result.error.message };
    return { count: result.count ?? 0, error: null };
  } catch (error) {
    return { count: 0, error: error instanceof Error ? error.message : "unknown error" };
  }
}

export async function GET() {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const [packages, sites, subscriptions, usage] = await Promise.all([
      supabase.from("observer_monitoring_packages" as any).select("*").order("sort_order", { ascending: true }),
      supabase.from("observer_sites" as any).select("id, name, site_type, active, observer_package_id, observer_subscription_status").order("name", { ascending: true }).limit(500),
      supabase.from("observer_site_subscriptions" as any).select("*, observer_sites(name, site_type), observer_monitoring_packages(name, package_type)").order("created_at", { ascending: false }).limit(300),
      supabase.from("observer_site_usage_snapshots" as any).select("*, observer_sites(name, site_type)").order("period_start", { ascending: false }).limit(300)
    ]);
    const firstError = packages.error ?? sites.error ?? subscriptions.error ?? usage.error;
    if (firstError) {
      console.error("[observer-packages-load]", firstError);
      return fail("לא ניתן לטעון חבילות Digital Observer כרגע.", 500);
    }
    return ok({
      packages: packages.data ?? [],
      sites: sites.data ?? [],
      subscriptions: subscriptions.data ?? [],
      usage: usage.data ?? []
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = payloadSchema.parse(await request.json());
    const supabase = await createClient();

    if (payload.action === "save_package") {
      const row = {
        name: payload.name,
        package_key: payload.package_key,
        description: payload.description,
        package_type: payload.package_type,
        camera_limit: payload.camera_limit,
        monitoring_mode: payload.monitoring_mode,
        monitoring_hours: payload.monitoring_hours,
        event_retention_days: payload.event_retention_days,
        recording_retention_days: payload.recording_retention_days,
        ai_event_types_enabled: payload.ai_event_types_enabled,
        feature_flags: payload.feature_flags,
        sms_alerts_enabled: payload.sms_alerts_enabled,
        whatsapp_alerts_enabled: payload.whatsapp_alerts_enabled,
        human_review_required: true,
        monthly_price: payload.monthly_price,
        annual_price: payload.annual_price,
        currency: payload.currency,
        active: payload.active,
        sort_order: payload.sort_order,
        metadata: { future_standalone_product: true },
        updated_at: new Date().toISOString()
      };
      const result = payload.id
        ? await supabase.from("observer_monitoring_packages" as any).update(row).eq("id", payload.id).select("*").single()
        : await supabase.from("observer_monitoring_packages" as any).insert(row).select("*").single();
      if (result.error || !result.data) {
        console.error("[observer-package-save]", result.error);
        return fail("לא ניתן לשמור את חבילת ה-Digital Observer.", 500);
      }
      await supabase.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: "admin",
        entity_type: "observer_monitoring_packages",
        entity_id: result.data.id,
        action: payload.id ? "update_observer_package" : "create_observer_package",
        after_data: result.data
      });
      return ok({ package: result.data });
    }

    if (payload.action === "assign_package") {
      const site = await supabase.from("observer_sites" as any).select("id, site_type, name").eq("id", payload.observer_site_id).single();
      if (site.error || !site.data) return fail("לא נמצא אתר Digital Observer לשיוך.", 404);
      if (site.data.site_type === "kindergarten") {
        return fail("בגני ילדים התצפיתן הדיגיטלי כלול במנוי גן בטוח. אין לשייך חבילת standalone לגן.", 409);
      }
      const existing = await supabase.from("observer_site_subscriptions" as any).select("id").eq("observer_site_id", payload.observer_site_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const subscriptionRow = {
        observer_site_id: payload.observer_site_id,
        package_id: payload.package_id,
        status: payload.status,
        trial_start: payload.trial_start,
        trial_end: payload.trial_end,
        renewal_date: payload.renewal_date,
        override_limits: payload.override_limits,
        monitoring_schedule: payload.monitoring_schedule,
        timezone: payload.timezone,
        active_days: payload.active_days,
        active_hours: payload.active_hours,
        metadata: { future_standalone_product: true },
        updated_at: new Date().toISOString()
      };
      const saved = existing.data?.id
        ? await supabase.from("observer_site_subscriptions" as any).update(subscriptionRow).eq("id", existing.data.id).select("*").single()
        : await supabase.from("observer_site_subscriptions" as any).insert(subscriptionRow).select("*").single();
      if (saved.error || !saved.data) {
        console.error("[observer-package-assign]", saved.error);
        return fail("לא ניתן לשייך חבילה לאתר כרגע.", 500);
      }
      const siteUpdate = await supabase.from("observer_sites" as any).update({
        observer_package_id: payload.package_id,
        observer_subscription_status: payload.status,
        observer_trial_start: payload.trial_start,
        observer_trial_end: payload.trial_end,
        observer_renewal_date: payload.renewal_date,
        observer_package_override_limits: payload.override_limits
      }).eq("id", payload.observer_site_id);
      if (siteUpdate.error) {
        console.error("[observer-site-package-sync]", siteUpdate.error);
        return fail("המנוי נשמר, אבל עדכון אתר ה-Digital Observer נכשל.", 500);
      }
      await supabase.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: "admin",
        entity_type: "observer_site_subscriptions",
        entity_id: saved.data.id,
        action: "assign_observer_package",
        after_data: saved.data
      });
      return ok({ subscription: saved.data });
    }

    const now = new Date();
    const start = payload.period_start ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = payload.period_end ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const site = await supabase.from("observer_sites" as any).select("id, site_type, garden_id, observer_package_id").eq("id", payload.observer_site_id).single();
    if (site.error || !site.data) return fail("לא נמצא אתר Digital Observer לחישוב שימוש.", 404);
    const [cameras, events] = await Promise.all([
      countRows(supabase, "camera_streams", [["observer_site_id", "eq", payload.observer_site_id]]),
      countRows(supabase, "ai_camera_events", [["observer_site_id", "eq", payload.observer_site_id], ["created_at", "gte", start], ["created_at", "lte", end]])
    ]);
    const subscription = await supabase.from("observer_site_subscriptions" as any).select("id, package_id").eq("observer_site_id", payload.observer_site_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const usageRow = {
      observer_site_id: payload.observer_site_id,
      subscription_id: subscription.data?.id ?? null,
      period_start: start,
      period_end: end,
      active_cameras: cameras.count,
      ai_events_count: events.count,
      storage_used_mb: 0,
      monitoring_hours_used: 0,
      sms_alerts_sent: 0,
      whatsapp_alerts_sent: 0,
      playback_sessions: 0,
      limits_snapshot: { observer_package_id: subscription.data?.package_id ?? site.data.observer_package_id },
      metadata: { calculation_notes: { cameras: cameras.error, events: events.error } },
      updated_at: new Date().toISOString()
    };
    const savedUsage = await supabase.from("observer_site_usage_snapshots" as any).upsert(usageRow, { onConflict: "observer_site_id,period_start,period_end" }).select("*").single();
    if (savedUsage.error || !savedUsage.data) {
      console.error("[observer-usage-snapshot]", savedUsage.error);
      return fail("לא ניתן לחשב שימוש לאתר כרגע.", 500);
    }
    return ok({ usage: savedUsage.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
