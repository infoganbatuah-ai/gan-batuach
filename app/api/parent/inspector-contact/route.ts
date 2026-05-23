import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function GET(request: Request) {
  try {
    await requireRole(["parent"]);
    const gardenId = new URL(request.url).searchParams.get("garden_id");
    if (!gardenId) return fail("garden_id is required", 422);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("gardens")
      .select("id, name, inspector:profiles!gardens_inspector_id_fkey(id, full_name, phone)")
      .eq("id", gardenId)
      .single();
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
