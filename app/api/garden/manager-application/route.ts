import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { operationalDistrictForCity } from "@/lib/domain/kindergarten-onboarding";

const schema = z.object({
  kindergarten_name: z.string().trim().min(2), legal_entity_name: z.string().trim().optional(), business_id: z.string().trim().optional(),
  manager_full_name: z.string().trim().min(2), manager_id_number: z.string().trim().optional(), manager_phone: z.string().trim().optional(),
  manager_email: z.string().trim().email().optional().or(z.literal("")), city: z.string().trim().min(2), street: z.string().trim().optional(),
  address_details: z.string().trim().optional(), public_description: z.string().trim().optional(), opening_hours: z.string().trim().optional(),
  contact_phone: z.string().trim().optional(), contact_email: z.string().trim().email().optional().or(z.literal("")),
  registrant_type: z.enum(["teacher_operator", "owner_teacher", "owner_only"]).default("teacher_operator")
});
const clean = (value?: string | null) => String(value ?? "").trim() || null;

export async function POST(request: Request) {
  try {
    await requireRole(["manager", "owner"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const address = [payload.street, payload.address_details].map(clean).filter(Boolean).join(" ");
    const { data, error } = await supabase.rpc("start_garden_onboarding" as never, {
      details: {
        name: payload.kindergarten_name, city: payload.city, address,
        phone: clean(payload.contact_phone) ?? clean(payload.manager_phone), email: clean(payload.contact_email) ?? clean(payload.manager_email),
        manager_name: payload.manager_full_name, business_name: clean(payload.legal_entity_name), business_id: clean(payload.business_id),
        manager_id_number_review_required: Boolean(clean(payload.manager_id_number)), manager_phone: clean(payload.manager_phone),
        manager_email: clean(payload.manager_email), operational_district: operationalDistrictForCity(payload.city), street: clean(payload.street),
        operating_hours: clean(payload.opening_hours), public_description: clean(payload.public_description)
      }, requested_registrant_type: payload.registrant_type
    } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לפתוח טיוטה מסוג זה" : "לא ניתן לפתוח את טיוטת הגן", error.code === "42501" ? 403 : 400);
    const result = data as { garden_id: string; already_exists: boolean; activation_key: string };
    revalidatePath("/onboarding/kindergarten");
    return ok({ ...result, next_path: `/onboarding/kindergarten?gardenId=${result.garden_id}` }, result.already_exists ? 200 : 201);
  } catch (error) { return handleRouteError(error); }
}
