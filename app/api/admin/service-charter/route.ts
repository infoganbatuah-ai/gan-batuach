import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  title: z.string().trim().min(2),
  version: z.string().trim().min(2),
  content: z.string().trim().min(20)
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    await admin.from("service_charters" as any).update({ status: "archived", updated_by: profile.id }).eq("status", "active");
    const { data, error } = await admin.from("service_charters" as any).insert({
      ...payload,
      status: "active",
      published_at: new Date().toISOString(),
      created_by: profile.id,
      updated_by: profile.id
    }).select("*").single();
    if (error) return fail("לא ניתן לשמור את האמנה", 400);
    revalidatePath("/service-charter");
    revalidatePath("/dashboard/admin/service-charter");
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
