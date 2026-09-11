import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ garden_id: z.string().uuid(), age_group_key: z.string().trim().min(1).max(80).optional() });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = querySchema.parse({ garden_id: url.searchParams.get("garden_id"), age_group_key: url.searchParams.get("age_group_key") ?? undefined });
    const supabase = await createClient();
    const [{ data, error }, ageGroups] = await Promise.all([
      supabase.rpc("public_classroom_availability" as never, { target_garden_id: query.garden_id, target_age_group_key: query.age_group_key ?? null } as never),
      supabase.rpc("public_age_group_availability" as never, { target_garden_id: query.garden_id } as never)
    ]);
    if (error) return fail("לא ניתן לטעון זמינות", 503);
    return ok({ garden_id: query.garden_id, classrooms: data ?? [], age_groups: ageGroups.error ? [] : ageGroups.data ?? [] });
  } catch (error) { return handleSafeRouteError(error); }
}
