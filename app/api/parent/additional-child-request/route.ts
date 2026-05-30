import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  child_name: z.string().min(2),
  child_age: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();

    const byProfile = await admin.from("parents" as any).select("*").eq("profile_id", profile.id).maybeSingle();
    const byUser = byProfile.data ? { data: null, error: null } : await admin.from("parents" as any).select("*").eq("user_id", profile.id).maybeSingle();
    const parent = (byProfile.data as any) ?? (byUser.data as any);
    if (byProfile.error || byUser.error) return fail("לא ניתן לטעון את פרטי ההורה כרגע", 400);
    if (!parent) return fail("לא נמצא כרטיס הורה למשתמש הזה", 404);

    const gardenId = profile.garden_id ?? parent.garden_id;
    if (!gardenId) return fail("ההורה עדיין לא משויך לגן ולכן לא ניתן לשלוח בקשת רישום", 422);

    const { data: lead, error } = await admin.from("leads" as any).insert({
      garden_id: gardenId,
      lead_type: "parent",
      parent_name: parent.full_name ?? profile.full_name ?? "הורה",
      phone: parent.phone ?? (profile as any).phone ?? "לא צוין",
      email: parent.email ?? (profile as any).email ?? null,
      child_name: payload.child_name,
      child_age: payload.child_age ?? null,
      notes: payload.notes ?? null,
      status: "new",
      source: "parent_dashboard_add_child",
      assigned_to: profile.id,
      missing_details: ["manager_approval_required"]
    }).select("id").single();

    if (error) return fail("שמירת בקשת הרישום נכשלה: " + error.message, 400);

    const { data: garden } = await admin.from("gardens" as any).select("manager_id, owner_profile_id, name").eq("id", gardenId).maybeSingle();
    const recipients = Array.from(new Set([garden?.manager_id, garden?.owner_profile_id].filter(Boolean)));
    if (recipients.length) {
      await admin.from("notifications" as any).insert(recipients.map((recipientId) => ({
        garden_id: gardenId,
        recipient_id: recipientId,
        recipient_role: "manager",
        title: "בקשת רישום לילד נוסף",
        body: `${parent.full_name ?? "הורה"} ביקש/ה לרשום את ${payload.child_name}.`,
        entity_type: "leads",
        entity_id: lead.id,
        severity: "medium",
        metadata: { href: "/dashboard/garden/leads", lead_id: lead.id, child_name: payload.child_name, source: "parent_dashboard_add_child" }
      })));
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "parent",
      gardenId,
      entityType: "leads",
      entityId: lead.id as string,
      action: "request_additional_child_registration",
      afterData: { child_name: payload.child_name, child_age: payload.child_age ?? null }
    });

    return ok({ lead_id: lead.id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
