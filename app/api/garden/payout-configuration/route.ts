import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const payoutSchema = z.object({
  destination_type: z.enum(["bank_account", "payment_provider"]).default("bank_account"),
  provider: z.enum(["manual_bank", "meshulam", "tranzila", "cardcom", "pelecard", "future_provider"]).default("manual_bank"),
  account_holder_name: z.string().min(2),
  bank_name: z.string().optional(),
  bank_branch: z.string().optional(),
  bank_account_last4: z.string().max(8).optional(),
  provider_account_reference: z.string().optional(),
  billing_email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const gardenId = profile.garden_id;
    if (!gardenId) return fail("לא נמצא שיוך לגן", 400);
    const parsed = payoutSchema.parse(await request.json());
    const supabase = await createClient();
    const payload = {
      garden_id: gardenId,
      destination_key: `garden-${gardenId}-parent-tuition`,
      destination_type: parsed.destination_type,
      provider: parsed.provider,
      status: "pending_verification",
      account_holder_name: parsed.account_holder_name,
      bank_name: parsed.bank_name || null,
      bank_branch: parsed.bank_branch || null,
      bank_account_last4: parsed.bank_account_last4 || null,
      provider_account_reference: parsed.provider_account_reference || null,
      billing_email: parsed.billing_email || null,
      receives_parent_payments: true,
      last_changed_by: profile.id,
      notes: parsed.notes || null,
      metadata: {
        stream: "parent_tuition",
        destination: "kindergarten_account_provider",
        raw_card_storage: false
      },
      updated_at: new Date().toISOString()
    };
    const { data, error } = await (supabase as any)
      .from("kindergarten_payout_configurations")
      .upsert(payload, { onConflict: "destination_key" })
      .select("*")
      .single();

    if (error) return fail(error.message, 400);
    return ok({ configuration: data, message: "יעד התשלום נשמר וממתין לאימות." });
  } catch (error) {
    return handleRouteError(error);
  }
}
