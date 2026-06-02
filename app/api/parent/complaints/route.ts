import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";
import { complaintSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const supabase = await createClient();
    const payload = complaintSchema.parse(await request.json());
    const family = await getParentFamilyContext(supabase as any, profile);
    const gardenId = payload.garden_id;
    if (!family.gardenIds.includes(gardenId)) return fail("אין הרשאה לשלוח פנייה עבור גן שאינו משויך לחשבון שלך.", 403);
    if (payload.parent_id && !family.parentIds.includes(payload.parent_id)) return fail("אין הרשאה לשלוח פנייה עבור הורה אחר.", 403);
    if (payload.child_id && !(family.children as any[]).some((child) => child.id === payload.child_id)) return fail("אין הרשאה לשלוח פנייה עבור ילד שאינו משויך אליך.", 403);

    const complaintPayload = { ...payload } as Record<string, unknown>;
    delete complaintPayload.child_id;
    delete complaintPayload.attachment_urls;
    const { data, error } = await supabase.from("complaints" as any).insert({
      ...complaintPayload,
      garden_id: gardenId,
      parent_id: payload.parent_id ?? family.parentIds[0] ?? null,
      status: "new"
    }).select("*").single();
    if (error || !data) return fail("שמירת הפנייה נכשלה: " + (error?.message ?? "לא התקבלה רשומה"), 400);

    const { data: garden } = await supabase.from("gardens" as any).select("manager_id, owner_profile_id").eq("id", gardenId).maybeSingle();
    const recipients = Array.from(new Set([garden?.manager_id, garden?.owner_profile_id].filter(Boolean)));
    if (recipients.length) {
      const notifications = await Promise.all(recipients.map((recipientId) => supabase.from("notifications" as any).insert({
        garden_id: gardenId,
        recipient_id: recipientId,
        recipient_profile_id: recipientId,
        recipient_role: "manager",
        title: "פניית הורה חדשה",
        body: `${profile.full_name ?? "הורה"}: ${payload.subject}`,
        message: `${profile.full_name ?? "הורה"}: ${payload.subject}`,
        entity_type: "complaints",
        entity_id: data.id,
        severity: payload.severity === "critical" ? "urgent" : payload.severity,
        status: "unread",
        action_url: "/dashboard/garden/messages?status=open",
        created_by: profile.id,
        metadata: { href: "/dashboard/garden/messages?status=open", complaint_id: data.id }
      })));
      const notificationError = notifications.find((result) => result.error)?.error;
      if (notificationError) {
        console.error("[parent-complaints:notification]", { complaint_id: data.id, error: notificationError.message });
        return fail("הפנייה נשמרה, אך יצירת ההתראה לגן נכשלה. הפנייה עדיין מופיעה במסך הפניות.", 409, { complaint_id: data.id });
      }
    }

    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
