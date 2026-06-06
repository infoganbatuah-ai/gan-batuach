import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  submit: z.boolean().optional(),
  garden: z.object({
    name: z.string().trim().min(2).optional(),
    logo_url: z.string().trim().optional(),
    image_url: z.string().trim().optional(),
    gallery_urls: z.array(z.string()).optional(),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().optional(),
    owner_name: z.string().trim().optional(),
    manager_name: z.string().trim().optional(),
    manager_phone: z.string().trim().optional(),
    business_id: z.string().trim().optional(),
    business_name: z.string().trim().optional(),
    operating_hours: z.string().trim().optional(),
    subscription_plan: z.string().trim().optional(),
    documents_summary: z.string().trim().optional(),
    camera_readiness: z.string().trim().optional(),
    public_description: z.string().trim().optional()
  })
});

const requiredLabels: Record<string, string> = {
  kindergarten_name: "שם הגן",
  logo: "לוגו",
  profile_image: "תמונת גן",
  address: "כתובת",
  phone: "טלפון",
  contact_details: "פרטי קשר",
  business_information: "פרטי עסק",
  operating_hours: "שעות פעילות",
  subscription_details: "מסלול תשלום",
  documents: "מסמכים",
  camera_readiness: "מצלמות"
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function calculateProgress(data: Record<string, unknown>) {
  const checks: Record<string, boolean> = {
    kindergarten_name: hasText(data.name),
    logo: hasText(data.logo_url),
    profile_image: hasText(data.image_url),
    address: hasText(data.address),
    phone: hasText(data.phone),
    contact_details: hasText(data.email) || hasText(data.manager_phone),
    business_information: hasText(data.business_id) || hasText(data.business_name) || hasText(data.owner_name),
    operating_hours: hasText(data.operating_hours),
    subscription_details: hasText(data.subscription_plan),
    documents: hasText(data.documents_summary),
    camera_readiness: hasText(data.camera_readiness)
  };
  const completedSteps = Object.entries(checks).filter(([, done]) => done).map(([key]) => key);
  const missingFields = Object.entries(checks).filter(([, done]) => !done).map(([key]) => key);
  return {
    completedSteps,
    missingFields,
    missingLabels: missingFields.map((key) => requiredLabels[key] ?? key),
    progressPercent: Math.round((completedSteps.length / Object.keys(checks).length) * 100)
  };
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("לא נמצא גן משויך", 422);
    const payload = onboardingSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const now = new Date().toISOString();

    const { data: existingGarden } = await supabase
      .from("gardens" as any)
      .select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, approval_flow_status, admin_correction_note")
      .eq("id", profile.garden_id)
      .maybeSingle();
    const currentStatus = String(existingGarden?.approval_flow_status ?? "");
    if (["pending_final_approval", "onboarding_submitted", "active", "suspended", "archived"].includes(currentStatus)) {
      return fail("הפרופיל כבר נשלח ואי אפשר לערוך אותו כרגע", 409);
    }

    const profileData = {
      ...(payload.garden as Record<string, unknown>),
      manager_name: payload.garden.manager_name || profile.full_name || null
    };
    const merged = { ...(existingGarden ?? {}), ...profileData };
    const progress = calculateProgress(merged);
    if (payload.submit && progress.missingFields.length > 0) {
      return fail(`חסרים פרטים: ${progress.missingLabels.join(", ")}`, 422);
    }

    const lifecycleStatus = payload.submit ? "pending_final_approval" : "onboarding_in_progress";
    const gardenPatch = Object.fromEntries(Object.entries({
      name: payload.garden.name || existingGarden?.name,
      logo_url: payload.garden.logo_url || null,
      image_url: payload.garden.image_url || null,
      address: payload.garden.address || null,
      phone: payload.garden.phone || null,
      email: payload.garden.email || null,
      owner_name: payload.garden.owner_name || null,
      public_description: payload.garden.public_description || null,
      status: "pending",
      approval_flow_status: lifecycleStatus,
      final_approval_status: lifecycleStatus,
      onboarding_status: lifecycleStatus,
      approval_requested_at: payload.submit ? now : undefined,
      profile_submitted_at: payload.submit ? now : undefined,
      onboarding_completed_at: payload.submit ? now : undefined,
      admin_correction_note: payload.submit ? null : existingGarden?.admin_correction_note ?? null,
      updated_at: now
    }).filter(([, value]) => value !== undefined));

    const { data: garden, error: gardenError } = await supabase
      .from("gardens" as any)
      .update(gardenPatch)
      .eq("id", profile.garden_id)
      .select("id, name, approval_flow_status")
      .single();
    if (gardenError) return fail("לא ניתן לשמור את פרופיל הגן", 400);

    const { data: onboarding, error: onboardingError } = await supabase
      .from("kindergarten_onboarding_records" as any)
      .upsert({
        garden_id: profile.garden_id,
        manager_id: profile.id,
        lifecycle_status: lifecycleStatus,
        progress_percent: progress.progressPercent,
        completed_steps: progress.completedSteps,
        missing_fields: progress.missingFields,
        profile_data: profileData,
        correction_note: payload.submit ? null : existingGarden?.admin_correction_note ?? null,
        started_at: now,
        submitted_at: payload.submit ? now : undefined,
        updated_at: now
      }, { onConflict: "garden_id" })
      .select("*")
      .single();
    if (onboardingError) return fail("לא ניתן לשמור את תהליך הקליטה", 400);

    if (payload.submit) {
      await supabase.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_role: "admin",
        title: "גן ממתין לאישור",
        body: `${garden?.name ?? "גן"} השלים פרופיל וממתין לבדיקה.`,
        entity_type: "garden",
        entity_id: profile.garden_id,
        severity: "medium",
        metadata: { href: "/dashboard/admin/leads", lifecycle_status: lifecycleStatus }
      });
    }

    revalidatePath("/onboarding/kindergarten");
    revalidatePath("/dashboard/admin/leads");
    revalidatePath("/dashboard/garden");
    return ok({ garden, onboarding, missing: progress.missingLabels });
  } catch (error) {
    return handleRouteError(error);
  }
}
