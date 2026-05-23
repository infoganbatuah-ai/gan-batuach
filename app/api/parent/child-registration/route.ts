import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  full_name: z.string().min(2),
  birth_date: z.string().optional(),
  identity_number: z.string().optional(),
  hmo: z.string().optional(),
  allergies: z.string().optional(),
  sensitivities: z.string().optional(),
  regular_medications: z.string().optional(),
  medical_notes: z.string().optional(),
  address: z.string().optional(),
  mother_name: z.string().optional(),
  mother_identity_number: z.string().optional(),
  mother_phone: z.string().optional(),
  father_name: z.string().optional(),
  father_identity_number: z.string().optional(),
  father_phone: z.string().optional(),
  emergency_phone: z.string().optional(),
  pickup_authorized: z.array(z.object({ name: z.string().min(2), phone: z.string().optional(), relation: z.string().optional() })).default([]),
  photo_consent: z.boolean().default(false),
  system_consent: z.literal(true),
  camera_consent: z.boolean().default(false),
  privacy_consent: z.literal(true),
  health_declaration: z.literal(true)
}).refine((value) => Boolean(value.mother_identity_number || value.father_identity_number || value.identity_number), {
  message: "At least one parent ID or child ID is required",
  path: ["mother_identity_number"]
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    if (!profile.garden_id) return fail("Parent is not assigned to a garden", 422);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("garden_id", profile.garden_id)
      .single();

    if (parentError || !parent) return fail(parentError?.message ?? "Parent record not found", 404);

    const { data: child, error } = await supabase
      .from("children")
      .insert({
        garden_id: profile.garden_id,
        primary_parent_id: parent.id as string,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: payload.identity_number,
        hmo: payload.hmo,
        allergies: payload.allergies,
        sensitivities: payload.sensitivities,
        regular_medications: payload.regular_medications,
        medical_notes: payload.medical_notes,
        address: payload.address,
        mother_name: payload.mother_name,
        mother_identity_number: payload.mother_identity_number,
        mother_phone: payload.mother_phone,
        father_name: payload.father_name,
        father_identity_number: payload.father_identity_number,
        father_phone: payload.father_phone,
        emergency_phone: payload.emergency_phone,
        pickup_authorized: payload.pickup_authorized,
        photo_consent: payload.photo_consent,
        system_consent: payload.system_consent,
        additional_consents: {
          camera_viewing: payload.camera_consent,
          privacy: payload.privacy_consent,
          health_declaration: payload.health_declaration
        },
        status: "pending_manager_approval",
        parent_completed: true
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 400);
    await supabase.from("parents").update({ completed_profile: true, status: "child_registration_submitted" }).eq("id", parent.id as string);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "parent",
      gardenId: profile.garden_id,
      entityType: "children",
      entityId: child.id as string,
      action: "submit_child_registration",
      afterData: { child_id: child.id, parent_id: parent.id as string, status: "pending_manager_approval" }
    });

    return ok({ child }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
