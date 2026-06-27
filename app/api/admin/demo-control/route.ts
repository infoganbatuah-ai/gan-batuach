import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["load_demo_data", "reset_demo_data", "delete_demo_data", "create_sample_inspection", "create_sample_complaint", "create_sample_ai_event", "create_sample_late_inspection", "create_sample_camera_issue"])
});

const demoBatchId = process.env.DEMO_BATCH_ID || "demo-control-current";
const demoPrefix = "[DEMO]";
const demoName = (name: string) => name.startsWith(demoPrefix) ? name : `${demoPrefix} ${name}`;
const demoRow = <T extends Record<string, unknown>>(row: T) => ({ ...row, is_demo: true, demo_batch_id: demoBatchId });
const demoTables = ["parent_camera_permissions", "stream_health_checks", "ai_events", "camera_streams", "inspection_signatures", "inspection_answers", "violations", "inspections", "required_inspections", "late_inspections", "child_daily_journals", "child_health_records", "pickup_confirmations", "attendance", "incident_reports", "complaints", "messages", "notifications", "documents", "tasks", "leads", "policy_acceptances", "inspection_form_questions", "inspection_forms", "generated_credentials", "inspectors", "gardens", "audit_logs"];

function demoDeleteQuery(supabase: ReturnType<typeof createAdminClient>, table: string, batchId?: string | null) {
  const query = supabase.from(table as any).delete().eq("is_demo", true);
  return batchId ? query.eq("demo_batch_id", batchId) : query;
}

async function getDemoGarden(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase.from("gardens" as any).select("*").eq("is_demo", true).eq("demo_batch_id", demoBatchId).limit(1).maybeSingle();
  if (data) return data as any;
  const { data: garden, error } = await supabase.from("gardens" as any).insert(demoRow({
    name: demoName("גן בדיקה מהירה"),
    city: "רמת גן",
    address: "רחוב הדגמה 10",
    status: "active",
    safe_status: "pending_review",
    public_profile_enabled: true,
    children_capacity: 24,
    current_children_count: 6,
    staff_count: 3,
    inspection_required_status: "pending_first_inspection",
    logo_url: "https://api.dicebear.com/8.x/initials/svg?seed=גן%20בדיקה%20מהירה"
  })).select("*").single();
  if (error) throw error;
  return garden as any;
}

async function ensureForm(supabase: ReturnType<typeof createAdminClient>, adminId: string) {
  const { data: existing } = await supabase.from("inspection_forms" as any).select("*").eq("is_demo", true).eq("demo_batch_id", demoBatchId).eq("name", demoName("טופס פיקוח דמו מהיר")).maybeSingle();
  if (existing) return existing as any;
  const { data: form, error } = await supabase.from("inspection_forms" as any).insert(demoRow({ name: demoName("טופס פיקוח דמו מהיר"), description: "טופס בדיקה קצר ל-QA", framework_type: "mixed", active: true, created_by: adminId })).select("*").single();
  if (error) throw error;
  await supabase.from("inspection_form_questions" as any).insert([
    { form_id: form.id, category: "בטיחות", question_text: "האם אזור הכיתה נקי ממפגעים?", weight: 1.5, critical: true, requires_photo: true, sort_order: 1 },
    { form_id: form.id, category: "מסמכים", question_text: "האם מסמכי הגן זמינים ובתוקף?", weight: 1, critical: false, sort_order: 2 },
    { form_id: form.id, category: "מצלמות", question_text: "האם המצלמות מוגדרות ללא חשיפת DVR ישיר?", weight: 1, critical: true, sort_order: 3 }
  ].map(demoRow));
  return form as any;
}

async function countDemoRecords(supabase: ReturnType<typeof createAdminClient>) {
  let total = 0;
  const byTable: Record<string, number> = {};
  for (const table of demoTables) {
    const { count } = await supabase.from(table as any).select("id", { count: "exact", head: true }).eq("is_demo", true);
    byTable[table] = count ?? 0;
    total += count ?? 0;
  }
  return { total, byTable };
}

async function resetDemoData(supabase: ReturnType<typeof createAdminClient>, batchId?: string | null) {
  const { data: demoProfiles } = await supabase.from("profiles" as any).select("id").eq("is_demo", true).match(batchId ? { demo_batch_id: batchId } : {});
  for (const table of demoTables) await demoDeleteQuery(supabase, table, batchId);
  for (const profile of demoProfiles ?? []) await supabase.auth.admin.deleteUser((profile as any).id);
  return { removed_profiles: demoProfiles?.length ?? 0 };
}

