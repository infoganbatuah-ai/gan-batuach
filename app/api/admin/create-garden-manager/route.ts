import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import type { Database } from "@/lib/supabase/types";

const schema = z.object({
  garden: z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    address: z.string().optional(),
    framework_type: z.string().default("mixed"),
    children_capacity: z.number().int().min(0).default(0),
    owner_name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email()
  }),
  manager: z.object({
    full_name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional(),
    temporary_password: z.string().min(8)
  })
});

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: userResult, error: userError } = await supabase.auth.admin.createUser({
      email: payload.manager.email,
      password: payload.manager.temporary_password,
      email_confirm: true,
      app_metadata: { role: "manager" },
      user_metadata: { full_name: payload.manager.full_name, phone: payload.manager.phone }
    });

    if (userError || !userResult.user) return fail(userError?.message ?? "Could not create manager user", 400);

    const gardenInsert: Database["public"]["Tables"]["gardens"]["Insert"] = {
      ...payload.garden,
      email: payload.garden.email,
      manager_id: userResult.user.id,
      status: "active",
      safe_status: "pending_review",
      public_profile_enabled: true
    };

    const { data: garden, error: gardenError } = await supabase
      .from("gardens")
      .insert(gardenInsert)
      .select("*")
      .single();

    if (gardenError) return fail(gardenError.message, 400);

    const profileUpdate: Database["public"]["Tables"]["profiles"]["Update"] = {
      role: "manager",
      garden_id: garden.id,
      full_name: payload.manager.full_name,
      phone: payload.manager.phone,
      must_change_password: true
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userResult.user.id);

    if (profileError) return fail(profileError.message, 400);

    await supabase.from("audit_logs").insert({
      actor_id: null,
      actor_role: "admin",
      garden_id: garden.id,
      entity_type: "gardens",
      entity_id: garden.id,
      action: "create_garden_and_manager",
      after_data: { garden, manager_user_id: userResult.user.id }
    });

    return ok({ garden, manager_user_id: userResult.user.id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
