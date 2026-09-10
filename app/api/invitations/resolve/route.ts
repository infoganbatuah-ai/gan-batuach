import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { resolveSignedInvitation } from "@/lib/management/signed-invitation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.string().min(40).max(2048);

function maskEmail(value?: string | null) {
  if (!value) return null;
  const [name, domain] = value.split("@");
  return domain ? `${name.slice(0, 1)}***@${domain}` : null;
}

export async function GET(request: Request) {
  try {
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין כרגע.", 503);
    const token = schema.parse(new URL(request.url).searchParams.get("token"));
    const resolved = await resolveSignedInvitation(createAdminClient(), token);
    if (!resolved.ok) return fail(resolved.reason === "expired" ? "תוקף ההזמנה פג." : "ההזמנה אינה זמינה.", 410);
    const row = resolved.invitation as unknown as {
      id: string;
      invitation_type: string;
      intended_role: string;
      recipient_email: string | null;
      expires_at: string;
      gardens: { name: string }[] | null;
    };
    return ok({
      id: row.id,
      invitation_type: row.invitation_type,
      intended_role: row.intended_role,
      garden_name: row.gardens?.[0]?.name ?? null,
      recipient: maskEmail(row.recipient_email),
      expires_at: row.expires_at
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
