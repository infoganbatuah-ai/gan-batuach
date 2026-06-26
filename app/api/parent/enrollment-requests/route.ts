import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  child_profile_id: z.string().uuid(),
  garden_id: z.string().uuid(),
  requested_age_group: z.string().optional(),
  requested_class_id: z.string().uuid().optional(),
  parent_message: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    if (!isAdminClientConfigured()) return fail("שליחת בקשת הצטרפות דורשת Service Role בצד השרת.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const child = await admin.from("permanent_child_files" as any)
      .select("id, primary_parent_profile_id, full_name, duplicate_flags")
      .eq("id", payload.child_profile_id)
      .eq("primary_parent_profile_id", profile.id)
      .maybeSingle();
    if (child.error || !child.data) return fail("כרטיס הילד לא נמצא או אינו שייך לחשבון שלך.", 403);

    const garden = await admin.from("gardens" as any)
      .select("id, name, city, status, public_profile_enabled, activation_payment_status, frozen_at")
      .eq("id", payload.garden_id)
      .maybeSingle();
    if (garden.error || !garden.data) return fail("הגן לא נמצא.", 404);
    if ((garden.data as any).status !== "active" || ["frozen", "suspended", "failed"].includes(String((garden.data as any).activation_payment_status))) {
      return fail("לא ניתן לשלוח בקשת הצטרפות לגן שאינו פעיל או מוקפא להסדרת תשלום.", 409);
    }

    let price: number | null = null;
    if (payload.requested_class_id) {
      const group = await admin.from("kindergarten_fee_groups" as any)
        .select("id, monthly_fee, active, show_price_public")
        .eq("id", payload.requested_class_id)
        .eq("garden_id", payload.garden_id)
        .maybeSingle();
      if (group.data?.show_price_public) price = Number(group.data.monthly_fee ?? 0);
    }

    const now = new Date().toISOString();
    const requestWrite = await admin.from("kindergarten_enrollment_requests" as any).upsert({
      parent_id: profile.id,
      child_profile_id: payload.child_profile_id,
      garden_id: payload.garden_id,
      requested_age_group: payload.requested_age_group ?? null,
      requested_class_id: payload.requested_class_id ?? null,
      published_price_snapshot: price,
      parent_message: payload.parent_message ?? null,
      status: "submitted",
      requested_at: now,
      payment_required: true,
      payment_status: "not_requested",
      duplicate_flags: (child.data as any).duplicate_flags ?? [],
      metadata: { source: "parent_self_service" }
    }, { onConflict: "parent_id,child_profile_id,garden_id" }).select("*").single();
    if (requestWrite.error) return fail(requestWrite.error.message, 400);

    await Promise.all([
      admin.from("user_affiliation_requests" as any).insert({
        requester_id: profile.id,
        target_type: "kindergarten",
        target_id: payload.garden_id,
        request_type: "parent_to_kindergarten",
        status: "submitted",
        metadata: { enrollment_request_id: requestWrite.data.id, child_profile_id: payload.child_profile_id }
      }),
      admin.from("notifications" as any).insert({
        garden_id: payload.garden_id,
        recipient_id: (garden.data as any).manager_id ?? null,
        recipient_role: "manager",
        title: "בקשת הצטרפות חדשה",
        body: `${profile.full_name} הגיש/ה בקשת הצטרפות לילד/ה ${(child.data as any).full_name}.`,
        message: `${profile.full_name} הגיש/ה בקשת הצטרפות לילד/ה ${(child.data as any).full_name}.`,
        entity_type: "kindergarten_enrollment_requests",
        entity_id: requestWrite.data.id,
        severity: "medium",
        action_url: "/dashboard/garden/enrollment-requests",
        recipient_profile_id: (garden.data as any).manager_id ?? null,
        kindergarten_id: payload.garden_id,
        created_by: profile.id
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: "parent",
        garden_id: payload.garden_id,
        entity_type: "kindergarten_enrollment_requests",
        entity_id: requestWrite.data.id,
        action: "enrollment_request_submitted",
        after_data: { status: "submitted", payment_required: true }
      })
    ]);

    return ok({ enrollment_request: requestWrite.data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
