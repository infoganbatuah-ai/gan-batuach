import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { activationWizardSteps, calculateGanBatuachMonthlyPrice, calculateRequiredStaff, ganBatuachTrialDays, kindergartenAgeGroups, operationalDistrictForCity, requiredKindergartenDocumentCategories, validateClassCapacity } from "@/lib/domain/kindergarten-onboarding";

const onboardingSchema = z.object({
  submit: z.boolean().optional(),
  garden: z.object({
    name: z.string().trim().min(2).optional(),
    logo_url: z.string().trim().optional(),
    image_url: z.string().trim().optional(),
    gallery_urls: z.array(z.string()).optional(),
    city: z.string().trim().optional(),
    street: z.string().trim().optional(),
    operational_district: z.string().trim().optional(),
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
    selected_age_groups: z.array(z.string()).optional(),
    age_group_pricing: z.record(z.string(), z.object({
      monthly_price: z.coerce.number().min(0).optional(),
      annual_price: z.coerce.number().min(0).optional(),
      billing_day: z.coerce.number().min(1).max(28).optional(),
      billing_cycle: z.enum(["monthly", "annual"]).optional(),
      show_price_public: z.boolean().optional()
    })).optional(),
    class_capacity: z.record(z.string(), z.coerce.number().min(0)).optional(),
    staff_count: z.coerce.number().min(0).optional(),
    staff_initialized: z.boolean().optional(),
    children_initialized: z.boolean().optional(),
    parents_invited: z.boolean().optional(),
    vacation_calendar_ready: z.boolean().optional(),
    weekly_schedule_ready: z.boolean().optional(),
    manager_profile_completed: z.boolean().optional(),
    payment_status: z.enum(["not_started", "payment_pending", "paid"]).optional(),
    uploaded_document_categories: z.array(z.string()).optional(),
    documents_summary: z.string().trim().optional(),
    camera_readiness: z.string().trim().optional(),
    public_description: z.string().trim().optional(),
    registration_step: z.coerce.number().min(1).max(5).optional(),
    payment_method_preference: z.enum(["card", "apple_pay", "google_pay", "manual", "not_selected"]).optional()
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
  age_group_pricing: "מחירי קבוצות גיל",
  class_capacity_setup: "קיבולת כיתות",
  staff_setup: "הזמנת צוות",
  children_setup: "הוספת ילדים",
  parent_invitations: "הזמנת הורים",
  vacation_calendar: "לוח חופשות",
  weekly_schedule: "תוכנית שבועית",
  manager_profile: "פרופיל מנהלת",
  documents: "מסמכים",
  payment: "תשלום מנוי",
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
    age_group_pricing: Boolean(data.age_group_pricing && Object.keys(data.age_group_pricing as Record<string, unknown>).length),
    class_capacity_setup: Boolean(data.class_capacity && Object.keys(data.class_capacity as Record<string, unknown>).length),
    staff_setup: Boolean(data.staff_initialized) || Number(data.staff_count ?? 0) > 0,
    children_setup: Boolean(data.children_initialized),
    parent_invitations: Boolean(data.parents_invited),
    vacation_calendar: Boolean(data.vacation_calendar_ready),
    weekly_schedule: Boolean(data.weekly_schedule_ready),
    manager_profile: Boolean(data.manager_profile_completed) || hasText(data.manager_name),
    documents: hasText(data.documents_summary),
    payment: data.payment_status === "paid" || data.payment_status === "payment_pending",
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
    if (!profile.garden_id) return fail("לא נמצא גן משויך. יש לפתוח קודם בקשת גן.", 422);
    const payload = onboardingSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const now = new Date().toISOString();

    const { data: existingGarden } = await supabase
      .from("gardens" as any)
      .select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, approval_flow_status, admin_correction_note")
      .eq("id", profile.garden_id)
      .maybeSingle();
    const currentStatus = String(existingGarden?.approval_flow_status ?? "");
    if (["active", "suspended", "archived"].includes(currentStatus)) {
      return fail("הגן כבר פעיל או חסום לעריכה דרך אשף ההקמה", 409);
    }

    const profileData: Record<string, any> = {
      ...(payload.garden as Record<string, unknown>),
      manager_name: payload.garden.manager_name || profile.full_name || null
    };
    const merged = { ...(existingGarden ?? {}), ...profileData };
    const progress = calculateProgress(merged);
    const selectedAgeGroups: string[] = Array.isArray(profileData.selected_age_groups)
      ? profileData.selected_age_groups.map(String).filter((key) => kindergartenAgeGroups.some((group) => group.key === key))
      : [];
    if (payload.submit && selectedAgeGroups.length === 0) {
      return fail("יש לבחור לפחות קבוצת גיל אחת לפני תחילת תקופת הניסיון.", 422);
    }
    const classCapacity = (profileData.class_capacity ?? {}) as Record<string, number>;
    const capacityErrors = selectedAgeGroups
      .map((groupKey) => validateClassCapacity(String(groupKey), Number(classCapacity[String(groupKey)] ?? 0)))
      .filter((result) => !result.ok && !result.message.includes("לא מוכרת"));
    if (capacityErrors.length) return fail(capacityErrors.map((item) => item.message).join(" "), 422);
    const requiredStaff = selectedAgeGroups.reduce((sum, groupKey) => sum + calculateRequiredStaff(String(groupKey), Number(classCapacity[String(groupKey)] ?? 0)), 0);
    const currentStaff = Number(profileData.staff_count ?? 0);
    const missingStaff = Math.max(0, requiredStaff - currentStaff);
    const optionalDuringActivation = new Set(["payment", "staff_setup", "children_setup", "parent_invitations", "vacation_calendar", "weekly_schedule"]);
    const blockingMissing = progress.missingFields.filter((field) => !optionalDuringActivation.has(field));
    if (payload.submit && blockingMissing.length > 0) {
      return fail(`חסרים פרטים: ${blockingMissing.map((key) => requiredLabels[key] ?? key).join(", ")}`, 422);
    }

    const lifecycleStatus = payload.submit ? "active" : "activation_in_progress";
    const classCount = selectedAgeGroups.filter((groupKey) => Number(classCapacity[String(groupKey)] ?? 0) > 0).length || selectedAgeGroups.length;
    const subscriptionAmount = calculateGanBatuachMonthlyPrice(classCount);
    const gardenPatch = Object.fromEntries(Object.entries({
      name: payload.garden.name || existingGarden?.name,
      city: payload.garden.city || undefined,
      logo_url: payload.garden.logo_url || null,
      image_url: payload.garden.image_url || null,
      address: payload.garden.address || null,
      phone: payload.garden.phone || null,
      email: payload.garden.email || null,
      owner_name: payload.garden.owner_name || null,
      public_description: payload.garden.public_description || null,
      public_profile_enabled: payload.submit ? true : undefined,
      status: payload.submit ? "active" : "pending",
      approval_flow_status: lifecycleStatus,
      final_approval_status: lifecycleStatus,
      onboarding_status: lifecycleStatus,
      activation_progress_percent: payload.submit ? 100 : progress.progressPercent,
      activation_payment_status: payload.submit ? "payment_pending" : "not_started",
      approval_requested_at: undefined,
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
        progress_percent: payload.submit ? 100 : progress.progressPercent,
        completed_steps: progress.completedSteps,
        missing_fields: progress.missingFields,
        required_fields: activationWizardSteps as unknown as string[],
        profile_data: {
          ...profileData,
          operational_district: payload.garden.operational_district || operationalDistrictForCity(payload.garden.city),
          required_staff: requiredStaff,
          current_staff: currentStaff,
          missing_staff: missingStaff,
          subscription_monthly_amount: subscriptionAmount,
          required_document_categories: requiredKindergartenDocumentCategories
        },
        activation_steps: progress.completedSteps,
        payment_status: payload.submit ? "payment_pending" : "not_started",
        subscription_monthly_amount: subscriptionAmount,
        correction_note: payload.submit ? null : existingGarden?.admin_correction_note ?? null,
        started_at: now,
        submitted_at: payload.submit ? now : undefined,
        updated_at: now
      }, { onConflict: "garden_id" })
      .select("*")
      .single();
    if (onboardingError) return fail("לא ניתן לשמור את תהליך הקליטה", 400);

    const ageGroupRows = selectedAgeGroups.map((groupKey) => {
      const group = kindergartenAgeGroups.find((item) => item.key === groupKey);
      const childrenCount = Number(classCapacity[String(groupKey)] ?? 0);
      const pricing = ((profileData.age_group_pricing ?? {}) as Record<string, any>)[String(groupKey)] ?? {};
      return {
        garden_id: profile.garden_id,
        age_group: String(groupKey),
        children_count: childrenCount,
        max_children_per_class: group?.maxChildrenPerClass ?? 0,
        required_staff: calculateRequiredStaff(String(groupKey), childrenCount),
        current_staff: currentStaff,
        monthly_child_price: Number(pricing.monthly_price ?? 0),
        annual_child_price: Number(pricing.annual_price ?? 0),
        billing_day: Number(pricing.billing_day ?? 1),
        billing_cycle: pricing.billing_cycle === "annual" ? "annual" : "monthly",
        ratio_alert: missingStaff > 0 ? `חסרים ${missingStaff} אנשי צוות לפי יחס בסיסי` : null,
        updated_at: now
      };
    });
    if (ageGroupRows.length) {
      await supabase.from("kindergarten_age_group_setups" as any).upsert(ageGroupRows, { onConflict: "garden_id,age_group" });
      const feeGroupRows = selectedAgeGroups.map((groupKey) => {
        const group = kindergartenAgeGroups.find((item) => item.key === groupKey);
        const childrenCount = Number(classCapacity[String(groupKey)] ?? 0);
        const pricing = ((profileData.age_group_pricing ?? {}) as Record<string, any>)[String(groupKey)] ?? {};
        return {
          garden_id: profile.garden_id,
          group_name: group?.label ?? String(groupKey),
          age_range: group?.range ?? String(groupKey),
          monthly_fee: Number(pricing.monthly_price ?? 0),
          annual_fee: Number(pricing.annual_price ?? 0) || Number(pricing.monthly_price ?? 0) * 12,
          capacity: childrenCount || group?.maxChildrenPerClass || null,
          show_price_public: Boolean(pricing.show_price_public),
          active: childrenCount > 0 || Boolean(pricing.monthly_price),
          parent_billing_cycle: pricing.billing_cycle === "annual" ? "annual" : "monthly",
          updated_at: now
        };
      });
      await Promise.all(feeGroupRows.map(async (row) => {
        const existing = await supabase
          .from("kindergarten_fee_groups" as any)
          .select("id")
          .eq("garden_id", profile.garden_id)
          .eq("group_name", row.group_name)
          .maybeSingle();
        if (existing.data?.id) {
          return supabase.from("kindergarten_fee_groups" as any).update(row).eq("id", existing.data.id);
        }
        return supabase.from("kindergarten_fee_groups" as any).insert(row);
      }));
    }

    if (payload.submit) {
      const trialEnd = new Date(Date.now() + ganBatuachTrialDays * 86400000);
      const trialPatch = {
        status: "trial",
        trial_status: "active",
        plan_type: "annual",
        start_date: now.slice(0, 10),
        trial_started_at: now,
        trial_ends_at: trialEnd.toISOString(),
        expires_at: trialEnd.toISOString(),
        renewal_date: trialEnd.toISOString().slice(0, 10),
        provider: "manual",
        billing_status: "trial",
        payment_method: profileData.payment_method_preference && profileData.payment_method_preference !== "not_selected" ? profileData.payment_method_preference : null,
        billing_cycle: "annual",
        current_period_start: now.slice(0, 10),
        current_period_end: trialEnd.toISOString().slice(0, 10),
        trial_conversion_status: "trial_active",
        metadata: {
          monthly_amount_nis: subscriptionAmount,
          class_count: classCount,
          trial_days: ganBatuachTrialDays,
          charge_today_nis: 0,
          payment_mode: "manual_or_sandbox_until_provider_approval",
          digital_observer_included_in_gan_batuach: true,
          standalone_digital_observer_billing_separate: true
        },
        updated_by: profile.id,
        updated_at: now
      };
      const existingSubscription = await supabase.from("kindergarten_subscriptions" as any)
        .select("id,status")
        .eq("garden_id", profile.garden_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const subscriptionWrite = existingSubscription.data?.id
        ? await supabase.from("kindergarten_subscriptions" as any).update(trialPatch).eq("id", existingSubscription.data.id)
        : await supabase.from("kindergarten_subscriptions" as any).insert({ ...trialPatch, garden_id: profile.garden_id, created_by: profile.id });
      if (subscriptionWrite.error) return fail("פרטי הגן נשמרו, אך הפעלת 14 ימי הניסיון נכשלה: " + subscriptionWrite.error.message, 400);

      const [profileWrite, selfServiceWrite] = await Promise.all([
        supabase.from("profiles" as any).update({ active: true, self_service_status: "active", self_service_approved_at: now, self_service_approved_by: profile.id, updated_at: now }).eq("id", profile.id),
        supabase.from("self_service_user_profiles" as any).update({ status: "active", metadata: { garden_id: profile.garden_id, application_stage: "trial_active", trial_days: ganBatuachTrialDays }, updated_at: now }).eq("profile_id", profile.id)
      ]);
      const activationError = profileWrite.error ?? selfServiceWrite.error;
      if (activationError) return fail("תקופת הניסיון נוצרה, אך הפעלת חשבון המנהלת נכשלה: " + activationError.message, 400);
    }

    await supabase.from("kindergarten_activation_events" as any).insert({
      garden_id: profile.garden_id,
      actor_id: profile.id,
      event_type: payload.submit ? "activation_completed" : "children_initialized",
      status: "recorded",
      metadata: {
        lifecycle_status: lifecycleStatus,
        progress_percent: progress.progressPercent,
        required_staff: requiredStaff,
        missing_staff: missingStaff,
        subscription_monthly_amount: subscriptionAmount,
        trial_days: payload.submit ? ganBatuachTrialDays : null,
        charge_today_nis: 0,
        admin_approval_required: false
      }
    });

    if (payload.submit) {
      await supabase.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_role: "admin",
        title: "גן התחיל תקופת ניסיון",
        body: `${garden?.name ?? "גן"} השלים הקמה והתחיל ${ganBatuachTrialDays} ימי ניסיון ללא חיוב היום.`,
        entity_type: "garden",
        entity_id: profile.garden_id,
        severity: "medium",
        metadata: { href: "/dashboard/admin/subscriptions", lifecycle_status: lifecycleStatus, trial_days: ganBatuachTrialDays, informational_only: true }
      });
    }

    revalidatePath("/onboarding/kindergarten");
    revalidatePath("/dashboard/admin/leads");
    revalidatePath("/dashboard/garden");
    return ok({ garden, onboarding, missing: progress.missingLabels, next_path: payload.submit ? "/dashboard/garden" : "/onboarding/kindergarten" });
  } catch (error) {
    return handleRouteError(error);
  }
}
