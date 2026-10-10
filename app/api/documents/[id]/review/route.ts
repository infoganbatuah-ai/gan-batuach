import { z } from "zod";
import { getSessionProfile } from "@/lib/auth";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["valid", "rejected"]),
  notes: z.string().max(500).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("review_management_document" as never,
      { p_id: id, p_status: payload.status, p_reason: payload.notes ?? null } as never);
    if (error) return fail("לא ניתן לאשר או לדחות מסמך זה.", 403);
    const row = data as { id: string; status: string; reviewed_at: string | null; rejection_reason: string | null };
    return ok({ id: row.id, status: row.status, reviewed_at: row.reviewed_at, rejection_reason: row.rejection_reason });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
