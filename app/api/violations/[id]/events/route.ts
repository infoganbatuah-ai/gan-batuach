import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["admin", "inspector", "manager", "owner"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("מזהה ליקוי לא תקין", 422);
    const { data, error } = await (await createClient()).from("corrective_action_events" as never)
      .select("id,action,from_status,to_status,note,evidence_paths,due_at,created_at")
      .eq("violation_id", id).order("created_at", { ascending: true });
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
