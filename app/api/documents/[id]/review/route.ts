import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["valid", "rejected", "pending_review"]),
  notes: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin"]);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
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
      entity_type: "documents",
      entity_id: id,
      action: "document_review",
      after_data: { status: payload.status, notes: payload.notes ?? null }
    });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
