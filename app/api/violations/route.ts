import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const access = await getOperationalRoleContext(["admin", "inspector", "manager", "owner"]);
    if (!access.allowed) return access.response;
    const gardenId = new URL(request.url).searchParams.get("garden_id");
    if (gardenId && !z.string().uuid().safeParse(gardenId).success) return fail("מזהה גן לא תקין", 422);
    let query = (await createClient()).from("violations" as never)
      .select("id,garden_id,inspection_id,question_id,title,description,category,severity,score,status,correction_due_at,correction_note,correction_files,review_note,responsible_profile_id,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(200);
    if (gardenId) query = query.eq("garden_id", gardenId);
    const { data, error } = await query;
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
