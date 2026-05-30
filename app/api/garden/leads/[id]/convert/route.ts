import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { normalizeOptionalEmail, provisionAuthUser, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  parent_name: z.string().min(2),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  child_name: z.string().optional(),
  child_age: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש", 422);
    if (!isAdminClientConfigured()) return fail("המרת ליד דורשת SUPABASE_SERVICE_ROLE_KEY בשרת.", 503);

    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();

    const { data: lead, error: leadError } = await admin
      .from("leads" as any)
      .select("*")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .eq("lead_type", "parent")
      .maybeSingle();

    if (leadError || !lead) return fail("לא נמצא ליד הורה לגן הזה", 404);
    if (["active", "approved_pending_parent_completion"].includes(String(lead.status))) return fail("הליד כבר הומר או נמצא בתהליך", 409);

    const normalizedEmail = normalizeOptionalEmail(payload.email || lead.email);
    let parentUserId: string | null = null;
    let credentials = null as null | { username: string; email: string; temporary_password: string };

    if (normalizedEmail) {
      const { data: existingProfile } = await admin.from("profiles" as any).select("id, role, garden_id, email, username").or(`email.eq.${normalizedEmail},username.eq.${normalizedEmail}`).maybeSingle();
      if (existingProfile) {
        if (existingProfile.role !== "parent") return fail("המייל כבר קיים במערכת אך אינו שייך להורה.", 409, { field: "email" });
        parentUserId = existingProfile.id;
        await admin.from("profiles" as any).update({
          garden_id: existingProfile.garden_id ?? profile.garden_id,
          phone: payload.phone,
          full_name: payload.parent_name
        }).eq("id", parentUserId);
      }
    }

    if (!parentUserId) {
      const created = await provisionAuthUser({
        role: "parent",
        gardenId: profile.garden_id,
        fullName: payload.parent_name,
        email: normalizedEmail,
        phone: payload.phone,
        createdBy: profile.id,
        conflictField: "parent_email"
      });
      parentUserId = created.user.id;
      credentials = created.oneTimeCredentials;
    }

    let { data: parent } = await admin
      .from("parents" as any)
      .select("*")
      .eq("profile_id", parentUserId)
      .eq("garden_id", profile.garden_id)
      .maybeSingle();

    if (!parent) {
      const inserted = await admin.from("parents" as any).insert({
        profile_id: parentUserId,
        user_id: parentUserId,
        garden_id: profile.garden_id,
        full_name: payload.parent_name,
        phone: payload.phone,
        email: normalizedEmail ?? null,
        completed_profile: false,
        status: "invited"
      }).select("*").single();
      if (inserted.error) return fail("יצירת כרטיס הורה נכשלה: " + inserted.error.message, 400);
      parent = inserted.data;
    }

    await admin.from("parent_kindergarten_links" as any).upsert({
      parent_id: parent.id,
      parent_profile_id: parentUserId,
      garden_id: profile.garden_id,
      status: "active",
      source: "lead",
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
      notes: credentials ? "הורה חדש נוצר מהמרת ליד" : "משתמש הורה קיים - הגן נוסף לחשבון"
    }, { onConflict: "parent_profile_id,garden_id" });

    const childName = payload.child_name || lead.child_name || "ילד/ה להשלמת פרטים";
    const permanentFile = await admin.from("permanent_child_files" as any).insert({
      primary_parent_profile_id: parentUserId,
      primary_parent_id: parent.id,
      full_name: childName,
      important_notes: payload.notes || lead.notes || null
    }).select("*").single();
    if (permanentFile.error) return fail("יצירת תיק ילד קבוע נכשלה: " + permanentFile.error.message, 400);

    const childInsert = await admin.from("children" as any).insert({
      garden_id: profile.garden_id,
      permanent_child_file_id: permanentFile.data.id,
      primary_parent_id: parent.id,
      full_name: childName,
      temporary_name: childName,
      parent_completed: false,
      status: "pending_parent_completion",
      medical_notes: payload.notes || lead.notes || null
    }).select("*").single();
    if (childInsert.error) return fail("יצירת כרטיס ילד להשלמה נכשלה: " + childInsert.error.message, 400);

    const child = childInsert.data;
    await admin.from("child_kindergarten_enrollments" as any).insert({
      child_id: child.id,
      permanent_child_file_id: permanentFile.data.id,
      garden_id: profile.garden_id,
      status: "pending_parent_completion",
      classroom_name: payload.child_age || lead.child_age || null,
      notes: payload.notes || lead.notes || null
    });
    await admin.from("child_timeline_events" as any).insert({
      child_id: child.id,
      permanent_child_file_id: permanentFile.data.id,
      garden_id: profile.garden_id,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: "linked_to_kindergarten",
      title: "הילד שויך לגן",
      description: credentials ? "נוצר חשבון הורה חדש ונפתח תיק ילד קבוע." : "משתמש הורה קיים קושר לגן נוסף.",
      metadata: { lead_id: id, existing_parent_user: !credentials }
    });
    await admin.from("leads" as any).update({
      status: "approved_pending_parent_completion",
      converted_parent_id: parent.id,
      converted_child_id: child.id,
      converted_at: new Date().toISOString(),
      assigned_to: parentUserId,
      missing_details: ["child_profile", "health_details", "pickup_permissions", "declarations"]
    }).eq("id", id);

    await admin.from("notifications" as any).insert({
      garden_id: profile.garden_id,
      recipient_id: parentUserId,
      recipient_role: "parent",
      title: "השלמת פרטי ילד",
      body: "הגן אישר את בקשת ההצטרפות הראשונית. עכשיו יש להשלים את כרטיס הילד.",
      entity_type: "children",
      entity_id: child.id,
      severity: "medium",
      metadata: { href: `/parent-onboarding?childId=${child.id}`, lead_id: id, child_id: child.id }
    });

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "leads",
      entityId: id,
      action: "convert_parent_lead_to_parent_pending_child",
      afterData: { lead_id: id, parent_id: parent.id, parent_user_id: parentUserId, child_id: child.id, created_credentials: Boolean(credentials) }
    });

    return ok({ parent, child, credentials, existing_user: !credentials }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
