/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { dispatchQueuedDelivery, queueAuthorizedDelivery } from "@/lib/domain/digital-observer/notification-delivery-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({ observer_site_id: z.string().uuid(), action_intent_id: z.string().uuid(), recipient_profile_id: z.string().uuid(),
  channel: z.enum(["in_app", "push", "email", "sms", "whatsapp", "webhook", "phone"]),
  severity: z.enum(["info", "low", "medium", "high", "critical"]), priority: z.number().int().min(0).max(10).default(5),
  title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(500),
  product_path: z.string().trim().max(300).nullable().optional(), ttl_seconds: z.number().int().min(60).max(86400).default(3600),
  dispatch_sandbox: z.boolean().default(false), sandbox_behavior: z.enum(["success", "timeout", "rate_limit", "temporary_failure", "permanent_failure", "unknown_outcome"]).optional()
}).strict();

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const siteId = new URL(request.url).searchParams.get("observer_site_id");
    if (!siteId || !z.string().uuid().safeParse(siteId).success) return fail("A valid Site is required.", 400);
    const site = await getObserverSiteAccess(session.supabase, session.profile, siteId);
    if (!site) return fail("The Site is unavailable.", 403);
    const data = await session.supabase.from("digital_observer_notification_deliveries" as any)
      .select("id,action_intent_id,recipient_profile_id,channel,severity,priority,provider_mode,delivery_status,attempt_count,max_attempts,sent_at,acknowledged_at,failure_reason,expires_at,unknown_outcome_at,dead_lettered_at,created_at")
      .eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(100);
    if (data.error) return fail("Delivery history is unavailable.", 503);
    return ok({ deliveries: data.data ?? [] });
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const input = schema.parse(await request.json());
    const site = await getObserverSiteAccess(session.supabase, session.profile, input.observer_site_id, { manage: true });
    if (!site) return fail("The Site is unavailable or not manageable by this user.", 403);
    const admin = createAdminClient() as any;
    const queued = await queueAuthorizedDelivery(admin, { actionIntentId: input.action_intent_id, observerSiteId: input.observer_site_id,
      recipientProfileId: input.recipient_profile_id, channel: input.channel, severity: input.severity, priority: input.priority,
      title: input.title, body: input.body, productPath: input.product_path, ttlSeconds: input.ttl_seconds });
    if (!input.dispatch_sandbox || queued.duplicate || queued.delivery.delivery_status !== "queued") return ok({ ...queued, dispatched: false }, queued.duplicate ? 200 : 201);
    if (!["sandbox", "mock"].includes(queued.delivery.provider_mode) && input.channel !== "in_app") return fail("Only a configured sandbox provider may be dispatched by this endpoint.", 409);
    const dispatched = await dispatchQueuedDelivery(admin, { deliveryId: queued.delivery.id, sandboxBehavior: input.sandbox_behavior });
    return ok({ ...queued, dispatched }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DELIVERY_")) return fail(error.message, error.message.includes("DENIED") ? 403 : 409);
    return handleRouteError(error);
  }
}