export async function GET() {
  try {
    await requireRole(["admin"]);
    if (!isAdminClientConfigured()) return ok({ configured: false, demo_batch_id: demoBatchId, demo_records: 0, by_table: {} });
    const supabase = createAdminClient();
    const counts = await countDemoRecords(supabase);
    return ok({ configured: true, demo_batch_id: demoBatchId, demo_records: counts.total, by_table: counts.byTable });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    if (!isAdminClientConfigured()) return fail("SUPABASE_SERVICE_ROLE_KEY חסר. פעולות דמו דורשות Service Role בצד שרת.", 503);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();

    if (payload.action === "reset_demo_data" || payload.action === "delete_demo_data") {
      const result = await resetDemoData(supabase, payload.action === "reset_demo_data" ? demoBatchId : null);
      await supabase.from("audit_logs" as any).insert(demoRow({ actor_id: profile.id, actor_role: "admin", entity_type: "demo_control", action: payload.action, after_data: result }));
      return ok({ message: "נתוני הדמו נמחקו בבטחה. הפעולה מחקה רק רשומות עם is_demo=true.", ...result });
    }

    const garden = await getDemoGarden(supabase);

    if (payload.action === "load_demo_data") {
      await supabase.from("notifications" as any).insert(demoRow({ garden_id: garden.id, recipient_id: profile.id, recipient_role: "admin", title: demoName("סביבת דמו מוכנה לבדיקה"), body: "נוצר/אותר גן דמו מהיר. להרצה מלאה עם משתמשים ו-20 ילדים הרץ npm run seed:demo-full.", severity: "medium" }));
      await supabase.from("audit_logs" as any).insert(demoRow({ actor_id: profile.id, actor_role: "admin", garden_id: garden.id, entity_type: "demo_control", action: "load_demo_data" }));
      return ok({ message: "נוצר/אותר גן דמו מהיר. לדמו מלא עם משתמשים הרץ npm run seed:demo-full.", garden_id: garden.id });
    }

    if (payload.action === "create_sample_complaint") {
      const { data, error } = await supabase.from("complaints" as any).insert(demoRow({ garden_id: garden.id, subject: demoName("פניית דמו: בדיקת בטיחות חצר"), description: "הורה מבקש לבדוק את שער החצר לאחר איסוף אחר הצהריים.", category: "safety", severity: "high", urgent: true, status: "new", response_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })).select("*").single();
      if (error) throw error;
      return ok({ message: "נוצרה פניית דמו.", item: data });
    }

    if (payload.action === "create_sample_ai_event") {
      const { data: camera } = await supabase.from("camera_streams" as any).select("*").eq("garden_id", garden.id).limit(1).maybeSingle();
      const { data, error } = await supabase.from("ai_events" as any).insert(demoRow({ garden_id: garden.id, camera_stream_id: camera?.id ?? null, event_type: "child_alone", severity: "high", confidence: 0.87, status: "open", screenshot_url: "https://example.com/demo/snapshot-child-alone.jpg", notes: "אירוע דמו לבדיקת תצפיתן דיגיטלי." })).select("*").single();
      if (error) throw error;
      return ok({ message: "נוצר אירוע AI דמו.", item: data });
    }

    if (payload.action === "create_sample_camera_issue") {
      const { data, error } = await supabase.from("camera_streams" as any).insert(demoRow({ garden_id: garden.id, name: demoName("מצלמת דמו ממתינה Gateway"), area: "חצר", camera_type: "Gateway readiness", protocol: "gateway_required", status: "pending_gateway", active: true, parent_view_allowed: false, parent_viewing_allowed: false, ai_enabled: false, host: "", port: null, rtsp_path: "", parent_blocked_reason: "נדרש חיבור Gateway אמיתי ומדיניות צפיית הורים מאושרת" })).select("*").single();
      if (error) throw error;
      return ok({ message: "נוצרה מצלמת דמו במצב pending_gateway.", item: data });
    }

    if (payload.action === "create_sample_late_inspection") {
      const dueAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("required_inspections" as any).insert(demoRow({ garden_id: garden.id, inspector_id: garden.inspector_id ?? null, due_at: dueAt, status: "late", countdown_day: 0 })).select("*").single();
      if (error) throw error;
      await supabase.from("late_inspections" as any).insert(demoRow({ garden_id: garden.id, inspector_id: garden.inspector_id ?? null, due_at: dueAt, days_late: 4, status: "late" }));
      return ok({ message: "נוצר פיקוח דמו באיחור.", item: data });
    }

    if (payload.action === "create_sample_inspection") {
      const form = await ensureForm(supabase, profile.id);
      const { data: questions } = await supabase.from("inspection_form_questions" as any).select("*").eq("form_id", form.id).order("sort_order");
      const inspectorId = garden.inspector_id ?? profile.id;
      const { data: inspection, error } = await supabase.from("inspections" as any).insert(demoRow({ garden_id: garden.id, inspector_id: inspectorId, form_id: form.id, status: "done", gps_lat: garden.gps_lat ?? 32.084, gps_lng: garden.gps_lng ?? 34.812, gps_verified: true, started_at: new Date().toISOString(), completed_at: new Date().toISOString(), weighted_score: 8.6, violation_count: 0, critical_failures: 0, signature_image: "https://example.com/demo/signature.png", signed_at: new Date().toISOString(), signed_by: inspectorId, summary: "דוח דמו נוצר ממרכז השליטה לצורך QA." })).select("*").single();
      if (error) throw error;
      await supabase.from("inspection_answers" as any).insert((questions ?? []).map((question: any, index: number) => demoRow({ inspection_id: inspection.id, question_id: question.id, score: [9, 8, 9][index] ?? 8, note: "תשובת דמו לבדיקת דוח", photo_url: question.requires_photo ? "https://example.com/demo/evidence.jpg" : null })));
      await supabase.from("inspection_signatures" as any).insert(demoRow({ inspection_id: inspection.id, signature_image: "https://example.com/demo/signature.png", signed_by: inspectorId, gps_lat: garden.gps_lat ?? 32.084, gps_lng: garden.gps_lng ?? 34.812, gps_distance_meters: 12, inspector_details: { id: inspectorId }, kindergarten_details: { name: garden.name }, result_snapshot: { score: 8.6 } }));
      return ok({ message: "נוצר דוח פיקוח דמו חתום.", item: inspection });
    }

    return fail("פעולת דמו לא מוכרת.", 400);
  } catch (error) {
    return handleRouteError(error);
  }
}
