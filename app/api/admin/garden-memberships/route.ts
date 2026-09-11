import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant"), profile_id: z.string().uuid(), garden_id: z.string().uuid(), relationship_role: z.enum(["owner", "manager"]), make_default: z.boolean().default(false) }),
  z.object({ action: z.literal("revoke"), membership_id: z.string().uuid() }),
  z.object({ action: z.literal("activate"), membership_id: z.string().uuid() }),
  z.object({ action: z.literal("make_default"), membership_id: z.string().uuid() })
]);

type Membership = { id: string; profile_id: string; garden_id: string; relationship_role: "owner" | "manager"; status: string };
type MembershipResult = { data: Membership | null; error: { message?: string } | null };

export async function POST(request: Request) {
  try {
    const { profile: actor } = await requireRole(["admin"]);
    if (!isAdminClientConfigured()) return fail("שירות ניהול החברויות אינו זמין כרגע.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();
    let membership: Membership | null = null;

    if (payload.action === "grant") {
      const [{ data: targetProfile }, { data: garden }] = await Promise.all([
        admin.from("profiles" as never).select("id, role, active").eq("id", payload.profile_id).maybeSingle(),
        admin.from("gardens" as never).select("id").eq("id", payload.garden_id).maybeSingle()
      ]);
      if (!targetProfile || !garden) return fail("המשתמש או הגן לא נמצאו.", 404);
      const target = targetProfile as unknown as { id: string; role: string; active: boolean };
      if (!target.active || target.role !== payload.relationship_role) return fail("תפקיד המשתמש אינו תואם לחברות המבוקשת.", 409);
      if (payload.make_default) await admin.from("garden_management_memberships" as never).update({ is_default: false }).eq("profile_id", payload.profile_id).eq("status", "active");
      const result = await admin.from("garden_management_memberships" as never).upsert({
        profile_id: payload.profile_id, garden_id: payload.garden_id, relationship_role: payload.relationship_role,
        status: "active", is_default: payload.make_default, source: "admin", activated_at: now, ended_at: null, granted_by: actor.id, revoked_by: null
      }, { onConflict: "profile_id,garden_id,relationship_role" }).select("id, profile_id, garden_id, relationship_role, status").single() as unknown as MembershipResult;
      if (result.error || !result.data) return fail("שמירת החברות נכשלה.", 409);
      membership = result.data;
    } else {
      const existing = await admin.from("garden_management_memberships" as never).select("id, profile_id, garden_id, relationship_role, status").eq("id", payload.membership_id).maybeSingle() as unknown as MembershipResult;
      if (existing.error || !existing.data) return fail("החברות לא נמצאה.", 404);
      membership = existing.data;
      if (payload.action === "make_default") {
        if (membership.status !== "active") return fail("אפשר לבחור כברירת מחדל רק חברות פעילה.", 409);
        await admin.from("garden_management_memberships" as never).update({ is_default: false }).eq("profile_id", membership.profile_id).eq("status", "active");
        const update = await admin.from("garden_management_memberships" as never).update({ is_default: true, updated_at: now }).eq("id", membership.id);
        if (update.error) return fail("עדכון ברירת המחדל נכשל.", 409);
      } else {
        const active = payload.action === "activate";
        const update = await admin.from("garden_management_memberships" as never).update({
          status: active ? "active" : "revoked", is_default: false,
          activated_at: active ? now : membership.status === "active" ? now : null,
          ended_at: active ? null : now, revoked_by: active ? null : actor.id, updated_at: now
        }).eq("id", membership.id);
        if (update.error) return fail("עדכון החברות נכשל.", 409);
      }
    }

    await writeAdminActionEvent({ eventType: `garden_membership_${payload.action}`, actorProfileId: actor.id, actorRole: actor.role, targetType: "garden_management_membership", targetId: membership.id, gardenId: membership.garden_id, metadata: { relationship_role: membership.relationship_role } });
    return ok({ membership_id: membership.id, action: payload.action });
  } catch (error) { return handleSafeRouteError(error); }
}
