import { z } from "zod";
import { NextResponse } from "next/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { resolveObserverAddress } from "@/lib/domain/digital-observer/address-provider";
import { getObserverSiteTemplate, observerSiteTemplateKeys } from "@/lib/domain/digital-observer/site-templates";

const siteTypes = ["home", "office", "business", "warehouse", "store", "parking_lot", "custom"] as const;
const scheduleModes = ["24_7", "night_only", "business_hours", "custom_schedule", "event_only"] as const;
const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const schema = z.object({
  observer_site_id: z.string().uuid().optional(),
  create_new_site: z.boolean().default(false),
  name: z.string().trim().min(2).max(100),
  site_type: z.enum(siteTypes),
  site_template: z.enum(observerSiteTemplateKeys).default("custom"),
  address_query: z.string().trim().max(240).optional().default(""),
  city: z.string().trim().min(2).max(100),
  street: z.string().trim().min(2).max(140),
  building_number: z.string().trim().min(1).max(20),
  apartment_number: z.string().trim().max(20).optional().default(""),
  floor_kind: z.enum(["ground", "floor"]).default("floor"),
  floor_number: z.union([z.string(), z.number()]).optional().default(""),
  postal_code: z.string().trim().max(20).optional().default(""),
  address_place_id: z.string().trim().max(300).optional().default(""),
  address_session_token: z.string().trim().max(100).optional().default(""),
  formatted_address: z.string().trim().max(300).optional().default(""),
  business_handles_children: z.boolean().default(false),
  vision_privacy_mode: z.enum(["standard_consent", "skeleton_only"]).default("standard_consent"),
  camera_count: z.coerce.number().int().min(1).max(500).default(1),
  branch_count: z.coerce.number().int().min(1).max(100).default(1),
  active_days: z.array(z.enum(weekdayKeys)).min(1).max(7).default(["sun", "mon", "tue", "wed", "thu"]),
  opening_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("08:00"),
  closing_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("18:00"),
  schedule_mode: z.enum(scheduleModes).default("event_only"),
  package_id: z.string().uuid().optional().nullable(),
  monitoring_targets: z.array(z.string().trim().min(2).max(80)).max(20).default([])
});

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const navigationSubmission = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  const navigationFailure = (message: string, type: string = "home") => {
    const url = new URL("/digital-observer/onboarding", request.url);
    url.searchParams.set("type", type === "business" ? "business" : "home");
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, 303);
  };

  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) {
      if (navigationSubmission) return NextResponse.redirect(new URL("/digital-observer/login?next=/digital-observer/onboarding", request.url), 303);
      return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    }
    const { profile, observerAccount, supabase } = session;
    const rawPayload = navigationSubmission
      ? await request.formData().then((formData) => ({
        observer_site_id: String(formData.get("observer_site_id") ?? "") || undefined,
        create_new_site: formData.get("create_new_site") === "true",
        name: String(formData.get("name") ?? ""),
        site_type: String(formData.get("site_type") ?? "home"),
        site_template: String(formData.get("site_template") ?? "custom"),
        address_query: String(formData.get("address_query") ?? ""),
        city: String(formData.get("city") ?? ""),
        street: String(formData.get("street") ?? ""),
        building_number: String(formData.get("building_number") ?? ""),
        apartment_number: String(formData.get("apartment_number") ?? ""),
        floor_kind: String(formData.get("floor_kind") ?? "floor"),
        floor_number: String(formData.get("floor_number") ?? ""),
        postal_code: String(formData.get("postal_code") ?? ""),
        address_place_id: String(formData.get("address_place_id") ?? ""),
        address_session_token: String(formData.get("address_session_token") ?? ""),
        formatted_address: String(formData.get("formatted_address") ?? ""),
        business_handles_children: formData.get("business_handles_children") === "true",
        vision_privacy_mode: String(formData.get("vision_privacy_mode") ?? "standard_consent"),
        camera_count: formData.get("camera_count") ?? 1,
        branch_count: formData.get("branch_count") ?? 1,
        active_days: formData.getAll("active_days").map(String),
        opening_time: String(formData.get("opening_time") ?? "08:00"),
        closing_time: String(formData.get("closing_time") ?? "18:00"),
        schedule_mode: String(formData.get("schedule_mode") ?? "event_only"),
        package_id: String(formData.get("package_id") ?? "") || null,
        monitoring_targets: formData.getAll("monitoring_targets").map(String)
      }))
      : await request.json();
    const payload = schema.parse(rawPayload);
    const respondFail = (message: string, status: number) => navigationSubmission ? navigationFailure(message, payload.site_type) : fail(message, status);
    if (!observerAccount) return respondFail("חשבון התצפיתן טרם הוכן. יש להתחבר מחדש ולנסות שוב.", 409);
    const ownerType = payload.site_type === "home" ? "home_owner" : "business_owner";
    if (payload.site_type === "home" && payload.business_handles_children) return respondFail("מצב עסק המטפל בילדים זמין רק בחשבון עסקי.", 422);
    const siteTemplate = getObserverSiteTemplate(payload.site_type === "home" ? "home" : payload.site_template);
    const businessHandlesChildren = payload.site_type !== "home" && (payload.business_handles_children || siteTemplate.childPrivacyRequired);
    const privacyMode = businessHandlesChildren ? "skeleton_only" : "standard_consent";
    const resolvedAddress = payload.address_place_id
      ? await resolveObserverAddress(payload.address_place_id, payload.address_session_token || null)
      : null;
    if (payload.address_place_id && !resolvedAddress) return respondFail("הכתובת שנבחרה לא אומתה. יש לבחור אותה שוב מרשימת הכתובות.", 422);
    const floorNumber = payload.floor_kind === "ground" ? 0 : payload.floor_number === "" ? Number.NaN : Number(payload.floor_number);
    const normalizedFloorNumber = Number.isInteger(floorNumber) ? floorNumber : null;
    const baseAddress = resolvedAddress?.formattedAddress || `${payload.street} ${payload.building_number}, ${payload.city}`;
    const fullAddress = [baseAddress, payload.apartment_number ? `דירה ${payload.apartment_number}` : "", payload.floor_kind === "ground" ? "קומת קרקע" : normalizedFloorNumber == null ? "" : `קומה ${normalizedFloorNumber}`].filter(Boolean).join(", ");
    const sharedSitePatch = {
      name: payload.name,
      site_type: payload.site_type,
      address: fullAddress,
      city: resolvedAddress?.city || payload.city,
      street: resolvedAddress?.street || payload.street,
      building_number: resolvedAddress?.buildingNumber || payload.building_number,
      apartment_number: payload.apartment_number || null,
      floor_kind: payload.floor_kind,
      floor_number: normalizedFloorNumber,
      postal_code: resolvedAddress?.postalCode || payload.postal_code || null,
      country_code: resolvedAddress?.countryCode || "IL",
      formatted_address: baseAddress,
      address_provider: resolvedAddress?.provider ?? null,
      address_place_id: resolvedAddress?.placeId ?? null,
      latitude: resolvedAddress?.latitude ?? null,
      longitude: resolvedAddress?.longitude ?? null,
      address_verification_status: resolvedAddress ? "verified" : "unverified",
      address_verified_at: resolvedAddress ? new Date().toISOString() : null,
      business_handles_children: businessHandlesChildren,
      vision_privacy_mode: privacyMode,
      timezone: "Asia/Jerusalem",
      active: true,
      camera_limit: payload.camera_count,
      monitoring_hours: { mode: payload.schedule_mode, active_days: payload.active_days, opening_time: payload.opening_time, closing_time: payload.closing_time },
    };
    const onboardingMetadata = {
        product: "digital_observer",
        site_template: siteTemplate.key,
        site_template_label: siteTemplate.label,
        branch_count: payload.site_type === "home" ? 1 : payload.branch_count,
        policy_template: siteTemplate.policy,
        address_ready_for_map: Boolean(resolvedAddress),
        video_private_to_tenant: true
    };

    let site: any = null;
    if (payload.observer_site_id) {
      const allowedSite = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!allowedSite) return respondFail("אין הרשאה לעדכן את האתר הזה.", 403);
      const existingMetadata = allowedSite.metadata && typeof allowedSite.metadata === "object" ? allowedSite.metadata : {};
      const result = await supabase
        .from("observer_sites" as any)
        // An edit must never reset a live site to readiness or replace consent/runtime metadata.
        .update({
          ...sharedSitePatch,
          monitoring_enabled: allowedSite.monitoring_enabled,
          event_retention_days: allowedSite.event_retention_days ?? 2,
          ai_features: allowedSite.ai_features ?? { mode: "readiness", targets: payload.monitoring_targets, site_template: siteTemplate.key, human_review_required: true, high_risk_events_are_suspicions: true, automatic_emergency_action: false, vision_privacy_mode: privacyMode, face_recognition_enabled: false },
          metadata: { ...existingMetadata, ...onboardingMetadata },
          updated_at: new Date().toISOString()
        })
        .eq("id", payload.observer_site_id)
        .select("id,name,site_type,address,monitoring_enabled")
        .single();
      if (result.error) return respondFail("לא ניתן לשמור את פרטי האתר כרגע.", 400);
      site = result.data;
    } else {
      if (!payload.create_new_site) return respondFail("יצירת אתר חדש דורשת בחירה ואישור מפורשים.", 422);
      const result = await supabase
        .from("observer_sites" as any)
        .insert({
          ...sharedSitePatch,
          owner_profile_id: profile.id,
          garden_id: null,
          monitoring_enabled: false,
          event_retention_days: 2,
          ai_features: { mode: "readiness", targets: payload.monitoring_targets, site_template: siteTemplate.key, human_review_required: true, high_risk_events_are_suspicions: true, automatic_emergency_action: false, vision_privacy_mode: privacyMode, face_recognition_enabled: false },
          metadata: {
            ...onboardingMetadata,
            environment_mode: "demo_readiness",
            live_camera_disabled: true,
            live_ai_disabled: true,
            synthetic_data_only: true,
            emergency_dispatch_enabled: false,
            external_emergency_call_enabled: false
          }
        })
        .select("id,name,site_type,address,monitoring_enabled")
        .single();
      if (result.error || !result.data) return respondFail("לא ניתן ליצור את האתר כרגע. נסו שוב או פנו לתמיכה.", 400);
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

    let draftQuery = supabase
      .from("observer_site_onboarding_drafts" as any)
      .select("id")
      .eq("profile_id", profile.id);
    if (payload.observer_site_id) draftQuery = draftQuery.eq("activated_observer_site_id", site.id);
    const draftResult = await draftQuery
      .in("status", ["draft", "submitted", "ready_for_review", "activated"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const existingDraft = draftResult.data as { id?: string } | null;
    const draftPatch = {
      profile_id: profile.id,
      status: "activated",
      site_name: payload.name,
      site_type: payload.site_type,
      owner_type: ownerType,
      address: fullAddress,
      timezone: "Asia/Jerusalem",
      monitoring_schedule: { mode: payload.schedule_mode, active_days: payload.active_days, opening_time: payload.opening_time, closing_time: payload.closing_time },
      camera_count_estimate: payload.camera_count,
      desired_package_id: payload.package_id ?? null,
      activated_observer_site_id: site.id,
      submitted_at: new Date().toISOString(),
      metadata: { monitoring_targets: payload.monitoring_targets, site_template: siteTemplate.key, branch_count: payload.site_type === "home" ? 1 : payload.branch_count, high_risk_events_are_suspicions: true, automatic_emergency_action: false, safe_readiness_only: true, address_verified: Boolean(resolvedAddress), vision_privacy_mode: privacyMode },
      updated_at: new Date().toISOString()
    };
    if (existingDraft?.id) {
      await supabase.from("observer_site_onboarding_drafts" as any).update(draftPatch).eq("id", existingDraft.id);
    } else {
      await supabase.from("observer_site_onboarding_drafts" as any).insert(draftPatch);
    }

    await supabase.from("observer_monitoring_schedules" as any).upsert({
      observer_site_id: site.id,
      schedule_mode: payload.schedule_mode,
      timezone: "Asia/Jerusalem",
      status: "draft",
      schedule: { mode: payload.schedule_mode, active_days: payload.active_days, opening_time: payload.opening_time, closing_time: payload.closing_time, readiness_only: true },
      updated_at: new Date().toISOString()
    }, { onConflict: "observer_site_id" });

    let trial: unknown = null;
    if (!payload.observer_site_id) {
      if (!payload.package_id) return respondFail("יש לבחור חבילה כדי להתחיל את תקופת הניסיון.", 400);
      const trialResult = await supabase.rpc("start_digital_observer_trial" as any, {
        requested_site_id: site.id,
        requested_package_id: payload.package_id,
        requested_billing_cycle: "monthly"
      });
      if (trialResult.error) return respondFail("האתר נשמר, אך לא ניתן היה להפעיל את תקופת הניסיון. נסו שוב או פנו לתמיכה.", 400);
      trial = trialResult.data;
    }

    const next = `/digital-observer/cameras/add?site=${site.id}`;
    if (navigationSubmission) return NextResponse.redirect(new URL(next, request.url), 303);
    return ok({ site, trial, charged: false, next }, payload.observer_site_id ? 200 : 201);
  } catch (error) {
    if (navigationSubmission) {
      console.error("Digital Observer onboarding form failed", error);
      return navigationFailure("לא ניתן להשלים את ההקמה. בדקו את הפרטים ונסו שוב.");
    }
    return handleRouteError(error);
  }
}
