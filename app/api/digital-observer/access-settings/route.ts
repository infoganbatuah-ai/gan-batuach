import crypto from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { encryptField } from "@/lib/security/encryption";

const createRecipientSchema = z.object({
  action: z.literal("create_recipient"),
  observer_site_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  relationship_label: z.string().trim().max(80).optional().default(""),
  destination: z.string().trim().min(5).max(180),
  channels: z.array(z.enum(["email", "sms", "whatsapp", "voice"])).min(1).max(4),
  receives_critical_alerts: z.boolean().default(false)
});
const deleteRecipientSchema = z.object({ action: z.literal("delete_recipient"), id: z.string().uuid() });
const registerDeviceSchema = z.object({
  action: z.literal("register_device"),
  observer_site_id: z.string().uuid(),
  device_label: z.string().trim().min(2).max(80),
  platform: z.enum(["web", "ios", "android"]).default("web"),
  device_reference: z.string().trim().min(16).max(200)
});
const revokeDeviceSchema = z.object({ action: z.literal("revoke_device"), id: z.string().uuid() });
const schema = z.discriminatedUnion("action", [createRecipientSchema, deleteRecipientSchema, registerDeviceSchema, revokeDeviceSchema]);

function destinationHint(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 4 ? `***${digits.slice(-4)}` : "פרטי קשר שמורים";
}

function deviceHash(value: string) {
  const pepper = process.env.FIELD_HASH_PEPPER || process.env.FIELD_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pepper) throw new Error("DEVICE_HASH_CONFIGURATION_REQUIRED");
  return crypto.createHmac("sha256", pepper).update(value).digest("hex");
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());

    if (payload.action === "create_recipient" || payload.action === "register_device") {
      const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה לעדכן את הגדרות הגישה באתר.", 403);
    }

    if (payload.action === "create_recipient") {
      const encrypted = encryptField(payload.destination);
      const result = await supabase.from("digital_observer_authorized_recipients" as any).insert({
        observer_site_id: payload.observer_site_id,
        display_name: payload.display_name,
        relationship_label: payload.relationship_label || null,
        channels: payload.channels,
        destination_hint: destinationHint(payload.destination),
        provider_contact_reference: encrypted ? `secret://${encrypted}` : null,
        receives_critical_alerts: payload.receives_critical_alerts,
        active: true,
        created_by: profile.id,
        metadata: { provider_delivery_enabled: false, explicit_activation_required: true }
      }).select("id,display_name,relationship_label,channels,destination_hint,receives_critical_alerts,active").single();
      if (result.error) return fail("לא ניתן לשמור את מורשה העדכונים.", 400);
      return ok({ recipient: result.data, message: "המורשה נשמר באופן מוצפן. שליחה חיצונית תישאר כבויה עד חיבור ספק ואישור." }, 201);
    }

    if (payload.action === "register_device") {
      const tokenLookup = await supabase.from("push_device_tokens" as any).select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("is_active", true);
      const pushTokenRegistered = !tokenLookup.error && (tokenLookup.count ?? 0) > 0;
      const result = await supabase.from("digital_observer_device_slots" as any).upsert({
        observer_site_id: payload.observer_site_id,
        profile_id: profile.id,
        device_label: payload.device_label,
        platform: payload.platform,
        device_reference_hash: deviceHash(payload.device_reference),
        active: true,
        last_seen_at: new Date().toISOString(),
        metadata: { push_token_registered: pushTokenRegistered, provider_activation_required: !pushTokenRegistered }
      }, { onConflict: "observer_site_id,device_reference_hash" }).select("id,device_label,platform,active,last_seen_at").single();
      if (result.error?.message?.includes("DIGITAL_OBSERVER_DEVICE_LIMIT_REACHED")) return fail("אפשר לחבר עד שני מכשירים. יש להסיר מכשיר קיים לפני הוספת מכשיר נוסף.", 409);
      if (result.error) return fail("לא ניתן לרשום את המכשיר.", 400);
      return ok({ device: result.data, message: pushTokenRegistered ? "המכשיר נרשם עם טוקן Push פעיל." : "המכשיר נשמר, אך לא נמצא עבורו טוקן Push פעיל." });
    }

    const table = payload.action === "delete_recipient" ? "digital_observer_authorized_recipients" : "digital_observer_device_slots";
    const existing = await supabase.from(table as any).select("id,observer_site_id").eq("id", payload.id).maybeSingle();
    if (!existing.data?.observer_site_id) return fail("הרשומה לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, profile, existing.data.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה להסיר את הרשומה.", 403);
    const result = payload.action === "delete_recipient"
      ? await supabase.from(table as any).delete().eq("id", payload.id)
      : await supabase.from(table as any).update({ active: false, updated_at: new Date().toISOString() }).eq("id", payload.id);
    if (result.error) return fail("לא ניתן להסיר את הרשומה.", 400);
    return ok({ removed: true, message: payload.action === "delete_recipient" ? "מורשה העדכונים הוסר." : "המכשיר נותק." });
  } catch (error) {
    if (error instanceof Error && error.message === "DEVICE_HASH_CONFIGURATION_REQUIRED") return fail("חסרה הגדרת הצפנה בצד השרת לרישום מכשיר.", 503);
    return handleRouteError(error);
  }
}
