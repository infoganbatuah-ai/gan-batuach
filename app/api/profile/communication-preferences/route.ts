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
  preferred_language: z.enum(["he", "en", "ar"]).optional(),
  parent_daily_digest_enabled: z.boolean().optional(),
  parent_ai_summary_enabled: z.boolean().optional(),
  parent_category_channels: z.record(z.string(), z.array(z.enum(["push", "email", "sms", "whatsapp"]))).optional(),
  push_category_preferences: z.record(z.string(), z.boolean()).optional()
});

const parentCategories = ["important", "safety", "attendance", "message", "document", "payment", "pickup"] as const;

function defaultParentCategoryChannels() {
  return {
    important: ["push", "email"],
    safety: ["push", "email", "whatsapp"],
    attendance: ["push"],
    message: ["push", "whatsapp"],
    document: ["push", "email"],
    payment: ["push", "email"],
    pickup: ["push"]
  };
}

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase.from("communication_preferences" as any).select("*").eq("profile_id", profile.id).maybeSingle();
    if (error) {
      console.error("[communication-preferences] load failed", { profile_id: profile.id, error: error.message });
      return fail("לא ניתן לטעון העדפות תקשורת כרגע.", 500);
    }
    const pushCategoryRows = await supabase.from("push_category_preferences" as any).select("category, enabled, critical_only").eq("profile_id", profile.id).in("category", [...parentCategories]);
    if (pushCategoryRows.error) console.error("[communication-preferences] push category load failed", { profile_id: profile.id, error: pushCategoryRows.error.message });
    const pushCategoryPreferences = Object.fromEntries(parentCategories.map((category) => {
      const row = (pushCategoryRows.data ?? []).find((item: any) => item.category === category);
      return [category, row?.enabled ?? true];
    }));

    return ok({
      preferences: data ?? {
        profile_id: profile.id,
        receive_sms: false,
        receive_whatsapp: false,
        receive_email: true,
        receive_push: true,
        critical_push_allowed: true,
        emergency_messages_allowed: true,
        preferred_language: "he",
        parent_daily_digest_enabled: true,
        parent_ai_summary_enabled: true,
        parent_category_channels: defaultParentCategoryChannels()
      },
      push_category_preferences: pushCategoryPreferences
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
      parent_daily_digest_enabled: payload.parent_daily_digest_enabled ?? current?.parent_daily_digest_enabled ?? true,
      parent_ai_summary_enabled: payload.parent_ai_summary_enabled ?? current?.parent_ai_summary_enabled ?? true,
      parent_category_channels: payload.parent_category_channels ?? current?.parent_category_channels ?? defaultParentCategoryChannels(),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("communication_preferences" as any).upsert(patch, { onConflict: "profile_id" }).select("*").single();
    if (error) {
      console.error("[communication-preferences] save failed", { profile_id: profile.id, error: error.message });
      return fail("שמירת העדפות התקשורת נכשלה.", 500);
    }
    if (payload.push_category_preferences) {
      const rows = Object.entries(payload.push_category_preferences)
        .filter(([category]) => (parentCategories as readonly string[]).includes(category))
        .map(([category, enabled]) => ({
          profile_id: profile.id,
          category,
          enabled,
          role: profile.role ?? "parent",
          updated_at: new Date().toISOString()
        }));
      if (rows.length) {
        const upsert = await supabase.from("push_category_preferences" as any).upsert(rows, { onConflict: "profile_id,category" });
        if (upsert.error) {
          console.error("[communication-preferences] push category save failed", { profile_id: profile.id, error: upsert.error.message });
          return fail("שמירת העדפות ההתראות נכשלה.", 500);
        }
      }
    }
    return ok({ preferences: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
