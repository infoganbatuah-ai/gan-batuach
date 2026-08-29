import { Resend, type WebhookEventPayload } from "resend";
import { fail, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type DeliveryUpdate = {
  status?: "queued" | "sent" | "delivered" | "opened" | "clicked" | "failed";
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  clicked_at?: string;
  failed_at?: string;
  failure_reason?: string | null;
  provider_reference?: string;
  next_retry_at?: string | null;
  updated_at: string;
};

function isEmailEvent(event: WebhookEventPayload) {
  return event.type.startsWith("email.") && event.type !== "email.received";
}

function updateForEvent(event: WebhookEventPayload): DeliveryUpdate {
  const occurredAt = event.created_at;
  const base = { updated_at: new Date().toISOString() };

  switch (event.type) {
    case "email.scheduled":
      return { ...base, status: "queued", provider_reference: "resend_scheduled" };
    case "email.sent":
      return { ...base, status: "sent", sent_at: occurredAt, failure_reason: null, next_retry_at: null };
    case "email.delivered":
      return { ...base, status: "delivered", delivered_at: occurredAt, failure_reason: null, next_retry_at: null };
    case "email.opened":
      return { ...base, status: "opened", opened_at: occurredAt };
    case "email.clicked":
      return { ...base, status: "clicked", clicked_at: occurredAt };
    case "email.delivery_delayed":
      return { ...base, status: "sent", provider_reference: "resend_delivery_delayed" };
    case "email.bounced":
      return { ...base, status: "failed", failed_at: occurredAt, failure_reason: event.data.bounce.message || "Email bounced.", next_retry_at: null };
    case "email.failed":
      return { ...base, status: "failed", failed_at: occurredAt, failure_reason: event.data.failed.reason || "Email delivery failed.", next_retry_at: null };
    case "email.suppressed":
      return { ...base, status: "failed", failed_at: occurredAt, failure_reason: event.data.suppressed.message || "Recipient is suppressed.", next_retry_at: null };
    case "email.complained":
      return { ...base, status: "failed", failed_at: occurredAt, failure_reason: "Recipient reported the email as spam.", next_retry_at: null };
    default:
      return base;
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) return fail("Resend webhook is not configured.", 503);

  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return fail("Missing webhook signature headers.", 401);

  let event: WebhookEventPayload;
  try {
    event = new Resend(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY).webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret
    });
  } catch {
    return fail("Invalid webhook signature.", 401);
  }

  if (!isEmailEvent(event)) return ok({ accepted: true, ignored: true });

  const emailEvent = event as Extract<WebhookEventPayload, { type: `email.${string}` }>;
  const messageId = "email_id" in emailEvent.data ? emailEvent.data.email_id : null;
  if (!messageId) return ok({ accepted: true, ignored: true });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_delivery_logs")
    .update(updateForEvent(event))
    .eq("provider", "resend")
    .eq("provider_message_id", messageId)
    .select("id")
    .maybeSingle();

  if (error) return fail("Could not update email delivery status.", 500);
  return ok({ accepted: true, matched: Boolean(data) });
}
