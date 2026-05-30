import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  id: z.string().uuid().optional(),
  group_name: z.string().trim().min(1),
  age_range: z.string().trim().optional().nullable(),
  monthly_fee: z.coerce.number().min(0),
  capacity: z.coerce.number().min(0).optional().nullable(),
  show_price_public: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
  update_existing_children: z.coerce.boolean().default(false)
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const gardenId = profile.garden_id;
    if (!gardenId) return fail("לא נמצא גן משויך למשתמש.", 403);

    const feeGroupPayload = {
      garden_id: gardenId,
      group_name: payload.group_name,
      age_range: payload.age_range || null,
      monthly_fee: payload.monthly_fee,
      capacity: payload.capacity ?? null,
      show_price_public: payload.show_price_public,
      active: payload.active,
      updated_at: new Date().toISOString()
    };

    const previous = payload.id
      ? await supabase.from("kindergarten_fee_groups" as any).select("*").eq("id", payload.id).eq("garden_id", gardenId).maybeSingle()
      : { data: null, error: null };

    const mutation = payload.id
      ? await supabase.from("kindergarten_fee_groups" as any).update(feeGroupPayload).eq("id", payload.id).eq("garden_id", gardenId).select("*").single()
      : await supabase.from("kindergarten_fee_groups" as any).insert(feeGroupPayload).select("*").single();

    if (mutation.error || !mutation.data) {
      console.error("Fee group save failed", mutation.error);
      return fail("לא ניתן לשמור את הגדרת התשלום כרגע.", 500);
    }

    if (payload.update_existing_children) {
      const groupId = (mutation.data as any).id;
      const byLinkedGroup = await supabase
        .from("children" as any)
        .update({ payment_group_id: groupId, monthly_fee: payload.monthly_fee })
        .eq("garden_id", gardenId)
        .eq("payment_group_id", groupId);
      const byAgeGroup = await supabase
        .from("children" as any)
        .update({ payment_group_id: groupId, monthly_fee: payload.monthly_fee })
        .eq("garden_id", gardenId)
        .eq("age_group", payload.group_name);
      const byClassroom = await supabase
        .from("children" as any)
        .update({ payment_group_id: groupId, monthly_fee: payload.monthly_fee })
        .eq("garden_id", gardenId)
        .eq("classroom", payload.group_name);
      for (const result of [byLinkedGroup, byAgeGroup, byClassroom]) {
        if (result.error) console.error("Fee group children sync failed", result.error);
      }
    }

    const audit = await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      performed_by_user: profile.id,
      performed_by_role: profile.role,
      garden_id: gardenId,
      entity_type: "kindergarten_fee_groups",
      entity_id: (mutation.data as any).id,
      action: payload.id ? "update_fee_group" : "create_fee_group",
      before_data: previous.data ?? null,
      after_data: { ...mutation.data, update_existing_children: payload.update_existing_children }
    });
    if (audit.error) console.error("Fee group audit failed", audit.error);

    return ok({ fee_group: mutation.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
