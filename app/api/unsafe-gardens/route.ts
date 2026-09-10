import { createClient } from "@/lib/supabase/server";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function GET() {
  try {
    const access = await getOperationalRoleContext(["admin", "inspector"]);
    if (!access.allowed) return access.response;
    const supabase = await createClient();
    const { data, error } = await supabase.from("unsafe_gardens" as any).select("*");
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
