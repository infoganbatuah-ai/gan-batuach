import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { createClient } from "@/lib/supabase/server";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_set"), policy_key: z.string().trim().min(3).max(100), name: z.string().trim().min(2).max(160), jurisdiction: z.string().trim().min(2).max(40).default("IL"), program_type: z.string().trim().max(80).optional().nullable(), description: z.string().trim().max(1000).optional().nullable() }),
  z.object({ action: z.literal("create_version"), policy_set_id: z.string().uuid(), effective_from: z.string().date().optional().nullable(), effective_until: z.string().date().optional().nullable(), source_title: z.string().trim().max(240).optional().nullable(), source_reference: z.string().trim().max(500).optional().nullable(), notes: z.string().trim().max(2000).optional().nullable() }),
  z.object({ action: z.literal("update_draft"), version_id: z.string().uuid(), effective_from: z.string().date().optional().nullable(), effective_until: z.string().date().optional().nullable(), source_title: z.string().trim().max(240).optional().nullable(), source_reference: z.string().trim().max(500).optional().nullable(), notes: z.string().trim().max(2000).optional().nullable(), status: z.enum(["draft","under_review"]).optional() }),
  z.object({ action: z.literal("add_rule"), version_id: z.string().uuid(), rule_key: z.string().trim().min(2).max(100), age_group_key: z.string().trim().max(80).optional().nullable(), min_age_months: z.number().int().min(0).max(240).optional().nullable(), max_age_months: z.number().int().min(0).max(240).optional().nullable(), child_count_from: z.number().int().min(0).default(1), child_count_until: z.number().int().min(0).optional().nullable(), children_per_staff: z.number().positive().max(10000), minimum_staff: z.number().int().min(0).max(1000).default(1), staff_qualification_key: z.string().trim().max(100).optional().nullable(), notes: z.string().trim().max(1000).optional().nullable() }),
  z.object({ action: z.literal("approve"), version_id: z.string().uuid() }),
  z.object({ action: z.literal("activate"), version_id: z.string().uuid() }),
  z.object({ action: z.literal("retire"), version_id: z.string().uuid() })
]);

export async function GET() {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const { data, error } = await supabase.from("staffing_policy_sets" as never).select("*, staffing_policy_versions(*, staffing_policy_rules(*))").order("created_at", { ascending: false });
    if (error) return fail("לא ניתן לטעון את מדיניות כוח האדם", 503);
    return ok({ policy_sets: data ?? [] });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = mutation.parse(await request.json());
    const supabase = await createClient();
    let result: { data: unknown; error: { code?: string; message: string } | null };
    const eventType = `staffing_policy_${payload.action}`;
    if (payload.action === "create_set") {
      result = await supabase.from("staffing_policy_sets" as never).insert({ policy_key: payload.policy_key, name: payload.name, jurisdiction: payload.jurisdiction, program_type: payload.program_type, description: payload.description, created_by: profile.id } as never).select("*").single() as never;
    } else if (payload.action === "create_version") {
      const latest = await supabase.from("staffing_policy_versions" as never).select("version").eq("policy_set_id", payload.policy_set_id).order("version", { ascending: false }).limit(1).maybeSingle();
      result = await supabase.from("staffing_policy_versions" as never).insert({ policy_set_id: payload.policy_set_id, effective_from: payload.effective_from, effective_until: payload.effective_until, source_title: payload.source_title, source_reference: payload.source_reference, notes: payload.notes, version: Number((latest.data as { version?: number } | null)?.version ?? 0) + 1, status: "draft", provenance_status: payload.source_reference ? "source_recorded" : "unverified", created_by: profile.id } as never).select("*").single() as never;
    } else if (payload.action === "update_draft") {
      const existing = await supabase.from("staffing_policy_versions" as never).select("status").eq("id", payload.version_id).maybeSingle();
      if (!existing.data || !["draft","under_review"].includes(String((existing.data as { status: string }).status))) return fail("רק טיוטה ניתנת לעריכה", 409);
      result = await supabase.from("staffing_policy_versions" as never).update({ effective_from: payload.effective_from, effective_until: payload.effective_until, source_title: payload.source_title, source_reference: payload.source_reference, notes: payload.notes, status: payload.status, provenance_status: payload.source_reference ? "source_recorded" : undefined, updated_at: new Date().toISOString() } as never).eq("id", payload.version_id).select("*").single() as never;
    } else if (payload.action === "add_rule") {
      const version = await supabase.from("staffing_policy_versions" as never).select("status").eq("id", payload.version_id).maybeSingle();
      if (!version.data || !["draft","under_review"].includes(String((version.data as { status: string }).status))) return fail("ניתן לערוך כללים רק בטיוטה", 409);
      result = await supabase.from("staffing_policy_rules" as never).upsert({ policy_version_id: payload.version_id, rule_key: payload.rule_key, age_group_key: payload.age_group_key, min_age_months: payload.min_age_months, max_age_months: payload.max_age_months, child_count_from: payload.child_count_from, child_count_until: payload.child_count_until, children_per_staff: payload.children_per_staff, minimum_staff: payload.minimum_staff, staff_qualification_key: payload.staff_qualification_key, notes: payload.notes } as never, { onConflict: "policy_version_id,rule_key" }).select("*").single() as never;
    } else if (payload.action === "approve") {
      const version = await supabase.from("staffing_policy_versions" as never).select("source_title,source_reference,status").eq("id", payload.version_id).maybeSingle();
      const current = version.data as { source_title?: string; source_reference?: string; status?: string } | null;
      if (!current?.source_title || !current.source_reference || !["draft","under_review"].includes(String(current.status))) return fail("אישור דורש מקור מתועד וגרסה בטיוטה או בבדיקה", 422);
      result = await supabase.from("staffing_policy_versions" as never).update({ status: "approved", provenance_status: "approved", reviewed_by: profile.id, reviewed_at: new Date().toISOString(), approved_by: profile.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", payload.version_id).select("*").single() as never;
    } else {
      const rpc = payload.action === "activate" ? "activate_staffing_policy_version" : "retire_staffing_policy_version";
      result = await supabase.rpc(rpc as never, { target_version_id: payload.version_id } as never) as never;
    }
    if (result.error) return fail(result.error.message.includes("conflict") ? "קיימת התנגשות בטווחי התוקף" : "לא ניתן לעדכן את המדיניות", result.error.code === "42501" ? 403 : 409);
    const target = result.data as { id?: string; version?: number } | null;
    await writeAdminActionEvent({ eventType, actorProfileId: profile.id, actorRole: "admin", targetType: "staffing_policy", targetId: target?.id ?? ("version_id" in payload ? payload.version_id : null), riskLevel: "medium", metadata: { version: target?.version ?? null } });
    return ok(result.data, payload.action.startsWith("create") ? 201 : 200);
  } catch (error) { return handleSafeRouteError(error); }
}
