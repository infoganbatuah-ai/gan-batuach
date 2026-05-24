import { z } from "zod";
import { handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(5).optional()
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const checks = await Promise.all([
      payload.email ? supabase.from("profiles" as any).select("id", { count: "exact", head: true }).or(`email.eq.${payload.email},username.eq.${payload.email}`) : Promise.resolve({ count: 0, error: null }),
      payload.email ? supabase.from("leads" as any).select("id", { count: "exact", head: true }).eq("email", payload.email) : Promise.resolve({ count: 0, error: null }),
      payload.phone ? supabase.from("profiles" as any).select("id", { count: "exact", head: true }).eq("phone", payload.phone) : Promise.resolve({ count: 0, error: null }),
      payload.phone ? supabase.from("leads" as any).select("id", { count: "exact", head: true }).eq("phone", payload.phone) : Promise.resolve({ count: 0, error: null })
    ]);

    return ok({
      email_exists: Boolean((checks[0].count ?? 0) + (checks[1].count ?? 0)),
      phone_exists: Boolean((checks[2].count ?? 0) + (checks[3].count ?? 0))
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
