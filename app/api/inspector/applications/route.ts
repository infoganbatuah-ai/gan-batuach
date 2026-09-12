import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  preferred_regions: z.array(z.string().min(2)).default([]),
  experience_summary: z.string().optional(),
  identity_number: z.string().optional(),
  documents: z.record(z.string(), z.unknown()).optional(),
  submit: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות.", 401);
    if (profile.role !== "inspector") return fail("אין הרשאה להגיש בקשת מפקח.", 403);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_inspector_application" as any, { p_payload: payload } as any);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 409);
    return ok({ application: data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
