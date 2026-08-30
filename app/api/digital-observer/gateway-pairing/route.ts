import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { gatewayPairingCodeTtlMs, hashGatewayPairingCode, issueGatewayDiscoveryToken, newGatewayPairingCode } from "@/lib/domain/video-gateway-pairing";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), observer_site_id: z.string().uuid() }),
  z.object({ action: z.literal("claim"), pairing_id: z.string().uuid(), pairing_code: z.string().min(32).max(128), gateway_id: z.string().uuid() })
]);

function secret() {
  return process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
}

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    if (!secret()) return fail("שירות ה-pairing אינו מוגדר.", 503);

    if (payload.action === "create") {
      const session = await getDigitalObserverApiUser(request);
      if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
      const site = await getObserverSiteAccess(session.supabase as any, session.profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה לחבר Gateway לאתר הזה.", 403);

      const pairingId = randomUUID();
      const pairingCode = newGatewayPairingCode();
      const expiresAt = new Date(Date.now() + gatewayPairingCodeTtlMs).toISOString();
      const event = await (createAdminClient() as any).from("provider_webhook_events").insert({
        webhook_key: "digital_observer_gateway_pairing",
        integration_type: "camera_gateway",
        provider: "digital_observer",
        event_type: "gateway_pairing",
        event_id: pairingId,
        idempotency_key: pairingId,
        signature_valid: true,
        replay_detected: false,
        status: "received",
        related_entity_type: "observer_sites",
        related_entity_id: site.id,
        raw_payload_reference: null,
        metadata: { pairing_code_hash: hashGatewayPairingCode(pairingCode), expires_at: expiresAt, created_by_profile_id: session.profile.id, one_time: true, no_credentials_received: true }
      }).select("id").single();
      if (event.error) throw new Error(event.error.message);
      return ok({ pairing_id: pairingId, pairing_code: pairingCode, expires_at: expiresAt, gateway_url: "http://127.0.0.1:18180", one_time: true }, 201);
    }

    const admin = createAdminClient() as any;
    const lookup = await admin.from("provider_webhook_events").select("id,status,related_entity_id,metadata").eq("webhook_key", "digital_observer_gateway_pairing").eq("event_id", payload.pairing_id).maybeSingle();
    const record = lookup.data;
    const metadata = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const expired = !metadata.expires_at || Date.parse(String(metadata.expires_at)) <= Date.now();
    if (!record || record.status !== "received" || expired || metadata.pairing_code_hash !== hashGatewayPairingCode(payload.pairing_code)) return fail("קוד pairing אינו תקף או שפג תוקפו.", 401);

    const token = issueGatewayDiscoveryToken({ pairing_id: payload.pairing_id, gateway_id: payload.gateway_id, observer_site_id: String(record.related_entity_id) }, secret());
    const { pairing_code_hash: _pairingCodeHash, ...claimedMetadata } = metadata;
    const updated = await admin.from("provider_webhook_events").update({ status: "processed", processed_at: new Date().toISOString(), metadata: { ...claimedMetadata, claimed_gateway_id: payload.gateway_id, claimed_at: new Date().toISOString() } }).eq("id", record.id).eq("status", "received").select("id").maybeSingle();
    if (!updated.data) return fail("קוד pairing כבר נוצל.", 409);
    return ok({ gateway_id: payload.gateway_id, observer_site_id: record.related_entity_id, discovery_token: token, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), scope: "cloud_discovery" });
  } catch (error) {
    return handleRouteError(error);
  }
}
