import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  policy_type: z.enum(["kindergarten", "parent", "inspector", "staff"]),
  title: z.string().min(2),
  body: z.string().min(10)
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: latest } = await supabase.from("policies").select("version").eq("policy_type", payload.policy_type).order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = Number(latest?.version ?? 0) + 1;
    await supabase.from("policies").update({ active: false }).eq("policy_type", payload.policy_type);
    const { data, error } = await supabase.from("policies").insert({
      policy_type: payload.policy_type,
      title: payload.title,
      body: payload.body,
      version: nextVersion,
      published_at: new Date().toISOString(),
      active: true,
      created_by: profile.id
    }).select("*").single();
    if (error) return fail("לא ניתן לפרסם תקנון.", 400);
    await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", entity_type: "policies", entity_id: data.id, action: "publish_policy_version", after_data: data });
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
