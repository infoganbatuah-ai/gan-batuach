import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { calculateGanBatuachMonthlyPrice } from "@/lib/domain/kindergarten-onboarding";

const schema = z.object({
  kindergarten_name: z.string().trim().min(2),
  legal_entity_name: z.string().trim().optional(),
  business_id: z.string().trim().optional(),
  manager_full_name: z.string().trim().min(2),
  manager_id_number: z.string().trim().optional(),
  manager_phone: z.string().trim().optional(),
  manager_email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().min(2),
  street: z.string().trim().optional(),
  address_details: z.string().trim().optional(),
  public_description: z.string().trim().optional(),
  opening_hours: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(),
  contact_email: z.string().trim().email().optional().or(z.literal(""))
});

function clean(value?: string | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export async function POST(request: Request) {
  try {
    if (!isAdminClientConfigured()) return fail("יצירת בקשת גן עצמאית דורשת Service Role בצד השרת.", 503);
    const { profile } = await requireRole(["manager", "owner"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();

    if (profile.garden_id) {
      return ok({ garden_id: profile.garden_id, next_path: "/onboarding/kindergarten", already_exists: true });
    }

    const address = [payload.street, payload.address_details].map(clean).filter(Boolean).join(" ");
    const { data: garden, error: gardenError } = await admin.from("gardens" as any).insert({
      name: payload.kindergarten_name,
      city: payload.city,
      address: address || null,
      phone: clean(payload.contact_phone) ?? clean(payload.manager_phone),
      email: clean(payload.contact_email) ?? clean(payload.manager_email),
      manager_id: profile.id,
      owner_name: payload.manager_full_name,
      status: "pending",
      approval_flow_status: "activation_in_progress",
      final_approval_status: "activation_in_progress",
      onboarding_status: "activation_in_progress",
      activation_payment_status: "not_started",
      public_profile_enabled: false,
      eligible_for_safe_status: false,
      safe_status: "pending_review",
      public_description: clean(payload.public_description),
      admin_correction_note: null,
      ages: [],
      created_at: now,
      updated_at: now
    }).select("id, name").single();

    if (gardenError || !garden) return fail("לא ניתן ליצור טיוטת גן: " + (gardenError?.message ?? "שגיאה לא ידועה"), 400);

    const profileData = {
      name: payload.kindergarten_name,
      business_name: clean(payload.legal_entity_name),
      business_id: clean(payload.business_id),
      manager_name: payload.manager_full_name,
      manager_id_number_review_required: Boolean(clean(payload.manager_id_number)),
      manager_phone: clean(payload.manager_phone),
      manager_email: clean(payload.manager_email),
      city: payload.city,
      street: clean(payload.street),
      address_details: clean(payload.address_details),
      operating_hours: clean(payload.opening_hours),
      public_description: clean(payload.public_description),
      subscription_monthly_amount: calculateGanBatuachMonthlyPrice(1),
      registration_source: "manager_self_service"
    };

    const [profileWrite, selfServiceWrite, onboardingWrite] = await Promise.all([
      admin.from("profiles" as any).update({
        garden_id: garden.id,
        full_name: payload.manager_full_name,
        phone: clean(payload.manager_phone) ?? profile.phone ?? null,
        self_service_status: "pending_approval",
        updated_at: now
      }).eq("id", profile.id),
      admin.from("self_service_user_profiles" as any).upsert({
        profile_id: profile.id,
        requested_role: "kindergarten_manager",
        status: "pending_approval",
        full_name: payload.manager_full_name,
        phone: clean(payload.manager_phone) ?? profile.phone ?? null,
        email: clean(payload.manager_email) ?? (profile as any).email ?? null,
        city: payload.city,
        metadata: { garden_id: garden.id, application_stage: "draft_created" },
        updated_at: now
      }, { onConflict: "profile_id" }),
      admin.from("kindergarten_onboarding_records" as any).upsert({
        garden_id: garden.id,
        manager_id: profile.id,
        lifecycle_status: "activation_in_progress",
        progress_percent: 10,
        completed_steps: ["manager_profile"],
        missing_fields: ["logo", "profile_image", "age_group_pricing", "class_capacity_setup", "documents", "payment"],
        profile_data: profileData,
        activation_steps: ["manager_self_service_registration"],
        payment_status: "not_started",
        subscription_monthly_amount: calculateGanBatuachMonthlyPrice(1),
        started_at: now,
        updated_at: now
      }, { onConflict: "garden_id" })
    ]);

    const writeError = profileWrite.error ?? selfServiceWrite.error ?? onboardingWrite.error;
    if (writeError) return fail("הגן נוצר אך שמירת בקשת ההצטרפות נכשלה: " + writeError.message, 400);

    await Promise.all([
      admin.from("notifications" as any).insert({
        recipient_role: "admin",
        title: "בקשת גן חדשה",
        body: `${payload.kindergarten_name} נוצרה על ידי מנהלת שנרשמה עצמאית וממתינה להשלמת אשף.`,
        entity_type: "garden",
        entity_id: garden.id,
        severity: "medium",
        metadata: { href: "/dashboard/admin/kindergarten-applications", source: "manager_self_service" }
      }),
      admin.from("kindergarten_activation_events" as any).insert({
        garden_id: garden.id,
        actor_id: profile.id,
        event_type: "registration_submitted",
        status: "recorded",
        metadata: { source: "manager_self_service", active_access_granted: false }
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: profile.role,
        performed_by_user: profile.id,
        performed_by_role: profile.role,
        garden_id: garden.id,
        entity_type: "gardens",
        entity_id: garden.id,
        action: "manager_self_service_kindergarten_application_created",
        after_data: { garden_id: garden.id, status: "pending", approval_flow_status: "activation_in_progress" }
      })
    ]);

    revalidatePath("/onboarding/kindergarten");
    revalidatePath("/dashboard/admin/kindergarten-applications");
    return ok({ garden_id: garden.id, next_path: "/onboarding/kindergarten" }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
