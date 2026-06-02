import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  action: z.enum([
    "approve_new_kindergarten",
    "request_missing_details",
    "reject_new_kindergarten",
    "acknowledge_current_transfer",
    "request_parent_call",
    "flag_current_issue"
  ]),
  note: z.string().optional()
});

function statusForAction(action: z.infer<typeof schema>["action"]) {
  return {
    approve_new_kindergarten: "approved",
    request_missing_details: "missing_details",
    reject_new_kindergarten: "rejected",
    acknowledge_current_transfer: "current_kindergarten_acknowledged",
    request_parent_call: "current_kindergarten_requested_call",
    flag_current_issue: "current_kindergarten_flagged"
  }[action];
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let actionContext: Record<string, unknown> = { action: "child_transfer_update" };
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("המשתמש אינו משויך לגן", 422);
    if (!isAdminClientConfigured()) return fail("ניהול בקשות מעבר דורש הגדרת שירות שרת מאובטח.", 503);
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    actionContext = { ...actionContext, entity_id: id, user_id: profile.id, user_role: profile.role, garden_id: profile.garden_id, requested_action: payload.action };
    const admin = createAdminClient();

    const transferRes = await admin
      .from("child_transfer_requests" as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (transferRes.error) {
      console.error("[child-transfer-update] lookup failed", { ...actionContext, error: transferRes.error.message });
      return fail("לא ניתן לטעון את בקשת המעבר: " + transferRes.error.message, 400);
    }
    const transfer = transferRes.data as any;
    if (!transfer) return fail("בקשת המעבר לא נמצאה", 404);

    const isTargetGarden = transfer.target_garden_id === profile.garden_id;
    const isCurrentGarden = transfer.current_garden_id === profile.garden_id;
    const targetActions = ["approve_new_kindergarten", "request_missing_details", "reject_new_kindergarten"];
    const currentActions = ["acknowledge_current_transfer", "request_parent_call", "flag_current_issue"];
    if (targetActions.includes(payload.action) && !isTargetGarden) return fail("רק הגן החדש יכול לטפל בבקשת הקליטה", 403);
    if (currentActions.includes(payload.action) && !isCurrentGarden) return fail("רק הגן הנוכחי יכול לעדכן את תגובת המעבר", 403);

    const now = new Date().toISOString();
    const status = statusForAction(payload.action);
    const patch: Record<string, unknown> = { status, updated_at: now };
    if (targetActions.includes(payload.action)) {
      patch.new_kindergarten_response = payload.note ?? null;
      patch.new_kindergarten_response_by = profile.id;
      patch.new_kindergarten_responded_at = now;
    } else {
      patch.current_kindergarten_response = payload.note ?? null;
      patch.current_kindergarten_response_by = profile.id;
      patch.current_kindergarten_responded_at = now;
    }

    if (payload.action === "approve_new_kindergarten") {
      const activationStatus = transfer.requested_start_date && new Date(transfer.requested_start_date).getTime() > Date.now()
        ? "pending_manager_approval"
        : "active";
      if (transfer.target_child_id) {
        await admin.from("children" as any).update({
          status: activationStatus,
          manager_approved_at: activationStatus === "active" ? now : null,
          approval_notes: payload.note ?? null
        }).eq("id", transfer.target_child_id).eq("garden_id", transfer.target_garden_id);
      }
      if (transfer.target_enrollment_id) {
        await admin.from("child_kindergarten_enrollments" as any).update({
          status: activationStatus,
          manager_approved_at: activationStatus === "active" ? now : null,
          manager_approved_by: profile.id,
          notes: payload.note ?? null
        }).eq("id", transfer.target_enrollment_id).eq("garden_id", transfer.target_garden_id);
      }
      await admin.from("parent_kindergarten_links" as any).update({
        status: "active",
        approved_at: now,
        approved_by: profile.id
      }).eq("parent_profile_id", transfer.parent_profile_id).eq("garden_id", transfer.target_garden_id);

      if (transfer.current_garden_id && transfer.current_garden_id !== transfer.target_garden_id) {
        const transferEndDate = transfer.requested_start_date || now.slice(0, 10);
        await admin.from("child_kindergarten_enrollments" as any).update({
          status: "transferred",
          end_date: transferEndDate,
          notes: "הילד נקלט בגן חדש. היסטוריית הגן נשמרה."
        }).eq("permanent_child_file_id", transfer.permanent_child_file_id).eq("garden_id", transfer.current_garden_id).eq("status", "active");
      }
    }

    if (payload.action === "reject_new_kindergarten" && transfer.target_child_id) {
      await admin.from("children" as any).update({ status: "rejected", approval_notes: payload.note ?? null }).eq("id", transfer.target_child_id).eq("garden_id", transfer.target_garden_id);
      if (transfer.target_enrollment_id) await admin.from("child_kindergarten_enrollments" as any).update({ status: "rejected", rejection_reason: payload.note ?? null }).eq("id", transfer.target_enrollment_id);
    }
    if (payload.action === "request_missing_details" && transfer.target_child_id) {
      await admin.from("children" as any).update({ status: "request_missing_details", approval_notes: payload.note ?? null }).eq("id", transfer.target_child_id).eq("garden_id", transfer.target_garden_id);
      if (transfer.target_enrollment_id) await admin.from("child_kindergarten_enrollments" as any).update({ status: "pending_manager_approval", notes: payload.note ?? null }).eq("id", transfer.target_enrollment_id);
    }

    const updateRes = await admin.from("child_transfer_requests" as any).update(patch).eq("id", id).select("*").single();
    if (updateRes.error) {
      console.error("[child-transfer-update] status update failed", { ...actionContext, previous_status: transfer.status, new_status: status, error: updateRes.error.message });
      return fail("עדכון בקשת המעבר נכשל: " + updateRes.error.message, 400);
    }

    await admin.from("child_timeline_events" as any).insert({
      child_id: transfer.target_child_id ?? transfer.child_id,
      permanent_child_file_id: transfer.permanent_child_file_id,
      garden_id: profile.garden_id,
      actor_id: profile.id,
      actor_role: profile.role,
      event_type: `child_transfer_${payload.action}`,
      title: payload.action === "approve_new_kindergarten" ? "הגן החדש אישר קליטת ילד" : payload.action === "reject_new_kindergarten" ? "הגן החדש דחה קליטת ילד" : payload.action === "request_missing_details" ? "הגן החדש ביקש השלמת פרטים" : "הגן הקיים עדכן תגובת מעבר",
      description: payload.note ?? null,
      metadata: { transfer_request_id: id, status }
    });

    if (transfer.parent_profile_id) {
      await admin.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: transfer.parent_profile_id,
        recipient_role: "parent",
        title: payload.action === "approve_new_kindergarten" ? "בקשת הקליטה אושרה" : payload.action === "reject_new_kindergarten" ? "בקשת הקליטה נדחתה" : "עודכן סטטוס בקשת מעבר",
        body: payload.note ?? "סטטוס בקשת המעבר עודכן.",
        entity_type: "child_transfer_requests",
        entity_id: id,
        severity: payload.action === "reject_new_kindergarten" ? "medium" : "low",
        metadata: { href: "/dashboard/parent", transfer_request_id: id }
      });
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "child_transfer_requests",
      entityId: id,
      action: `child_transfer_${payload.action}`,
      afterData: { status, note: payload.note ?? null }
    });

    console.info("[child-transfer-update] completed", { ...actionContext, previous_status: transfer.status, new_status: status });
    return ok({ transfer: updateRes.data });
  } catch (error) {
    console.error("[child-transfer-update] unhandled failure", { ...actionContext, error });
    return handleRouteError(error);
  }
}
