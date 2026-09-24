import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import {
  buildCsv,
  moneyFromMinorUnits,
  moneyMinorUnits,
  resolveReportPage,
  resolveReportRange,
  roleCanReadReport,
  safeReportFilename,
  type ReportType,
  type ReportingRole
} from "@/lib/management/reporting";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

type Row = Record<string, unknown>;
type Scope = {
  role: ReportingRole;
  profileId: string;
  gardenIds: string[];
  childIds: string[];
  staffId: string | null;
  requestedGardenId: string | null;
};

const csvColumns: Partial<Record<ReportType, readonly string[]>> = {
  attendance: ["attendance_date", "child_id", "classroom_id", "status", "arrival_at", "departure_at"],
  pickup: ["pickup_time", "child_id", "pickup_contact_id", "authorization_type", "status", "verified_by"],
  staff_hours: ["staff_id", "staff_name", "shift_date", "planned_start", "planned_end", "actual_start", "actual_end", "worked_minutes", "approval_state", "rate_kind", "estimated_labor_cost", "currency", "missing_clock_out"],
  tuition: ["period_start", "period_end", "due_at", "child_id", "base_amount", "adjustment_total", "amount_due", "settled_total", "outstanding", "currency", "status", "payment_truth"],
  subscription: ["garden_id", "plan_name", "status", "billing_status", "current_period_start", "current_period_end", "unit_price_snapshot", "currency_snapshot", "provider", "activation_source"],
  inspections: ["garden_id", "period_month", "status", "weighted_score", "critical_failures", "violation_count", "completed_at"],
  corrective_actions: ["garden_id", "inspection_id", "status", "severity", "correction_due_at", "created_at", "updated_at"],
  complaints: ["garden_id", "category", "severity", "status", "sla_state", "created_at", "closed_at"],
  tasks: ["garden_id", "title", "status", "priority", "source_entity_type", "due_at", "completed_at"],
  documents: ["garden_id", "owner_type", "document_type", "status", "expires_at", "created_at"],
  enrollment: ["garden_id", "status", "submitted_at", "reviewed_at", "activated_at"],
  capacity: ["garden_id", "classroom_id", "classroom_name", "configured_capacity", "occupied", "reserved", "available", "over_capacity"]
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function resolveScope(search: URLSearchParams): Promise<Scope | Response> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile || session.user.id !== session.profile.id) return fail("נדרשת התחברות מחדש.", 401);
  if (!managementContactVerification(session.user, session.profile).complete) return fail("יש להשלים אימות דוא״ל.", 403);
  const role = session.profile.role as ReportingRole;
  const requestedGardenId = search.get("garden_id");
  if (role === "owner" || role === "manager") {
    const context = await resolveManagementGardenContext(session.profile);
    if (!context.available) return fail("בדיקת הרשאות הגן אינה זמינה כרגע.", 503);
    const gardenIds = context.gardens.map(garden => garden.id);
    if (requestedGardenId && !gardenIds.includes(requestedGardenId)) return fail("אין הרשאה לדוח הגן המבוקש.", 403);
    return { role, profileId: session.profile.id, gardenIds, childIds: [], staffId: null, requestedGardenId };
  }
  const supabase = await createClient();
  if (role === "parent") {
    const family = await getParentFamilyContext(supabase, session.profile);
    const childIds = unique([
      ...family.children.map((child: Row) => String(child.id)),
      ...family.enrollments.map((enrollment: Row) => typeof enrollment.child_id === "string" ? enrollment.child_id : null)
    ]);
    const gardenIds = unique(family.gardenIds);
    if (requestedGardenId && !gardenIds.includes(requestedGardenId)) return fail("אין הרשאה לדוח הגן המבוקש.", 403);
    const requestedChildId = search.get("child_id");
    if (requestedChildId && !childIds.includes(requestedChildId)) return fail("אין הרשאה לדוח הילד המבוקש.", 403);
    return { role, profileId: session.profile.id, gardenIds, childIds: requestedChildId ? [requestedChildId] : childIds, staffId: null, requestedGardenId };
  }
  if (role === "staff") {
    const access = await getOperationalRoleContext(["staff"]);
    if (!access.allowed) return access.response;
    const context = await resolveStaffEmploymentContext(session.profile);
    if (!context.available || !context.activeEmployment) return fail("אין העסקה פעילה לדוח המבוקש.", 403);
    if (requestedGardenId && requestedGardenId !== context.activeEmployment.garden_id) return fail("אין הרשאה לדוח הגן המבוקש.", 403);
    return { role, profileId: session.profile.id, gardenIds: [context.activeEmployment.garden_id], childIds: [], staffId: context.activeEmployment.staff_id, requestedGardenId };
  }
  if (role === "inspector") {
    const access = await getOperationalRoleContext(["inspector"]);
    if (!access.allowed) return access.response;
    const assignments = await supabase.from("gardens" as never).select("id" as never).eq("inspector_id", session.profile.id).limit(500);
    if (assignments.error) return fail("בדיקת שיוכי המפקח אינה זמינה כרגע.", 503);
    const gardenIds = ((assignments.data ?? []) as unknown as Row[]).map(row => String(row.id));
    if (requestedGardenId && !gardenIds.includes(requestedGardenId)) return fail("אין הרשאה לדוח הגן המבוקש.", 403);
    return { role, profileId: session.profile.id, gardenIds, childIds: [], staffId: null, requestedGardenId };
  }
  if (role === "admin") return { role, profileId: session.profile.id, gardenIds: [], childIds: [], staffId: null, requestedGardenId: null };
  return fail("אין הרשאה לדוחות.", 403);
}

