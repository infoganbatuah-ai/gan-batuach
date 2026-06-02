import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["valid", "rejected", "pending_review"]),
  notes: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const current = await supabase.from("documents" as any).select("id, garden_id, uploaded_by, child_id").eq("id", id).maybeSingle();
    if (current.error || !current.data) return fail("המסמך לא נמצא.", 404);
    if (profile.role !== "admin" && current.data.garden_id !== profile.garden_id) return fail("אין הרשאה לאשר מסמך שאינו שייך לגן שלך.", 403);
    const { data, error } = await supabase.from("documents" as any).update({
      status: payload.status,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      notes: payload.status === "rejected" ? null : payload.notes ?? null,
      rejection_reason: payload.status === "rejected" ? payload.notes ?? "נדחה על ידי אדמין" : null
    }).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: current.data.garden_id,
      entity_type: "documents",
      entity_id: id,
      action: "document_review",
      after_data: { status: payload.status, notes: payload.notes ?? null }
    });
    if (current.data.uploaded_by) {
      const notification = await supabase.from("notifications" as any).insert({
        garden_id: current.data.garden_id,
        recipient_id: current.data.uploaded_by,
        recipient_profile_id: current.data.uploaded_by,
        title: payload.status === "valid" ? "מסמך אושר" : "מסמך נדחה",
        body: payload.status === "valid" ? "הגן אישר את המסמך שהעלית." : payload.notes ?? "הגן ביקש לתקן או להעלות מחדש את המסמך.",
        message: payload.status === "valid" ? "הגן אישר את המסמך שהעלית." : payload.notes ?? "הגן ביקש לתקן או להעלות מחדש את המסמך.",
        entity_type: "documents",
        entity_id: id,
        child_id: current.data.child_id,
        severity: payload.status === "valid" ? "low" : "medium",
        action_url: "/dashboard/parent/documents",
        created_by: profile.id,
        metadata: { href: "/dashboard/parent/documents", document_id: id, status: payload.status }
      });
      if (notification.error) {
        console.error("[document-review] notification failed", { document_id: id, error: notification.error.message });
        return fail("המסמך עודכן, אך ההתראה להורה/מעלה המסמך לא נשלחה.", 409, { document_id: id, status: payload.status });
      }
    }
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
