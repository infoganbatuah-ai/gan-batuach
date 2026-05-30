import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { defaultRecipientGroupForRequestType, getParentRequestRecipients } from "@/lib/domain/parent-request-routing";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  child_id: z.string().uuid(),
  request_type: z.string().min(2),
  content: z.string().min(3),
  recipient_mode: z.enum(["profile", "group"]).optional(),
  recipient_profile_id: z.string().uuid().optional().or(z.literal("")),
  recipient_role_group: z.string().optional(),
  recipient_label: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  reminder_at: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const family = await getParentFamilyContext(supabase as any, profile);
    const parent = family.parents[0];
    const child = family.children.find((item: any) => item.id === payload.child_id);
    const enrollment = family.enrollments.find((item: any) => item.child_id === payload.child_id || item.permanent_child_file_id === payload.child_id);
    const gardenId = child?.garden_id ?? child?.kindergarten_id ?? enrollment?.garden_id ?? enrollment?.kindergarten_id;
    if (!parent || !gardenId || (!child && !enrollment)) {
      return fail("אין הרשאה לשלוח בקשה עבור ילד זה.", 403);
    }
    const childName = child?.full_name ?? enrollment?.full_name ?? "ילד/ה";
    const recipients = await getParentRequestRecipients(supabase as any, gardenId);
    const requestedProfileId = payload.recipient_profile_id || "";
    const requestedGroup = payload.recipient_role_group || defaultRecipientGroupForRequestType(payload.request_type);
    const selectedRecipient = requestedProfileId
      ? recipients.find((recipient) => recipient.profile_id === requestedProfileId)
      : recipients.find((recipient) => recipient.id === `group:${requestedGroup}` || recipient.group === requestedGroup);
    if (requestedProfileId && !selectedRecipient) return fail("הנמען שנבחר אינו משויך לגן של הילד.", 403);
    const recipientRole = selectedRecipient?.role ?? requestedGroup;
    const roleGroup = requestedProfileId ? null : requestedGroup;
    const routedToAdmin = requestedGroup.includes("admin") || recipientRole === "admin";
    const routedToInspector = requestedGroup.includes("inspector") || recipientRole === "inspector";
    const row = {
      garden_id: gardenId,
      child_id: payload.child_id,
      parent_id: parent.id,
      parent_profile_id: profile.id,
      request_type: payload.request_type,
      content: payload.content,
      recipient_profile_id: requestedProfileId || null,
      recipient_role: recipientRole,
      recipient_role_group: roleGroup,
      recipient_label: selectedRecipient?.label ?? payload.recipient_label ?? null,
      routed_to_admin: routedToAdmin,
      routed_to_inspector: routedToInspector,
      priority: payload.priority,
      reminder_at: payload.reminder_at ?? null,
      status: "new"
    };
    const { data, error } = await supabase.from("parent_child_requests" as any).insert(row).select("*").single();
    if (error) {
      console.error("[parent-child-requests:create]", error);
      return fail("לא ניתן לשלוח את הבקשה כרגע.", 500);
    }
    let notificationRecipients = requestedProfileId
      ? recipients.filter((recipient) => recipient.profile_id === requestedProfileId)
      : recipients.filter((recipient) => recipient.group === requestedGroup && recipient.profile_id);
    if (requestedGroup === "manager_admin" && !requestedProfileId) {
      notificationRecipients = recipients.filter((recipient) => ["manager", "admin"].includes(recipient.group) && recipient.profile_id);
    }
    if (!notificationRecipients.length) {
      notificationRecipients = recipients.filter((recipient) => recipient.group === "manager" && recipient.profile_id);
    }
    await Promise.all(notificationRecipients.map((recipient) => supabase.from("notifications" as any).insert({
      garden_id: gardenId,
      recipient_id: recipient.profile_id,
      recipient_role: recipient.role,
      title: "בקשת הורה חדשה",
      body: `${profile.full_name ?? "הורה"} · ${childName}: ${payload.request_type} · ${payload.content.slice(0, 70)}`,
      entity_type: "parent_child_request",
      entity_id: data.id,
      status: "pending",
      severity: payload.priority === "urgent" ? "high" : "medium",
      metadata: { href: recipient.role === "admin" ? "/dashboard/admin/complaints" : recipient.role === "staff" ? "/dashboard/staff/messages" : recipient.role === "inspector" ? "/dashboard/inspector/reports" : "/dashboard/garden/children", request_id: data.id, child_id: payload.child_id, request_type: payload.request_type, target: selectedRecipient?.label ?? requestedGroup }
    })));
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
