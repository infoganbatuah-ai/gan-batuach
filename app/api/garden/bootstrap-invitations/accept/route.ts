import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { hashInvitationToken, resolveSignedInvitation, verifySignedToken } from "@/lib/management/signed-invitation";

const schema = z.object({ token: z.string().min(40).max(2048), accept: z.boolean().default(true) });

export async function POST(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות.", 401);
    if (!["owner", "manager"].includes(profile.role)) return fail("החשבון אינו מתאים להזמנת ניהול גן.", 403);
    if (!isAdminClientConfigured()) return fail("שירות ההזמנות אינו זמין.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const parsed = verifySignedToken(payload.token);
    if (!parsed) return fail("ההזמנה אינה זמינה.", 410);
    const resolved = await resolveSignedInvitation(admin, payload.token);
    if (!resolved.ok) {
      if (resolved.reason === "accepted" && payload.accept) {
        const existing = await admin.from("management_invitations" as never)
          .select("garden_id,accepted_by,token_hash,invitation_type,payload")
          .eq("id", parsed.id).maybeSingle();
        const accepted = existing.data as { garden_id: string; accepted_by: string; token_hash: string; invitation_type: string; payload: { source?: string } } | null;
        if (accepted && accepted.accepted_by === profile.id && accepted.token_hash === hashInvitationToken(payload.token)
          && accepted.invitation_type === "garden_management" && accepted.payload?.source === "inspector_preliminary") {
          return ok({ status: "accepted", already_accepted: true,
            next_path: `/onboarding/kindergarten?gardenId=${accepted.garden_id}` });
        }
      }
      return fail("ההזמנה אינה זמינה.", 410);
    }
    const invitation = resolved.invitation;
    if (invitation.invitation_type !== "garden_management" || invitation.payload?.source !== "inspector_preliminary")
      return fail("סוג ההזמנה אינו מתאים לתהליך זה.", 403);
    const expectedRole = invitation.intended_role === "kindergarten_owner" ? "owner" : "manager";
    if (profile.role !== expectedRole) return fail("תפקיד החשבון אינו תואם להזמנה.", 403);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("accept_inspector_garden_invitation" as never, {
      p_invitation_id: invitation.id,
      p_token_hash: hashInvitationToken(payload.token),
      p_accept: payload.accept
    } as never);
    if (error) return fail(error.code === "42501" ? "ההזמנה אינה זמינה לחשבון זה." : "לא ניתן לעדכן את ההזמנה.", error.code === "42501" ? 403 : 409);
    const result = data as { garden_id: string; status: string; already_accepted?: boolean };
    return ok({ ...result, next_path: payload.accept ? `/onboarding/kindergarten?gardenId=${result.garden_id}` : null });
  } catch (error) { return handleSafeRouteError(error); }
}
