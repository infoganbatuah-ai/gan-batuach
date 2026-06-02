import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const medicineLogSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid(),
  medicine_name: z.string().min(2),
  dosage: z.string().optional(),
  approval_checked: z.boolean().default(false),
  notes: z.string().optional()
});

export async function GET(request: Request) {
  try {
    await requireRole(["admin", "manager", "owner", "staff", "parent", "inspector"]);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    let query = supabase.from("medicine_given_logs" as any).select("*, children(full_name)").order("given_at", { ascending: false }).limit(100);
    const gardenId = searchParams.get("garden_id");
    const childId = searchParams.get("child_id");
    if (gardenId) query = query.eq("garden_id", gardenId);
    if (childId) query = query.eq("child_id", childId);
    const { data, error } = await query;
    if (error) return fail("לא ניתן לטעון רישום תרופות כרגע", 400);
    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "staff"]);
    const payload = medicineLogSchema.parse(await request.json());
    if (profile.role !== "admin" && profile.garden_id !== payload.garden_id) return fail("אין הרשאה לרשום תרופה בגן אחר", 403);
    const supabase = await createClient();
    const { data, error } = await supabase.from("medicine_given_logs" as any).insert({ ...payload, given_by: profile.id }).select("*").single();
    if (error) {
      console.error("[medicine-given-logs:post]", error);
      return fail("לא ניתן לשמור מתן תרופה כרגע", 400);
    }
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
