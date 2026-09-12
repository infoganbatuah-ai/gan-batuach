import { getEmailProvider } from "@/lib/domain/email-provider";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function deliverSignedInvitation(admin: AdminClient, input: {
  invitationId: string;
  email: string;
  recipientName: string;
  gardenId: string;
  gardenName: string;
  targetProfileId?: string | null;
  url: string;
}) {
  const provider = getEmailProvider();
  const result = await provider.send({
    to: input.email,
    subject: `הזמנה ל${input.gardenName}`,
    text: `שלום ${input.recipientName}, הוזמנת להצטרף ל${input.gardenName}. הקישור האישי תקף לזמן מוגבל: ${input.url}`,
    html: `<p>שלום ${escapeHtml(input.recipientName)},</p><p>הוזמנת להצטרף ל${escapeHtml(input.gardenName)}.</p><p><a href="${escapeHtml(input.url)}">פתיחת ההזמנה</a></p>`,
    category: "invitation",
    metadata: { invitation_id: input.invitationId }
  });
  const status = result.status === "sent" ? "delivered" : "pending";
  await Promise.all([
    admin.from("management_invitations").update({
      status,
      delivery_metadata: { provider: result.provider, provider_message_id: result.providerMessageId ?? null, status: result.status },
      updated_at: new Date().toISOString()
    }).eq("id", input.invitationId),
    admin.from("email_delivery_logs").insert({
      recipient_profile_id: input.targetProfileId ?? null,
      kindergarten_id: input.gardenId,
      category: "invitation",
      recipient_email: input.email,
      subject_preview: `הזמנה ל${input.gardenName}`.slice(0, 200),
      message_preview: result.status === "sent" ? "קישור הזמנה אישי נשלח דרך ספק ההודעות." : "קישור הזמנה אישי נוצר; מסירה חיצונית טרם אומתה.",
      status: result.status,
      provider: result.provider,
      provider_message_id: result.providerMessageId ?? null,
      provider_reference: result.providerReference ?? null,
      failure_reason: result.failureReason ?? null,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      failed_at: result.status === "failed" ? new Date().toISOString() : null,
      metadata: { invitation_id: input.invitationId, contains_secret: false, dry_run_payload: result.dryRunPayload ?? null }
    })
  ]);
  return { status: result.status, provider: result.provider };
}
