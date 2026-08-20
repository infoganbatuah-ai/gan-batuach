import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createClient } from "@/lib/supabase/server";

const siteTypes = ["home", "office", "business", "warehouse", "store", "parking_lot", "custom"] as const;
const scheduleModes = ["24_7", "night_only", "business_hours", "custom_schedule", "event_only"] as const;

const schema = z.object({
  observer_site_id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  site_type: z.enum(siteTypes),
  address: z.string().trim().max(240).optional().default(""),
  camera_count: z.coerce.number().int().min(1).max(500).default(1),
  schedule_mode: z.enum(scheduleModes).default("event_only"),
  package_id: z.string().uuid().optional().nullable(),
  monitoring_targets: z.array(z.string().trim().min(2).max(80)).max(12).default([])
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const ownerType = payload.site_type === "home" ? "home_owner" : "business_owner";
    const sitePatch = {
      name: payload.name,
      site_type: payload.site_type,
      address: payload.address || null,
      timezone: "Asia/Jerusalem",
      active: true,
      monitoring_enabled: false,
      camera_limit: payload.camera_count,
      monitoring_hours: { mode: payload.schedule_mode },
      event_retention_days: 2,
      ai_features: { mode: "readiness", targets: payload.monitoring_targets, human_review_required: true },
      metadata: {
        product: "digital_observer",
        environment_mode: "demo_readiness",
        live_camera_disabled: true,
        live_ai_disabled: true,
        synthetic_data_only: true
      }
    };

    let site: any = null;
    if (payload.observer_site_id) {
      const allowedSite = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!allowedSite) return fail("אין הרשאה לעדכן את האתר הזה.", 403);
      const result = await supabase
        .from("observer_sites" as any)
        .update({ ...sitePatch, updated_at: new Date().toISOString() })
        .eq("id", payload.observer_site_id)
        .select("id,name,site_type,address,monitoring_enabled")
        .single();
      if (result.error) return fail("לא ניתן לשמור את פרטי האתר כרגע.", 400);
      site = result.data;
    } else {
      const result = await supabase
        .from("observer_sites" as any)
        .insert({ ...sitePatch, owner_profile_id: profile.id, garden_id: null })
        .select("id,name,site_type,address,monitoring_enabled")
        .single();
      if (result.error || !result.data) return fail("לא ניתן ליצור את האתר. יש לוודא שהמיגרציה החדשה הוחלה.", 400);
      site = result.data;
      await supabase.from("observer_site_memberships" as any).upsert({
        observer_site_id: site.id,
        profile_id: profile.id,
        member_role: "owner",
        active: true,
        accepted_at: new Date().toISOString(),
        metadata: { source: "digital_observer_self_service" }
      }, { onConflict: "observer_site_id,profile_id" });
    }

    const draftResult = await supabase
      .from("observer_site_onboarding_drafts" as any)
      .select("id")
      .eq("profile_id", profile.id)
      .in("status", ["draft", "submitted", "ready_for_review"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const draftPatch = {
      profile_id: profile.id,
      status: "activated",
      site_name: payload.name,
      site_type: payload.site_type,
      owner_type: ownerType,
      address: payload.address || null,
      timezone: "Asia/Jerusalem",
      monitoring_schedule: { mode: payload.schedule_mode },
      camera_count_estimate: payload.camera_count,
      desired_package_id: payload.package_id ?? null,
      activated_observer_site_id: site.id,
      submitted_at: new Date().toISOString(),
      metadata: { monitoring_targets: payload.monitoring_targets, safe_readiness_only: true },
      updated_at: new Date().toISOString()
    };
    if (draftResult.data?.id) {
      await supabase.from("observer_site_onboarding_drafts" as any).update(draftPatch).eq("id", draftResult.data.id);
    } else {
      await supabase.from("observer_site_onboarding_drafts" as any).insert(draftPatch);
    }

    await supabase.from("observer_monitoring_schedules" as any).upsert({
      observer_site_id: site.id,
      schedule_mode: payload.schedule_mode,
      timezone: "Asia/Jerusalem",
      status: "draft",
      schedule: { mode: payload.schedule_mode, readiness_only: true },
      updated_at: new Date().toISOString()
    }, { onConflict: "observer_site_id" });

    return ok({ site, next: `/digital-observer/cameras/add?site=${site.id}` }, payload.observer_site_id ? 200 : 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
