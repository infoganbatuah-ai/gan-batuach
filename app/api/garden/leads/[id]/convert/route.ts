import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { normalizeOptionalEmail, provisionAuthUser, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { sendCommunication } from "@/lib/domain/communication-service";
import { preparePushForNotification } from "@/lib/domain/push-service";

const schema = z.object({
  parent_name: z.string().min(2),
  phone: z.string().min(7),
  identity_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  child_name: z.string().optional(),
  child_identity_number: z.string().optional(),
  child_age: z.string().optional(),
  requested_age_group: z.string().optional(),
  address: z.string().optional(),
  requested_start_date: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actionContext: Record<string, unknown> = { action: "convert_parent_lead_to_parent_pending_child" };
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש", 422);
    if (!isAdminClientConfigured()) return fail("המרת ליד דורשת SUPABASE_SERVICE_ROLE_KEY בשרת.", 503);

    const { id } = await context.params;
    actionContext = { ...actionContext, entity_id: id, user_id: profile.id, user_role: profile.role, garden_id: profile.garden_id };
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();

    const { data: lead, error: leadError } = await admin
      .from("leads" as any)
      .select("*")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .eq("lead_type", "parent")
      .maybeSingle();

    if (leadError || !lead) {
      console.error("[garden-lead-convert] lead lookup failed", { ...actionContext, error: leadError?.message });
      return fail("לא נמצא ליד הורה לגן הזה", 404);
    }
    if (["active", "converted", "parent_approved_pending_child_completion", "approved_pending_parent_completion"].includes(String(lead.status))) return fail("הליד כבר הומר או נמצא בתהליך", 409);
    actionContext = { ...actionContext, previous_status: lead.status };

    const normalizedEmail = normalizeOptionalEmail(payload.email || lead.email);
    const parentIdentityNumber = String(payload.identity_number || lead.parent_identity_number || "").replace(/\D/g, "");
    const childIdentityNumber = String(payload.child_identity_number || lead.child_identity_number || "").replace(/\D/g, "");
    if (childIdentityNumber) {
      const [existingChild, existingFile] = await Promise.all([
        admin.from("children" as any).select("id", { count: "exact", head: true }).eq("identity_number", childIdentityNumber),
        admin.from("permanent_child_files" as any).select("id", { count: "exact", head: true }).eq("identity_number", childIdentityNumber)
      ]);
      if ((existingChild.count ?? 0) + (existingFile.count ?? 0) > 0) return fail("ילד עם תעודת זהות זו כבר קיים במערכת. יש להתחבר לחשבון ההורה הקיים ולהגיש בקשת שיוך/מעבר לגן.", 409, { field: "child_identity_number" });
    }
    let parentUserId: string | null = null;
    let credentials = null as null | { username: string; email: string; temporary_password: string };

    if (normalizedEmail) {
      const { data: existingProfile } = await admin.from("profiles" as any).select("id, role, garden_id, email, username").or(`email.eq.${normalizedEmail},username.eq.${normalizedEmail}`).maybeSingle();
      if (existingProfile) {
        if (existingProfile.role !== "parent") return fail("המייל כבר קיים במערכת אך אינו שייך להורה.", 409, { field: "email" });
        parentUserId = existingProfile.id;
        const profileUpdate = await admin.from("profiles" as any).update({
          garden_id: existingProfile.garden_id ?? profile.garden_id,
          phone: payload.phone,
          full_name: payload.parent_name,
          identity_number: parentIdentityNumber || null
        }).eq("id", parentUserId);
        if (profileUpdate.error) {
          console.error("[garden-lead-convert] existing parent profile update failed", { ...actionContext, parent_user_id: parentUserId, error: profileUpdate.error.message });
          return fail("ההורה קיים, אך עדכון הפרטים שלו נכשל.", 500);
        }
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

    if (parentIdentityNumber) {
      const identitySync = await admin.from("profiles" as any).update({ identity_number: parentIdentityNumber }).eq("id", parentUserId);
      if (identitySync.error) console.error("[garden-lead-convert] parent identity sync failed", { ...actionContext, parent_user_id: parentUserId, error: identitySync.error.message });
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
        address: payload.address || lead.address || null,
        identity_number: parentIdentityNumber || null,
        completed_profile: false,
        status: "active"
      }).select("*").single();
      if (inserted.error) {
        console.error("[garden-lead-convert] parent row insert failed", { ...actionContext, parent_user_id: parentUserId, error: inserted.error.message });
        return fail("יצירת כרטיס הורה נכשלה: " + inserted.error.message, 400);
      }
      parent = inserted.data;
    } else if (parent.status !== "active" || parent.completed_profile === false) {
      const updatedParent = await admin.from("parents" as any).update({
        status: "active",
        phone: payload.phone,
        full_name: payload.parent_name,
        identity_number: parentIdentityNumber || parent.identity_number || null,
        address: payload.address || lead.address || parent.address || null
      }).eq("id", parent.id).select("*").single();
      if (!updatedParent.error && updatedParent.data) parent = updatedParent.data;
    }

    const linkResult = await admin.from("parent_kindergarten_links" as any).upsert({
      parent_id: parent.id,
      parent_profile_id: parentUserId,
      garden_id: profile.garden_id,
      status: "active",
      source: "lead",
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
      notes: credentials ? "הורה חדש נוצר מהמרת ליד" : "משתמש הורה קיים - הגן נוסף לחשבון"
    }, { onConflict: "parent_profile_id,garden_id" });
    if (linkResult.error) {
      console.error("[garden-lead-convert] parent kindergarten link failed", { ...actionContext, parent_id: parent.id, parent_user_id: parentUserId, error: linkResult.error.message });
      return fail("ההורה נוצר, אך חסר שיוך לגן.", 500);
    }

    const childName = payload.child_name || lead.child_name || "ילד/ה להשלמת פרטים";
    const requestedAgeGroup = payload.requested_age_group || lead.requested_age_group || null;
    const requestedStartDate = payload.requested_start_date || lead.requested_start_date || null;
    const parentAddress = payload.address || lead.address || null;
    const permanentFile = await admin.from("permanent_child_files" as any).insert({
      primary_parent_profile_id: parentUserId,
      primary_parent_id: parent.id,
      full_name: childName,
      identity_number: childIdentityNumber || null,
      important_notes: payload.notes || lead.notes || null
    }).select("*").single();
    if (permanentFile.error) {
      console.error("[garden-lead-convert] permanent child file insert failed", { ...actionContext, parent_id: parent.id, error: permanentFile.error.message });
      return fail("יצירת תיק ילד קבוע נכשלה: " + permanentFile.error.message, 400);
    }

    const childInsert = await admin.from("children" as any).insert({
      garden_id: profile.garden_id,
      permanent_child_file_id: permanentFile.data.id,
      primary_parent_id: parent.id,
      full_name: childName,
      identity_number: childIdentityNumber || null,
      temporary_name: childName,
      child_age: payload.child_age || lead.child_age || null,
      age_group: requestedAgeGroup,
      classroom: requestedAgeGroup,
      requested_age_group: requestedAgeGroup,
      requested_start_date: requestedStartDate,
      address: parentAddress,
      lead_parent_name: payload.parent_name,
      lead_parent_phone: payload.phone,
      parent_completed: false,
      status: "pending_parent_completion",
      medical_notes: payload.notes || lead.notes || null
    }).select("*").single();
    if (childInsert.error) {
      console.error("[garden-lead-convert] pending child insert failed", { ...actionContext, parent_id: parent.id, permanent_child_file_id: permanentFile.data.id, error: childInsert.error.message });
      return fail("יצירת כרטיס ילד להשלמה נכשלה: " + childInsert.error.message, 400);
    }

    const child = childInsert.data;
    const enrollmentResult = await admin.from("child_kindergarten_enrollments" as any).insert({
      child_id: child.id,
      permanent_child_file_id: permanentFile.data.id,
      garden_id: profile.garden_id,
      status: "pending_parent_completion",
      classroom_name: requestedAgeGroup,
      start_date: requestedStartDate,
      notes: payload.notes || lead.notes || null
    });
    if (enrollmentResult.error) {
      console.error("[garden-lead-convert] child enrollment insert failed", { ...actionContext, parent_id: parent.id, child_id: child.id, error: enrollmentResult.error.message });
      return fail("ההורה והילד נוצרו, אך לא נוצר שיוך ילד לגן.", 500);
    }
    const timelineResult = await admin.from("child_timeline_events" as any).insert({
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
    if (timelineResult.error) {
      console.error("[garden-lead-convert] child timeline insert failed", { ...actionContext, child_id: child.id, error: timelineResult.error.message });
    }
    const nextLeadStatus = "parent_approved_pending_child_completion";
    const leadUpdate = await admin.from("leads" as any).update({
      status: nextLeadStatus,
      converted_parent_id: parent.id,
      converted_child_id: child.id,
      converted_at: new Date().toISOString(),
      assigned_to: parentUserId,
      missing_details: ["child_profile", "health_details", "pickup_permissions", "declarations"]
    }).eq("id", id).select("id, status, converted_parent_id, converted_child_id, converted_at").maybeSingle();
    if (leadUpdate.error || !leadUpdate.data) {
      console.error("[garden-lead-convert] lead status update failed", { ...actionContext, parent_id: parent.id, child_id: child.id, new_status: nextLeadStatus, error: leadUpdate.error?.message });
      return fail("ההורה נוצר, אך סטטוס הליד לא עודכן. יש לבדוק את הרשומה לפני ניסיון נוסף.", 500);
    }

    const notificationResult = await admin.from("notifications" as any).insert({
      garden_id: profile.garden_id,
      recipient_id: parentUserId,
      recipient_role: "parent",
      title: "השלמת פרטי ילד",
      body: "הגן אישר את בקשת ההצטרפות הראשונית. עכשיו יש להשלים את כרטיס הילד.",
      message: "הגן אישר את בקשת ההצטרפות הראשונית. עכשיו יש להשלים את כרטיס הילד.",
      entity_type: "children",
      entity_id: child.id,
      severity: "medium",
      action_url: `/parent-onboarding?childId=${child.id}`,
      recipient_profile_id: parentUserId,
      kindergarten_id: profile.garden_id,
      child_id: child.id,
      created_by: profile.id,
      metadata: { href: `/parent-onboarding?childId=${child.id}`, lead_id: id, child_id: child.id }
    }).select("id").maybeSingle();
    if (notificationResult.error) {
      console.error("[garden-lead-convert] notification insert failed", { ...actionContext, parent_id: parent.id, child_id: child.id, error: notificationResult.error.message });
    } else if (notificationResult.data?.id) {
      const pushResult = await preparePushForNotification(admin as any, {
        profileId: parentUserId,
        notificationId: notificationResult.data.id,
        title: "השלמת פרטי ילד",
        body: "הגן אישר את בקשת ההצטרפות הראשונית. עכשיו יש להשלים את כרטיס הילד.",
        actionUrl: `/parent-onboarding?childId=${child.id}`,
        critical: true,
        metadata: { lead_id: id, child_id: child.id, source: "lead_conversion" }
      });
      if (!pushResult.ok) console.error("[garden-lead-convert] push log failed", { ...actionContext, parent_profile_id: parentUserId, error: pushResult.error });
    }

    const communicationResult = await sendCommunication(admin as any, {
      recipientProfileId: parentUserId,
      kindergartenId: profile.garden_id,
      templateKey: "parent_approved",
      channels: ["whatsapp", "sms", "email"],
      variables: { parentName: payload.parent_name, childName },
      dedupeKey: `parent-approved:${id}:${parentUserId}`,
      metadata: { lead_id: id, child_id: child.id, source: "lead_conversion" }
    });
    if (!communicationResult.ok) {
      console.error("[garden-lead-convert] communication log failed", { ...actionContext, parent_profile_id: parentUserId, logs: communicationResult.logs });
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "leads",
      entityId: id,
      action: "convert_parent_lead_to_parent_pending_child",
      afterData: { lead_id: id, parent_id: parent.id, parent_user_id: parentUserId, child_id: child.id, created_credentials: Boolean(credentials) }
    });
    console.info("[garden-lead-convert] completed", { ...actionContext, parent_id: parent.id, child_id: child.id, new_status: nextLeadStatus });

    return ok({ parent, child, credentials, existing_user: !credentials, lead_status: leadUpdate.data.status, lead_id: id }, 201);
  } catch (error) {
    console.error("[garden-lead-convert] unhandled failure", { ...actionContext, error });
    return handleRouteError(error);
  }
}
