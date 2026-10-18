/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ observer_site_id: z.string().uuid(), channel: z.enum(["push", "email", "sms", "whatsapp", "webhook", "phone"]), mode: z.enum(["disabled", "sandbox"]) }).strict();

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const input = schema.parse(await request.json());
    const site = await getObserverSiteAccess(session.supabase, session.profile, input.observer_site_id, { manage: true });
    if (!site) return fail("The Site is unavailable or not manageable by this user.", 403);
    const admin = createAdminClient() as any;
    const enabled = input.mode === "sandbox";
    const update = await admin.from("digital_observer_provider_channels").upsert({
      observer_site_id: input.observer_site_id, channel: input.channel,
      provider_key: enabled ? `digital-observer-sandbox-${input.channel}` : "unconfigured",
      provider_mode: input.mode, active: enabled, configuration_status: enabled ? "ready" : "not_configured",
      credential_reference: null, last_health_status: enabled ? "sandbox_contract_only" : "unknown",
      metadata: { production_activation_authorized: false, paid_provider_enabled: false }
    }, { onConflict: "observer_site_id,channel" }).select("id,channel,provider_key,provider_mode,active,configuration_status,last_health_status").single();
    if (update.error) return fail("The provider channel could not be updated.", 503);
    await admin.from("digital_observer_action_audit").insert({ observer_site_id: input.observer_site_id,
      actor_profile_id: session.profile.id, event_type: "provider_channel_mode_changed", result_status: "allowed",
      reason_code: enabled ? "deterministic_sandbox_enabled" : "provider_disabled",
      safe_metadata: { channel: input.channel, mode: input.mode, production_activation_authorized: false } });
    return ok({ channel: update.data, external_provider_contacted: false });
  } catch (error) { return handleRouteError(error); }
}
