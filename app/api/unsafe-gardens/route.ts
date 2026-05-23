import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function GET() {
  try {
    await requireRole(["admin", "inspector"]);
    const supabase = await createClient();
    const { data, error } = await supabase.from("unsafe_gardens" as any).select("*");
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
