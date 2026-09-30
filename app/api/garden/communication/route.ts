import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { managementDeliveryCapability } from "@/lib/management/external-delivery";

const schema = z.object({
  action: z.literal("update_settings"),
  default_parent_channel: z.enum(["in_app", "sms", "whatsapp", "email"])
});

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש", 422);
    const payload = schema.parse(await request.json());
    const capability = managementDeliveryCapability();
    const ready = (status: string) => status === "provider_submission_available" || status === "available";
    if (payload.default_parent_channel !== "in_app" && !ready(capability[payload.default_parent_channel])) {
      return fail("הערוץ שנבחר אינו מחובר לספק מסירה מאומת.", 409);
    }
    const supabase = await createClient();
    const result = await supabase.from("kindergarten_communication_settings" as any).upsert({
      garden_id: profile.garden_id,
      default_parent_channel: payload.default_parent_channel,
      sms_enabled: payload.default_parent_channel === "sms" && ready(capability.sms),
      whatsapp_enabled: payload.default_parent_channel === "whatsapp" && ready(capability.whatsapp),
      email_fallback_enabled: ready(capability.email),
      updated_at: new Date().toISOString()
    }, { onConflict: "garden_id" }).select("*").single();
    if (result.error) {
      console.error("[garden-communication] settings update failed", { garden_id: profile.garden_id, error: result.error.message });
      return fail("שמירת הגדרות התקשורת נכשלה.", 500);
    }
    return ok({ settings: result.data });
  } catch (error) {
    console.error("[garden-communication] unhandled failure", error);
    return handleRouteError(error);
  }
}
