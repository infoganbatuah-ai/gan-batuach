import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profile_image_url: z.string().url().optional().or(z.literal("")),
  emergency_contact: z.string().optional(),
  notification_preferences: z.record(z.string(), z.unknown()).optional(),
  garden: z.object({
    name: z.string().min(2).optional(),
    logo_url: z.string().url().optional().or(z.literal("")),
    image_url: z.string().url().optional().or(z.literal("")),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    owner_name: z.string().optional(),
    public_description: z.string().optional(),
    ages: z.array(z.string()).optional(),
    public_profile_enabled: z.boolean().optional(),
    submit_for_final_approval: z.boolean().optional()
  }).optional()
});

const roleLabels: Record<string, string> = {
  admin: "אדמין",
  network_manager: "מנהל/ת רשת",
  inspector: "מפקח/ת",
  manager: "מנהלת גן",
  owner: "בעלות גן",
  staff: "צוות גן",
  parent: "הורה"
};

export async function GET() {
  try {
    const { user, profile } = await requireUser();
    const supabase = await createClient();
    const garden = profile.garden_id
      ? await supabase.from("gardens" as any).select("id,name").eq("id", profile.garden_id).maybeSingle()
      : { data: null };
    return ok({
      profile: {
        full_name: profile.full_name,
        phone: profile.phone,
        address: profile.address,
        email: profile.email ?? user.email ?? null,
        profile_image_url: profile.profile_image_url,
        role_label: roleLabels[String(profile.role)] ?? "חשבון גן בטוח",
        garden_name: (garden.data as any)?.name ?? null
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const profilePatch: Record<string, unknown> = {};
    for (const key of ["full_name", "phone", "address", "profile_image_url", "emergency_contact", "notification_preferences"] as const) {
      if (payload[key] !== undefined) profilePatch[key] = payload[key] === "" ? null : payload[key];
    }
    let updatedProfile = null;
    if (Object.keys(profilePatch).length) {
      const { data, error } = await supabase.from("profiles" as any).update(profilePatch).eq("id", profile.id).select("id, full_name, phone, address, profile_image_url, role").single();
      if (error) return fail("לא ניתן לשמור פרטי משתמש כרגע", 400);
      updatedProfile = data;
    }
    let updatedGarden = null;
    if (payload.garden && ["manager", "owner", "admin"].includes(profile.role)) {
      const gardenId = profile.garden_id;
      if (!gardenId) return fail("לא נמצא גן משויך לעדכון", 422);
      const gardenPatch: Record<string, unknown> = {};
      for (const key of ["name", "logo_url", "image_url", "address", "phone", "email", "owner_name", "public_description", "ages", "public_profile_enabled"] as const) {
        if (payload.garden[key] !== undefined) gardenPatch[key] = payload.garden[key] === "" ? null : payload.garden[key];
      }
      if (payload.garden.submit_for_final_approval) {
        gardenPatch.status = "active";
        gardenPatch.approval_flow_status = "active";
        gardenPatch.final_approval_status = "active";
        gardenPatch.onboarding_status = "active";
        gardenPatch.public_profile_enabled = true;
        gardenPatch.profile_submitted_at = new Date().toISOString();
        gardenPatch.onboarding_completed_at = new Date().toISOString();
      }
      if (Object.keys(gardenPatch).length) {
        const { data, error } = await supabase.from("gardens" as any).update(gardenPatch).eq("id", gardenId).select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, ages, approval_flow_status, final_approval_status").single();
        if (error) return fail("לא ניתן לשמור פרטי גן כרגע", 400);
        updatedGarden = data;
      }
    }
    if (profile.role === "parent" && Object.keys(profilePatch).length) {
      const parentPatch = Object.fromEntries(Object.entries({
        full_name: profilePatch.full_name,
        phone: profilePatch.phone,
        address: profilePatch.address,
        photo_url: profilePatch.profile_image_url,
        emergency_details: profilePatch.emergency_contact
      }).filter(([, value]) => value !== undefined));
      const { error } = await supabase.from("parents" as any).update(parentPatch).eq("profile_id", profile.id);
      if (error) console.error("[profile-settings-parent-photo-sync-failed]", { profile_id: profile.id, message: error.message });
    }
    if (profile.role === "staff" && Object.keys(profilePatch).length) {
      const staffPatch = Object.fromEntries(Object.entries({
        full_name: profilePatch.full_name,
        phone: profilePatch.phone,
        address: profilePatch.address,
        profile_photo_url: profilePatch.profile_image_url
      }).filter(([, value]) => value !== undefined));
      const { error } = await supabase.from("staff" as any).update(staffPatch).eq("profile_id", profile.id);
      if (error) console.error("[profile-settings-staff-photo-sync-failed]", { profile_id: profile.id, message: error.message });
    }
    if (profile.role === "inspector" && profilePatch.profile_image_url !== undefined) {
      const { error } = await supabase.from("inspectors" as any).update({ profile_photo_url: profilePatch.profile_image_url }).eq("id", profile.id);
      if (error) console.error("[profile-settings-inspector-photo-sync-failed]", { profile_id: profile.id, message: error.message });
    }
    await supabase.from("audit_logs" as any).insert({ actor_id: profile.id, actor_role: profile.role, garden_id: profile.garden_id, entity_type: "profiles", entity_id: profile.id, action: "update_profile_settings", after_data: { profilePatch, garden: payload.garden ? true : false } });
    return ok({ profile: updatedProfile, garden: updatedGarden });
  } catch (error) {
    return handleRouteError(error);
  }
}
