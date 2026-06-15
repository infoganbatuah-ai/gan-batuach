import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { hashForLookup } from "@/lib/security/field-encryption";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  full_name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  city: z.string().optional(),
  preferred_regions: z.array(z.string().min(2)).default([]),
  experience_summary: z.string().optional(),
  identity_number: z.string().optional(),
  documents: z.record(z.string(), z.unknown()).optional(),
  submit: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["inspector"]);
    if (!isAdminClientConfigured()) return fail("הגשת בקשת מפקח דורשת Service Role בצד השרת.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const duplicateFlags: string[] = [];
    const identityNumber = payload.identity_number?.replace(/\D/g, "") ?? "";
    if (identityNumber) {
      const existing = await admin.from("inspectors" as any).select("id", { count: "exact", head: true }).eq("identity_number_hash", hashForLookup(identityNumber));
      if ((existing.count ?? 0) > 0) duplicateFlags.push("inspector_identity_number_match");
    }

    const status = payload.submit ? "submitted" : "draft";
    const application = await admin.from("inspector_applications" as any).upsert({
      profile_id: profile.id,
      full_name: payload.full_name,
      phone: payload.phone ?? profile.phone ?? null,
      email: payload.email ?? (profile as any).email ?? null,
      city: payload.city ?? null,
      preferred_regions: payload.preferred_regions,
      experience_summary: payload.experience_summary ?? null,
      documents: payload.documents ?? {},
      status,
      submitted_at: payload.submit ? new Date().toISOString() : null,
      duplicate_flags: duplicateFlags,
      metadata: { identity_number_hash: identityNumber ? hashForLookup(identityNumber) : null }
    }, { onConflict: "profile_id" }).select("*").single();
    if (application.error) return fail(application.error.message, 400);

    await admin.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "inspector",
      entity_type: "inspector_applications",
      entity_id: application.data.id,
      action: payload.submit ? "inspector_application_submitted" : "inspector_application_saved",
      after_data: { status, duplicate_flags: duplicateFlags }
    });

    return ok({ application: application.data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
