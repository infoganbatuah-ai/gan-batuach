import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  recipient_id: z.string().uuid(),
  subject: z.string().min(2),
  content: z.string().min(2)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin"]);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: recipient, error: recipientError } = await supabase.from("profiles").select("id, role, garden_id").eq("id", payload.recipient_id).single();
    if (recipientError || !recipient) return fail("נמען לא נמצא.", 404);
    if (!["manager", "owner"].includes(String(recipient.role)) || recipient.garden_id !== id) return fail("ניתן לשלוח הודעה רק למנהלת או בעלים של הגן.", 422);
    const { data, error } = await supabase.from("messages").insert({
      garden_id: id,
      sender_id: profile.id,
      recipient_id: payload.recipient_id,
      subject: payload.subject,
      body: payload.content,
      content: payload.content,
      status: "unread",
      treatment_status: "open"
    }).select("*").single();
    if (error) return fail("לא ניתן לשלוח הודעה.", 400);
    const notification = await supabase.from("notifications").insert({
      garden_id: id,
      recipient_id: payload.recipient_id,
      recipient_profile_id: payload.recipient_id,
      recipient_role: recipient.role,
      title: "הודעה חדשה מהמערכת",
      body: payload.subject,
      message: payload.content,
      entity_type: "message",
      entity_id: data.id,
      action_url: "/dashboard/garden/messages"
    }).select("id").maybeSingle();
    if (notification.error || !notification.data) {
      console.error("[admin-garden-message-notification-failed]", { garden_id: id, message_id: data.id, recipient_id: payload.recipient_id, error: notification.error?.message ?? "notification not created" });
      return fail("ההודעה נשמרה, אך ההתראה לנמען לא נוצרה. יש לעדכן את הגן ידנית או לבדוק את מרכז ההתראות.", 409, { message_id: data.id });
    }
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
