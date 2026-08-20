import { z } from "zod";
import { NextResponse } from "next/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { resolveObserverAddress } from "@/lib/domain/digital-observer/address-provider";

const siteTypes = ["home", "office", "business", "warehouse", "store", "parking_lot", "custom"] as const;
const scheduleModes = ["24_7", "night_only", "business_hours", "custom_schedule", "event_only"] as const;

const schema = z.object({
  observer_site_id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  site_type: z.enum(siteTypes),
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
  schedule_mode: z.enum(scheduleModes).default("event_only"),
  package_id: z.string().uuid().optional().nullable(),
  monitoring_targets: z.array(z.string().trim().min(2).max(80)).max(12).default([])
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
        name: String(formData.get("name") ?? ""),
        site_type: String(formData.get("site_type") ?? "home"),
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
    const privacyMode = payload.site_type !== "home" && payload.business_handles_children ? "skeleton_only" : "standard_consent";
    const resolvedAddress = payload.address_place_id
      ? await resolveObserverAddress(payload.address_place_id, payload.address_session_token || null)
      : null;
    if (payload.address_place_id && !resolvedAddress) return respondFail("הכתובת שנבחרה לא אומתה. יש לבחור אותה שוב מרשימת הכתובות.", 422);
    const floorNumber = payload.floor_kind === "ground" ? 0 : payload.floor_number === "" ? Number.NaN : Number(payload.floor_number);
    const normalizedFloorNumber = Number.isInteger(floorNumber) ? floorNumber : null;
    const baseAddress = resolvedAddress?.formattedAddress || `${payload.street} ${payload.building_number}, ${payload.city}`;
    const fullAddress = [baseAddress, payload.apartment_number ? `דירה ${payload.apartment_number}` : "", payload.floor_kind === "ground" ? "קומת קרקע" : normalizedFloorNumber == null ? "" : `קומה ${normalizedFloorNumber}`].filter(Boolean).join(", ");
    const sitePatch = {
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
      business_handles_children: payload.site_type !== "home" && payload.business_handles_children,
      vision_privacy_mode: privacyMode,
      timezone: "Asia/Jerusalem",
      active: true,
      monitoring_enabled: false,
      camera_limit: payload.camera_count,
      monitoring_hours: { mode: payload.schedule_mode },
      event_retention_days: 2,
      ai_features: { mode: "readiness", targets: payload.monitoring_targets, human_review_required: true, vision_privacy_mode: privacyMode, face_recognition_enabled: false },
      metadata: {
        product: "digital_observer",
        environment_mode: "demo_readiness",
        live_camera_disabled: true,
        live_ai_disabled: true,
        synthetic_data_only: true,
        address_ready_for_map: Boolean(resolvedAddress),
        emergency_dispatch_enabled: false,
        external_emergency_call_enabled: false,
        video_private_to_tenant: true
      }
    };

    let site: any = null;
    if (payload.observer_site_id) {
      const allowedSite = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!allowedSite) return respondFail("אין הרשאה לעדכן את האתר הזה.", 403);
      const result = await supabase
        .from("observer_sites" as any)
        .update({ ...sitePatch, updated_at: new Date().toISOString() })
        .eq("id", payload.observer_site_id)
        .select("id,name,site_type,address,monitoring_enabled")
        .single();
      if (result.error) return respondFail("לא ניתן לשמור את פרטי האתר כרגע.", 400);
      site = result.data;
    } else {
      const result = await supabase
        .from("observer_sites" as any)
        .insert({ ...sitePatch, owner_profile_id: profile.id, garden_id: null })
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

    const draftResult = await supabase
      .from("observer_site_onboarding_drafts" as any)
      .select("id")
      .eq("profile_id", profile.id)
      .in("status", ["draft", "submitted", "ready_for_review"])
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
      monitoring_schedule: { mode: payload.schedule_mode },
      camera_count_estimate: payload.camera_count,
      desired_package_id: payload.package_id ?? null,
      activated_observer_site_id: site.id,
      submitted_at: new Date().toISOString(),
      metadata: { monitoring_targets: payload.monitoring_targets, safe_readiness_only: true, address_verified: Boolean(resolvedAddress), vision_privacy_mode: privacyMode },
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
      schedule: { mode: payload.schedule_mode, readiness_only: true },
      updated_at: new Date().toISOString()
    }, { onConflict: "observer_site_id" });

    if (!payload.package_id) return respondFail("יש לבחור חבילה כדי להתחיל את תקופת הניסיון.", 400);
    const trialResult = await supabase.rpc("start_digital_observer_trial" as any, {
      requested_site_id: site.id,
      requested_package_id: payload.package_id,
      requested_billing_cycle: "monthly"
    });
    if (trialResult.error) return respondFail("האתר נשמר, אך לא ניתן היה להפעיל את תקופת הניסיון. נסו שוב או פנו לתמיכה.", 400);

    const next = `/digital-observer/cameras/add?site=${site.id}`;
    if (navigationSubmission) return NextResponse.redirect(new URL(next, request.url), 303);
    return ok({ site, trial: trialResult.data, charged: false, next }, payload.observer_site_id ? 200 : 201);
  } catch (error) {
    if (navigationSubmission) {
      console.error("Digital Observer onboarding form failed", error);
      return navigationFailure("לא ניתן להשלים את ההקמה. בדקו את הפרטים ונסו שוב.");
    }
    return handleRouteError(error);
  }
}
