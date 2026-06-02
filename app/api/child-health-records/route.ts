import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const healthSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid(),
  hmo: z.string().optional(),
  allergies: z.string().optional(),
  sensitivities: z.string().optional(),
  medications: z.string().optional(),
  emergency_contacts: z.array(z.object({ name: z.string(), phone: z.string().optional(), relation: z.string().optional() })).default([]),
  medication_approval_url: z.string().optional(),
  medication_approval_expires_at: z.string().optional(),
  medical_notes: z.string().optional(),
  missing_info: z.boolean().optional(),
  allergy_warning: z.boolean().optional(),
  medication_due_at: z.string().optional()
});

export async function GET(request: Request) {
  try {
    await requireRole(["admin", "manager", "owner", "staff", "parent", "inspector"]);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const gardenId = searchParams.get("garden_id");
    const childId = searchParams.get("child_id");
    let query = supabase.from("child_health_records" as any).select("*, children(full_name, photo_url, allergies, regular_medications)").limit(100);
    if (gardenId) query = query.eq("garden_id", gardenId);
    if (childId) query = query.eq("child_id", childId);
    const { data, error } = await query;
    if (error) {
      console.error("[child-health-records:get]", error);
      return fail("לא ניתן לטעון מידע רפואי כרגע", 400);
    }
    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "staff", "parent"]);
    const payload = healthSchema.parse(await request.json());
    if (profile.role !== "admin" && profile.garden_id !== payload.garden_id) return fail("אין הרשאה לעדכן מידע רפואי של גן אחר", 403);
    const supabase = await createClient();
    const missingInfo = payload.missing_info ?? !(payload.hmo && payload.emergency_contacts.length);
    const allergyWarning = payload.allergy_warning ?? Boolean(payload.allergies?.trim());
    const { data, error } = await supabase.from("child_health_records" as any).upsert({ ...payload, missing_info: missingInfo, allergy_warning: allergyWarning, updated_by: profile.id }, { onConflict: "child_id" }).select("*").single();
    if (error) {
      console.error("[child-health-records:post]", error);
      return fail("לא ניתן לשמור מידע רפואי כרגע", 400);
    }
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
