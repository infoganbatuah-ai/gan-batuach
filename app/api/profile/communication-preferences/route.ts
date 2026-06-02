import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  receive_sms: z.boolean().optional(),
  receive_whatsapp: z.boolean().optional(),
  receive_email: z.boolean().optional(),
  receive_push: z.boolean().optional(),
  critical_push_allowed: z.boolean().optional(),
  emergency_messages_allowed: z.boolean().optional(),
  preferred_language: z.enum(["he", "en", "ar"]).optional()
});

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("communication_preferences" as any).select("*").eq("profile_id", profile.id).maybeSingle();
    if (error) {
      console.error("[communication-preferences] load failed", { profile_id: profile.id, error: error.message });
      return fail("לא ניתן לטעון העדפות תקשורת כרגע.", 500);
    }
    return ok({
      preferences: data ?? {
        profile_id: profile.id,
        receive_sms: false,
        receive_whatsapp: false,
        receive_email: true,
        receive_push: true,
        critical_push_allowed: true,
        emergency_messages_allowed: true,
        preferred_language: "he"
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const existing = await supabase.from("communication_preferences" as any).select("*").eq("profile_id", profile.id).maybeSingle();
    if (existing.error) {
      console.error("[communication-preferences] existing load failed", { profile_id: profile.id, error: existing.error.message });
      return fail("לא ניתן לטעון העדפות קיימות כרגע.", 500);
    }
    const current = existing.data as any;
    const patch = {
      profile_id: profile.id,
      receive_sms: payload.receive_sms ?? current?.receive_sms ?? false,
      receive_whatsapp: payload.receive_whatsapp ?? current?.receive_whatsapp ?? false,
      receive_email: payload.receive_email ?? current?.receive_email ?? true,
      receive_push: payload.receive_push ?? current?.receive_push ?? true,
      critical_push_allowed: payload.critical_push_allowed ?? current?.critical_push_allowed ?? true,
      emergency_messages_allowed: payload.emergency_messages_allowed ?? current?.emergency_messages_allowed ?? true,
      preferred_language: payload.preferred_language ?? current?.preferred_language ?? "he",
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("communication_preferences" as any).upsert(patch, { onConflict: "profile_id" }).select("*").single();
    if (error) {
      console.error("[communication-preferences] save failed", { profile_id: profile.id, error: error.message });
      return fail("שמירת העדפות התקשורת נכשלה.", 500);
    }
    return ok({ preferences: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