function scopedGardenIds(scope: Scope) {
  return scope.requestedGardenId ? [scope.requestedGardenId] : scope.gardenIds;
}

function asRows(value: unknown) {
  return (Array.isArray(value) ? value : []) as Row[];
}

function queryError(error: unknown) {
  if (error) throw new Error("report_query_failed");
}

async function reportRows(report: ReportType, scope: Scope, range: ReturnType<typeof resolveReportRange>, page: ReturnType<typeof resolveReportPage>) {
  const supabase = await createClient();
  const gardenIds = scopedGardenIds(scope);
  const dateEndExclusive = `${range.to}T23:59:59.999Z`;
  if (report === "attendance") {
    let query = supabase.from("attendance" as never)
      .select("id,garden_id,child_id,classroom_id,attendance_date,status,check_in_at,check_out_at,arrival_recorded_by,departure_recorded_by" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("attendance_date", range.from).lte("attendance_date", range.to)
      .order("attendance_date", { ascending: false }).range(page.from, page.to);
    if (scope.role === "parent") query = query.in("child_id", scope.childIds);
    const result = await query; queryError(result.error);
    return { rows: asRows(result.data).map(row => ({ ...row, arrival_at: row.check_in_at, departure_at: row.check_out_at })), total: result.count ?? 0 };
  }
  if (report === "pickup") {
    const result = await supabase.from("child_pickup_events" as never)
      .select("id,kindergarten_id,child_id,pickup_contact_id,pickup_time,authorization_type,status,verified_by" as never, { count: "exact" })
      .in("kindergarten_id", gardenIds).gte("pickup_time", `${range.from}T00:00:00.000Z`).lte("pickup_time", dateEndExclusive)
      .order("pickup_time", { ascending: false }).range(page.from, page.to);
    queryError(result.error); return { rows: asRows(result.data), total: result.count ?? 0 };
  }
  if (report === "staff_hours") {
    if (scope.role === "staff") {
      const result = await supabase.from("staff_shifts" as never)
        .select("id,garden_id,staff_id,shift_date,planned_start,planned_end,actual_start,actual_end,total_minutes,status,approved_at,review_reason" as never, { count: "exact" })
        .eq("staff_id", scope.staffId).in("garden_id", gardenIds).gte("shift_date", range.from).lte("shift_date", range.to)
        .order("shift_date", { ascending: false }).range(page.from, page.to);
      queryError(result.error);
      return { rows: asRows(result.data).map(row => ({ ...row, worked_minutes: row.total_minutes, approval_state: row.approved_at ? "approved" : row.status, missing_clock_out: Boolean(row.actual_start && !row.actual_end) })), total: result.count ?? 0 };
    }
    if (gardenIds.length !== 1) return { rows: [], total: 0, notice: "בחרו גן יחיד לדוח שעות צוות." };
    const month = `${range.from.slice(0, 7)}-01`;
    const result = await supabase.rpc("management_staff_time_export" as never, { p_garden_id: gardenIds[0], p_period_start: month } as never);
    queryError(result.error);
    const rows = asRows(result.data).filter(row => String(row.shift_date ?? "") >= range.from && String(row.shift_date ?? "") <= range.to);
    return { rows: rows.slice(page.from, page.to + 1), total: rows.length };
  }
  if (report === "tuition") {
    let query = supabase.from("tuition_billing_periods" as never)
      .select("id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,currency,status,reconciliation_reason" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("period_start", `${range.from.slice(0, 7)}-01`).lte("period_start", range.to)
      .order("period_start", { ascending: false }).range(page.from, page.to);
    if (scope.role === "parent") query = query.in("child_id", scope.childIds);
    const result = await query; queryError(result.error);
    const rows = asRows(result.data).map(row => {
      const due = moneyMinorUnits(row.base_amount) + moneyMinorUnits(row.adjustment_total);
      const settled = moneyMinorUnits(row.settled_total);
      return { ...row, amount_due: moneyFromMinorUnits(due), outstanding: moneyFromMinorUnits(Math.max(0, due - settled)), payment_truth: row.status === "paid" ? "ledger_settled" : row.status };
    });
    return { rows, total: result.count ?? rows.length };
  }
  if (report === "subscription") {
    let query = supabase.from("kindergarten_subscriptions" as never)
      .select("id,garden_id,plan_id,status,billing_status,current_period_start,current_period_end,unit_price_snapshot,currency_snapshot,provider,activation_source,subscription_plans(name)" as never, { count: "exact" })
      .order("created_at", { ascending: false }).range(page.from, page.to);
    if (scope.role !== "admin") query = query.in("garden_id", gardenIds);
    const result = await query; queryError(result.error);
    return { rows: asRows(result.data).map(row => ({ ...row, plan_name: (row.subscription_plans as { name?: unknown } | null)?.name ?? null, subscription_plans: undefined })), total: result.count ?? 0 };
  }
  if (report === "inspections" || report === "inspector_portfolio") {
    const result = await supabase.from("inspections" as never)
      .select("id,garden_id,inspector_id,period_month,status,weighted_score,critical_failures,violation_count,started_at,completed_at,created_at" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("created_at", `${range.from}T00:00:00.000Z`).lte("created_at", dateEndExclusive)
      .order("created_at", { ascending: false }).range(page.from, page.to);
    queryError(result.error); return { rows: asRows(result.data), total: result.count ?? 0 };
  }
  if (report === "corrective_actions") {
    const result = await supabase.from("violations" as never)
      .select("id,garden_id,inspection_id,title,category,severity,status,correction_due_at,created_at,updated_at" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("created_at", `${range.from}T00:00:00.000Z`).lte("created_at", dateEndExclusive)
      .order("created_at", { ascending: false }).range(page.from, page.to);
    queryError(result.error); return { rows: asRows(result.data), total: result.count ?? 0 };
  }
  if (report === "complaints") {
    const result = await supabase.from("complaints" as never)
      .select("id,garden_id,category,severity,status,acknowledgement_due_at,resolution_due_at,acknowledged_at,resolved_at,created_at,closed_at" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("created_at", `${range.from}T00:00:00.000Z`).lte("created_at", dateEndExclusive)
      .order("created_at", { ascending: false }).range(page.from, page.to);
    queryError(result.error);
    const now = Date.now();
    const rows = asRows(result.data).map(row => ({
      ...row,
      sla_state: row.resolved_at || row.closed_at ? "resolved" :
        (row.resolution_due_at && new Date(String(row.resolution_due_at)).getTime() < now) ? "resolution_overdue" :
          (!row.acknowledged_at && row.acknowledgement_due_at && new Date(String(row.acknowledgement_due_at)).getTime() < now) ? "acknowledgement_overdue" : "within_target"
    }));
    return { rows, total: result.count ?? 0 };
  }
  if (report === "tasks" || report === "staff_summary") {
    let query = supabase.from("tasks" as never)
      .select("id,garden_id,title,status,priority,source_entity_type,due_at,completed_at,created_at,assigned_to" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("created_at", `${range.from}T00:00:00.000Z`).lte("created_at", dateEndExclusive)
      .order("created_at", { ascending: false }).range(page.from, page.to);
    if (scope.role === "staff") query = query.eq("assigned_to", scope.profileId);
    const result = await query; queryError(result.error); return { rows: asRows(result.data), total: result.count ?? 0 };
  }
  if (report === "documents") {
    let query = supabase.from("documents" as never)
      .select("id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,document_type,status,expires_at,created_at,replaced_by" as never, { count: "exact" })
      .is("deleted_at", null).order("created_at", { ascending: false }).range(page.from, page.to);
    if (gardenIds.length) query = query.in("garden_id", gardenIds);
    if (scope.role === "parent") query = query.in("child_id", scope.childIds);
    const result = await query; queryError(result.error); return { rows: asRows(result.data), total: result.count ?? 0 };
  }
  if (report === "enrollment") {
    const result = await supabase.from("kindergarten_enrollment_requests" as never)
      .select("id,garden_id,child_profile_id,status,requested_at,reviewed_at,activated_at,created_at" as never, { count: "exact" })
      .in("garden_id", gardenIds).gte("created_at", `${range.from}T00:00:00.000Z`).lte("created_at", dateEndExclusive)
      .order("created_at", { ascending: false }).range(page.from, page.to);
    queryError(result.error); return { rows: asRows(result.data).map(row => ({ ...row, child_id: row.child_profile_id, submitted_at: row.requested_at })), total: result.count ?? 0 };
  }
  if (report === "capacity") {
    const [classrooms, assignments, reservations] = await Promise.all([
      supabase.from("classrooms" as never).select("id,garden_id,name,capacity_limit,status" as never).in("garden_id", gardenIds).neq("status", "archived").limit(500),
      supabase.from("child_classroom_assignments" as never).select("classroom_id,garden_id" as never).in("garden_id", gardenIds).eq("is_current", true).limit(2_000),
      supabase.from("classroom_seat_reservations" as never).select("classroom_id,garden_id,status,expires_at" as never).in("garden_id", gardenIds).eq("status", "active").limit(2_000)
    ]);
    queryError(classrooms.error || assignments.error || reservations.error);
    const rows = asRows(classrooms.data).map(room => {
      const occupied = asRows(assignments.data).filter(item => item.classroom_id === room.id).length;
      const reserved = asRows(reservations.data).filter(item => item.classroom_id === room.id).length;
      const configured = room.capacity_limit == null ? null : Number(room.capacity_limit);
      return { garden_id: room.garden_id, classroom_id: room.id, classroom_name: room.name, configured_capacity: configured, occupied, reserved, available: configured == null ? null : Math.max(0, configured - occupied - reserved), over_capacity: configured != null && occupied + reserved > configured };
    });
    return { rows: rows.slice(page.from, page.to + 1), total: rows.length };
  }
  if (report === "dashboard" || report === "network_summary" || report === "parent_summary") {
    const [attendance, tasks, complaints, tuition, inspections, documents] = await Promise.all([
      supabase.from("attendance" as never).select("id,status,garden_id,child_id" as never).in("garden_id", gardenIds).gte("attendance_date", range.from).lte("attendance_date", range.to).limit(2_000),
      supabase.from("tasks" as never).select("id,status,garden_id" as never).in("garden_id", gardenIds).limit(2_000),
      supabase.from("complaints" as never).select("id,status,garden_id" as never).in("garden_id", gardenIds).limit(2_000),
      supabase.from("tuition_billing_periods" as never).select("garden_id,child_id,base_amount,adjustment_total,settled_total,status" as never).in("garden_id", gardenIds).limit(2_000),
      supabase.from("inspections" as never).select("id,status,garden_id,weighted_score" as never).in("garden_id", gardenIds).limit(2_000),
      supabase.from("documents" as never).select("id,garden_id,child_id,status,expires_at" as never).in("garden_id", gardenIds).is("deleted_at", null).limit(2_000)
    ]);
    queryError(attendance.error || tasks.error || complaints.error || tuition.error || inspections.error || documents.error);
    const childSet = new Set(scope.role === "parent" ? scope.childIds : []);
    const filterChild = (rows: Row[]) => scope.role === "parent" ? rows.filter(row => childSet.has(String(row.child_id))) : rows;
    const attendanceRows = filterChild(asRows(attendance.data));
    const tuitionRows = filterChild(asRows(tuition.data));
    const documentRows = filterChild(asRows(documents.data));
    const outstandingMinor = tuitionRows.reduce((sum, row) => sum + Math.max(0, moneyMinorUnits(row.base_amount) + moneyMinorUnits(row.adjustment_total) - moneyMinorUnits(row.settled_total)), 0);
    return { rows: [{
      garden_count: gardenIds.length,
      attendance_records: attendanceRows.length,
      present: attendanceRows.filter(row => ["present", "checked_in", "departed", "checked_out"].includes(String(row.status))).length,
      open_tasks: asRows(tasks.data).filter(row => !["completed", "cancelled", "closed"].includes(String(row.status))).length,
      open_complaints: asRows(complaints.data).filter(row => !["resolved", "closed", "cancelled"].includes(String(row.status))).length,
      outstanding_tuition: moneyFromMinorUnits(outstandingMinor),
      inspections: asRows(inspections.data).length,
      document_action_items: documentRows.filter(row => ["pending_review", "rejected", "expired"].includes(String(row.status))).length
    }], total: 1 };
  }
  if (report === "platform_summary") {
    const [gardens, profiles, subscriptions, complaints, readiness] = await Promise.all([
      supabase.from("gardens" as never).select("id,status" as never, { count: "exact" }).limit(1),
      supabase.from("profiles" as never).select("id,role" as never, { count: "exact" }).limit(2_000),
      supabase.from("kindergarten_subscriptions" as never).select("id,status,billing_status" as never).limit(2_000),
      supabase.from("complaints" as never).select("id,status" as never).limit(2_000),
      supabase.from("billing_provider_configs" as never).select("provider,enabled,mode" as never).limit(50)
    ]);
    queryError(gardens.error || profiles.error || subscriptions.error || complaints.error || readiness.error);
    const countsBy = (rows: Row[], key: string) => rows.reduce<Record<string, number>>((counts, row) => {
      const value = String(row[key] ?? "unknown");
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});
    return { rows: [{ garden_count: gardens.count ?? 0, role_counts: countsBy(asRows(profiles.data), "role"), subscription_states: countsBy(asRows(subscriptions.data), "status"), open_complaints: asRows(complaints.data).filter(row => !["resolved", "closed"].includes(String(row.status))).length, provider_readiness: readiness.data ?? [] }], total: 1 };
  }
  throw new Error("unsupported_report");
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const report = url.searchParams.get("type") ?? "dashboard";
    const scope = await resolveScope(url.searchParams);
    if (scope instanceof Response) return scope;
    if (!roleCanReadReport(scope.role, report)) return fail("סוג הדוח אינו מורשה לתפקיד זה.", 403);
    const supabase = await createClient();
    let timezone = scope.role === "admin" ? "UTC" : "Asia/Jerusalem";
    const gardenId = scope.requestedGardenId ?? scope.gardenIds[0];
    if (gardenId) {
      const garden = await supabase.from("gardens" as never).select("operational_timezone" as never).eq("id", gardenId).maybeSingle();
      if (garden.error) return fail("לא ניתן לקבוע את אזור הזמן של הדוח.", 503);
      timezone = String((garden.data as { operational_timezone?: unknown } | null)?.operational_timezone ?? timezone);
    }
    let range;
    try { range = resolveReportRange(url.searchParams, timezone); }
    catch { return fail("טווח התאריכים אינו תקין או גדול משנה.", 422); }
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
    if (format === "csv" && !csvColumns[report]) return fail("ייצוא CSV אינו זמין לדוח מסכם זה.", 422);
    const page = resolveReportPage(url.searchParams, format === "csv");
    const result = await reportRows(report, scope, range, page);
    const generatedAt = new Date().toISOString();
    if (format === "csv") {
      const audit = await supabase.from("audit_logs" as never).insert({
        actor_id: scope.profileId,
        actor_role: scope.role,
        garden_id: scope.requestedGardenId ?? (scope.gardenIds.length === 1 ? scope.gardenIds[0] : null),
        entity_type: "management_report_export",
        action: `export_${report}`,
        after_data: { report, garden_count: scopedGardenIds(scope).length, from: range.from, to: range.to, row_count: result.rows.length }
      } as never);
      if (audit.error) return fail("לא ניתן לתעד את ייצוא הדוח ולכן ההורדה נעצרה.", 503);
      return new Response(buildCsv(csvColumns[report]!, result.rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeReportFilename(report, range.from, range.to)}"`,
          "Cache-Control": "private, no-store"
        }
      });
    }
    const response = ok({ report, scope: { role: scope.role, garden_ids: scopedGardenIds(scope), child_count: scope.role === "parent" ? scope.childIds.length : undefined }, range, pagination: { page: page.page, page_size: page.pageSize, total: result.total }, freshness: { generated_at: generatedAt, mode: "query_time", live: false }, ...result });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
