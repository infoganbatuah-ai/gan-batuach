import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { sendCommunication } from "@/lib/domain/communication-service";
import { preparePushForNotification } from "@/lib/domain/push-service";

const schema = z.object({ status: z.enum(["active", "rejected", "missing_info", "request_missing_details", "pending_manager_approval"]), reason: z.string().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actionContext: Record<string, unknown> = { action: "child_registration_status_update" };
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    if (!isAdminClientConfigured()) return fail("אישור ילד דורש הגדרת SUPABASE_SERVICE_ROLE_KEY בשרת.", 503);
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    actionContext = { ...actionContext, entity_id: id, user_id: profile.id, user_role: profile.role, garden_id: profile.garden_id, new_status: payload.status };
    const supabase = createAdminClient();
    const patch: Record<string, unknown> = { status: payload.status };
    if (payload.status === "active") patch.manager_approved_at = new Date().toISOString();
    if (payload.reason) patch.approval_notes = payload.reason;
    const { data: child, error } = await supabase.from("children" as any).update(patch).eq("id", id).eq("garden_id", profile.garden_id).select("*").single();
    if (error) {
      console.error("[child-status-update] child update failed", { ...actionContext, error: error.message });
      return fail(error.message, 400);
    }
    const enrollmentUpdate = await supabase.from("child_kindergarten_enrollments" as any).update({
      status: payload.status === "active" ? "active" : payload.status === "rejected" ? "rejected" : payload.status,
      manager_approved_at: payload.status === "active" ? new Date().toISOString() : null,
      manager_approved_by: payload.status === "active" ? profile.id : null,
      rejection_reason: payload.status === "rejected" ? payload.reason ?? null : null,
      notes: payload.reason ?? null
    }).eq("child_id", id).eq("garden_id", profile.garden_id);
    if (enrollmentUpdate.error) {
      console.error("[child-status-update] enrollment update failed", { ...actionContext, error: enrollmentUpdate.error.message });
      return fail("סטטוס הילד עודכן, אך שיוך הילד לגן לא עודכן. יש לבדוק לפני המשך.", 500);
    }
    await supabase.from("child_timeline_events" as any).insert({
      child_id: id,
      permanent_child_file_id: child.permanent_child_file_id ?? null,
      garden_id: profile.garden_id,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: `manager_${payload.status}`,
      title: payload.status === "active" ? "הגן אישר את הילד" : payload.status === "rejected" ? "הגן דחה את הבקשה" : "הגן ביקש השלמת פרטים",
      description: payload.reason ?? null,
      metadata: { status: payload.status }
    });
    await writeUserCreationAudit({ actorId: profile.id, actorRole: profile.role, gardenId: profile.garden_id, entityType: "children", entityId: id, action: `child_registration_${payload.status}`, afterData: { child_id: id, status: payload.status, reason: payload.reason ?? null } });
    if (child.primary_parent_id) {
      const { data: parent } = await supabase.from("parents" as any).select("profile_id").eq("id", child.primary_parent_id).maybeSingle();
      if (parent?.profile_id) {
        const body = payload.status === "active" ? "כרטיס הילד אושר על ידי הגן" : payload.status === "rejected" ? payload.reason ?? "בקשת רישום הילד נדחתה" : payload.reason ?? "הגן ביקש השלמת פרטים";
        const notificationResult = await supabase.from("notifications" as any).insert({ garden_id: profile.garden_id, kindergarten_id: profile.garden_id, recipient_id: parent.profile_id, recipient_profile_id: parent.profile_id, recipient_role: "parent", title: "עדכון רישום ילד", body, message: body, entity_type: "children", entity_id: id, child_id: id, severity: payload.status === "active" ? "low" : "medium", action_url: payload.status === "active" ? "/dashboard/parent" : `/parent-onboarding?childId=${id}`, created_by: profile.id, metadata: { href: payload.status === "active" ? "/dashboard/parent" : `/parent-onboarding?childId=${id}`, child_id: id, status: payload.status } }).select("id").maybeSingle();
        if (notificationResult.error) {
          console.error("[child-status-update] parent notification failed", { ...actionContext, parent_profile_id: parent.profile_id, error: notificationResult.error.message });
          return fail("סטטוס הילד עודכן, אך ההתראה להורה לא נשלחה. יש לעדכן את ההורה ידנית או לנסות שוב.", 409, { child_id: id, status: payload.status });
        }
        if (notificationResult.data?.id) {
          const pushResult = await preparePushForNotification(supabase as any, {
            profileId: parent.profile_id,
            notificationId: notificationResult.data.id,
            title: "עדכון רישום ילד",
            body,
            actionUrl: payload.status === "active" ? "/dashboard/parent" : `/parent-onboarding?childId=${id}`,
            critical: payload.status === "active",
            metadata: { child_id: id, status: payload.status, source: "child_status_update" }
          });
          if (!pushResult.ok) console.error("[child-status-update] push log failed", { ...actionContext, parent_profile_id: parent.profile_id, error: pushResult.error });
        }
        if (payload.status === "active" || payload.status === "rejected") {
          const communicationResult = await sendCommunication(supabase as any, {
            recipientProfileId: parent.profile_id,
            kindergartenId: profile.garden_id,
            templateKey: payload.status === "active" ? "child_approved" : "child_rejected",
            channels: ["whatsapp", "sms", "email"],
            variables: { childName: child.full_name },
            dedupeKey: `child-status:${id}:${payload.status}:${parent.profile_id}`,
            metadata: { child_id: id, status: payload.status, source: "child_status_update" }
          });
          if (!communicationResult.ok) {
            console.error("[child-status-update] communication log failed", { ...actionContext, parent_profile_id: parent.profile_id, logs: communicationResult.logs });
          }
        }
      }
    }
    console.info("[child-status-update] completed", actionContext);
    return ok({ child });
  } catch (error) {
    console.error("[child-status-update] unhandled failure", { ...actionContext, error });
    return handleRouteError(error);
  }
}
