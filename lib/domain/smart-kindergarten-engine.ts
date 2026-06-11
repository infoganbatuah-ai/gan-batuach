import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/roles";

export type SmartSeverity = "info" | "warning" | "urgent" | "critical";
export type SmartInsightCategory = "ילדים" | "הורים" | "כספים" | "צוות" | "מצלמות" | "פיקוח" | "מסמכים" | "העברות" | "מערכת";

export type SmartInsight = {
  id?: string;
  role: UserRole | "admin";
  recipient_profile_id?: string | null;
  kindergarten_id?: string | null;
  child_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  category: SmartInsightCategory;
  severity: SmartSeverity;
  title: string;
  description: string;
  recommended_action: string;
  action_url: string;
  status?: "open" | "handled" | "snoozed" | "dismissed";
  dedupe_key: string;
  metadata?: Record<string, unknown>;
  generated_at?: string;
};

export const smartThresholds = {
  parentRequestWarningHours: 4,
  parentRequestUrgentHours: 24,
  mealMissingAfterHour: 13,
  sleepMissingAfterHour: 15,
  incidentUrgentHours: 24,
  inspectionDueSoonDays: 3,
  notificationDedupeHours: 12
};

function nowIso() {
  return new Date().toISOString();
}

function startOfToday() {
  return new Date().toISOString().slice(0, 10);
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function inDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

async function countRows(supabase: SupabaseClient<any, any, any>, label: string, build: () => any) {
  try {
    const { count, error } = await build();
    if (error) {
      console.error(`[smart-engine:${label}]`, error);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    console.error(`[smart-engine:${label}]`, error);
    return 0;
  }
}

function insight(input: Omit<SmartInsight, "generated_at" | "status">): SmartInsight {
  return { ...input, status: "open", generated_at: nowIso() };
}

function severityFromCount(count: number, warning = 1, urgent = 3): SmartSeverity {
  if (count >= urgent) return "urgent";
  if (count >= warning) return "warning";
  return "info";
}

function providerStatus() {
  return process.env.OPENAI_API_KEY || process.env.AI_PROVIDER_API_KEY ? "connected" : "pending";
}

async function getParentChildIds(supabase: SupabaseClient<any, any, any>, profileId: string) {
  const parentByProfile = await supabase.from("parents" as any).select("id, garden_id, kindergarten_id").eq("profile_id", profileId).maybeSingle();
  const parentByUser = parentByProfile.data ? { data: null } : await supabase.from("parents" as any).select("id, garden_id, kindergarten_id").eq("user_id", profileId).maybeSingle();
  const parent = (parentByProfile.data as any) ?? (parentByUser.data as any);
  if (!parent?.id) return { parentId: null, childIds: [] as string[], gardenIds: [parent?.garden_id, parent?.kindergarten_id].filter(Boolean) as string[] };
  const children = await supabase.from("children" as any).select("id, garden_id, kindergarten_id, status").eq("primary_parent_id", parent.id);
  const rows = (children.data ?? []) as any[];
  return {
    parentId: parent.id as string,
    childIds: rows.map((row) => row.id).filter(Boolean),
    gardenIds: Array.from(new Set([...rows.map((row) => row.garden_id ?? row.kindergarten_id), parent.garden_id, parent.kindergarten_id].filter(Boolean)))
  };
}

export async function generateSmartInsights(supabase: SupabaseClient<any, any, any>, profile: any): Promise<SmartInsight[]> {
  const role = profile.role as UserRole;
  const gardenId = profile.garden_id ?? profile.kindergarten_id ?? null;
  const recipient = profile.id ?? null;
  const today = startOfToday();
  const hour = new Date().getHours();
  const insights: SmartInsight[] = [];

  if (role === "manager" || role === "owner") {
    const childCount = await countRows(supabase, "manager children", () => supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? ""));
    const attendanceRows = await supabase.from("attendance" as any).select("child_id,status").eq("garden_id", gardenId ?? "").eq("attendance_date", today);
    const present = ((attendanceRows.data ?? []) as any[]).filter((row) => row.status === "present").length;
    const missingAttendance = Math.max(0, childCount - ((attendanceRows.data ?? []) as any[]).length);
    const absent = Math.max(0, childCount - present);
    const journalRows = await supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood").eq("garden_id", gardenId ?? "").eq("journal_date", today);
    const journals = (journalRows.data ?? []) as any[];
    const withoutMeal = Math.max(0, childCount - journals.filter((row) => Array.isArray(row.meals) && row.meals.length > 0).length);
    const withoutSleep = Math.max(0, childCount - journals.filter((row) => Boolean(row.sleep_summary)).length);
    const [
      missingClothes,
      parentRequestsWarning,
      parentRequestsUrgent,
      paymentFailed,
      paymentOverdue,
      documentsReview,
      staffDocs,
      incidentsUrgent,
      inspectionsDue,
      camerasOffline,
      transfers,
      leadsWaiting
    ] = await Promise.all([
      countRows(supabase, "missing clothes", () => supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("has_change_clothes", false)),
      countRows(supabase, "parent requests warning", () => supabase.from("parent_child_requests" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["new", "viewed", "in_progress"]).lte("created_at", hoursAgo(smartThresholds.parentRequestWarningHours))),
      countRows(supabase, "parent requests urgent", () => supabase.from("parent_child_requests" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["new", "viewed", "in_progress"]).lte("created_at", hoursAgo(smartThresholds.parentRequestUrgentHours))),
      countRows(supabase, "payments failed", () => supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("payment_status", ["failed", "not_transferred"])),
      countRows(supabase, "payments overdue", () => supabase.from("children" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("payment_status", ["overdue", "unpaid", "partial"])),
      countRows(supabase, "documents review", () => supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").in("status", ["pending_review", "missing", "expired", "rejected"])),
      countRows(supabase, "staff docs", () => supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("owner_type", "staff").in("status", ["missing", "expired", "rejected"])),
      countRows(supabase, "incidents urgent", () => supabase.from("incident_reports" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "closed").lte("created_at", hoursAgo(smartThresholds.incidentUrgentHours))),
      countRows(supabase, "inspections due", () => supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").neq("status", "done").lte("due_at", inDays(smartThresholds.inspectionDueSoonDays))),
      countRows(supabase, "cameras offline", () => supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").or("active.eq.false,status.in.(pending_gateway,offline,failed,error,disabled),stream_status.in.(pending,offline,error,disabled)")),
      countRows(supabase, "transfers", () => supabase.from("child_transfer_requests" as any).select("id", { count: "exact", head: true }).or(`target_garden_id.eq.${gardenId},current_garden_id.eq.${gardenId}`).in("status", ["pending_new_kindergarten_review", "missing_details", "pending_current_kindergarten_response"])),
      countRows(supabase, "leads waiting", () => supabase.from("leads" as any).select("id", { count: "exact", head: true }).eq("garden_id", gardenId ?? "").eq("lead_type", "parent").in("status", ["new", "viewed", "missing_details"]).lte("created_at", hoursAgo(24)))
    ]);

    if (absent > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "ילדים", severity: severityFromCount(absent), title: `${absent} ילדים לא מסומנים כנוכחים`, description: "נוכחות לא מלאה מקשה להבין מי הגיע ומי דורש בירור מול ההורה.", recommended_action: "פתחי נוכחות עכשיו", action_url: "/dashboard/garden/attendance?filter=missing", dedupe_key: `manager:${gardenId}:attendance:${today}`, metadata: { absent, missingAttendance } }));
    if (withoutMeal > 0 && hour >= smartThresholds.mealMissingAfterHour) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "ילדים", severity: severityFromCount(withoutMeal), title: `${withoutMeal} ילדים בלי עדכון ארוחה`, description: "ההורים מצפים לעדכון יומי, וזה חסר ביומן.", recommended_action: "עדכני ארוחות עכשיו", action_url: "/dashboard/garden/child-journal?missing=meal", dedupe_key: `manager:${gardenId}:meal:${today}`, metadata: { withoutMeal } }));
    if (withoutSleep > 0 && hour >= smartThresholds.sleepMissingAfterHour) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "ילדים", severity: severityFromCount(withoutSleep), title: `${withoutSleep} ילדים בלי עדכון שינה`, description: "עדכון שינה עוזר להורים להבין איך עבר היום.", recommended_action: "עדכני שינה", action_url: "/dashboard/garden/child-journal?missing=sleep", dedupe_key: `manager:${gardenId}:sleep:${today}`, metadata: { withoutSleep } }));
    if (missingClothes > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "ילדים", severity: "warning", title: `${missingClothes} ילדים חסרים בגדים להחלפה`, description: "בגדים זמינים חוסכים לחץ בזמן החלפה או אירוע קטן.", recommended_action: "בקשי השלמה מההורים", action_url: "/dashboard/garden/children?view=attention&filter=change-clothes", dedupe_key: `manager:${gardenId}:change-clothes`, metadata: { missingClothes } }));
    const parentRequestSeverity: SmartSeverity = parentRequestsUrgent > 0 ? "urgent" : parentRequestsWarning > 0 ? "warning" : "info";
    if (parentRequestsWarning > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "הורים", severity: parentRequestSeverity, title: `${parentRequestsWarning} פניות הורים ממתינות`, description: parentRequestsUrgent ? "חלק מהפניות פתוחות מעל 24 שעות." : "פנייה פתוחה מעל 4 שעות עלולה להישכח.", recommended_action: "פתחי פניות הורים", action_url: "/dashboard/garden/messages?status=open", dedupe_key: `manager:${gardenId}:parent-requests`, metadata: { parentRequestsWarning, parentRequestsUrgent } }));
    if (paymentFailed > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "כספים", severity: "urgent", title: `${paymentFailed} תשלומים לא עברו`, description: "תשלום שנכשל צריך עדכון הורה ותזכורת גבייה.", recommended_action: "טפלי בתשלומים שנכשלו", action_url: "/dashboard/garden/finance?filter=failed", dedupe_key: `manager:${gardenId}:payment-failed`, metadata: { paymentFailed } }));
    if (paymentOverdue > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "כספים", severity: "warning", title: `${paymentOverdue} תשלומים באיחור`, description: "גבייה חסרה משפיעה על תזרים הגן.", recommended_action: "פתחי גבייה", action_url: "/dashboard/garden/finance?filter=overdue", dedupe_key: `manager:${gardenId}:payment-overdue`, metadata: { paymentOverdue } }));
    if (documentsReview > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "מסמכים", severity: "warning", title: `${documentsReview} מסמכים דורשים טיפול`, description: "מסמך חסר או ממתין לאישור עלול לעכב קליטה או תאימות.", recommended_action: "בדקי מסמכים", action_url: "/dashboard/garden/documents?filter=review", dedupe_key: `manager:${gardenId}:documents`, metadata: { documentsReview } }));
    if (staffDocs > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "צוות", severity: "urgent", title: `${staffDocs} מסמכי צוות חסרים`, description: "מסמכי צוות חסרים משפיעים על כשירות ותאימות.", recommended_action: "בקשי מסמכים מהצוות", action_url: "/dashboard/garden/documents?filter=missing", dedupe_key: `manager:${gardenId}:staff-docs`, metadata: { staffDocs } }));
    if (incidentsUrgent > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "ילדים", severity: "urgent", title: `${incidentsUrgent} אירועים פתוחים מעל יום`, description: "אירוע פתוח צריך סגירה, תגובה או תיעוד המשך.", recommended_action: "טפלי באירועים", action_url: "/dashboard/garden/incidents?status=open", dedupe_key: `manager:${gardenId}:incidents`, metadata: { incidentsUrgent } }));
    if (inspectionsDue > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "פיקוח", severity: "warning", title: "פיקוח קרוב", description: "יש ביקורת קרובה או פתוחה בשלושת הימים הקרובים.", recommended_action: "פתחי סטטוס פיקוח", action_url: "/dashboard/garden/inspections?filter=due-soon", dedupe_key: `manager:${gardenId}:inspection-due`, metadata: { inspectionsDue } }));
    if (camerasOffline > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "מצלמות", severity: "urgent", title: `${camerasOffline} מצלמות לא מחוברות`, description: "מצלמה לא מחוברת פוגעת ברציפות תפעולית ובצפיית הורים אם הופעלה.", recommended_action: "בדקי מצלמות", action_url: "/dashboard/garden/cameras?filter=issues", dedupe_key: `manager:${gardenId}:camera-offline`, metadata: { camerasOffline } }));
    if (transfers > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "העברות", severity: "warning", title: `${transfers} בקשות מעבר/קליטה`, description: "בקשת קליטת ילד קיים או סיום שיוך ממתינה לתגובה.", recommended_action: "פתחי לידים והעברות", action_url: "/dashboard/garden/leads?type=transfer", dedupe_key: `manager:${gardenId}:transfers`, metadata: { transfers } }));
    if (leadsWaiting > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "הורים", severity: "warning", title: `${leadsWaiting} לידים מחכים מעל יום`, description: "בקשות הצטרפות שלא טופלו בזמן עלולות להתפספס.", recommended_action: "פתחי בקשות הצטרפות", action_url: "/dashboard/garden/leads?status=new", dedupe_key: `manager:${gardenId}:leads-waiting`, metadata: { leadsWaiting } }));
    return insights;
  }

  if (role === "parent") {
    const scope = await getParentChildIds(supabase, profile.id);
    const [journals, docs, paymentsFailed, requestsAnswered, cameras] = await Promise.all([
      scope.childIds.length ? countRows(supabase, "parent journals", () => supabase.from("child_daily_journals" as any).select("id", { count: "exact", head: true }).in("child_id", scope.childIds).eq("journal_date", today)) : 0,
      countRows(supabase, "parent docs", () => supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "rejected"])),
      scope.childIds.length ? countRows(supabase, "parent failed payments", () => supabase.from("children" as any).select("id", { count: "exact", head: true }).in("id", scope.childIds).in("payment_status", ["failed", "not_transferred", "overdue"])) : 0,
      countRows(supabase, "parent answered requests", () => supabase.from("parent_child_requests" as any).select("id", { count: "exact", head: true }).eq("parent_id", scope.parentId ?? "").in("status", ["handled", "rejected"])),
      scope.gardenIds.length ? countRows(supabase, "parent cameras", () => supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).in("garden_id", scope.gardenIds).or("parent_view_allowed.eq.true,parent_viewing_allowed.eq.true")) : 0
    ]);
    if (journals > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "ילדים", severity: "info", title: "יש עדכון חדש מהגן", description: "עודכן יומן יומי לגבי היום של הילד.", recommended_action: "צפייה ביומן", action_url: "/dashboard/parent/daily-journal", dedupe_key: `parent:${profile.id}:journal:${today}`, metadata: { journals } }));
    if (docs > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "מסמכים", severity: "warning", title: `חסר מסמך אחד או יותר`, description: "הגן ביקש להשלים מסמך כדי שהכרטיס יהיה מסודר.", recommended_action: "העלאת מסמך", action_url: "/dashboard/parent/documents", dedupe_key: `parent:${profile.id}:docs`, metadata: { docs } }));
    if (paymentsFailed > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "כספים", severity: "urgent", title: "יש תשלום שדורש בדיקה", description: "נראה שיש תשלום שלא עבר או תשלום באיחור. אפשר לבדוק בנחת מול הגן.", recommended_action: "בדיקת תשלומים", action_url: "/dashboard/parent", dedupe_key: `parent:${profile.id}:payments`, metadata: { paymentsFailed } }));
    if (requestsAnswered > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "הורים", severity: "info", title: "הבקשה שלך טופלה", description: "יש עדכון חדש לגבי פנייה ששלחת לגן.", recommended_action: "צפייה בפניות", action_url: "/dashboard/parent/messages", dedupe_key: `parent:${profile.id}:request-answered:${today}`, metadata: { requestsAnswered } }));
    if (cameras > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "מצלמות", severity: "info", title: "מצלמות הגן זמינות לצפייה", description: "הגן הפעיל מצלמות שמותרות לצפיית הורים.", recommended_action: "פתיחת מצלמות", action_url: "/dashboard/parent/cameras", dedupe_key: `parent:${profile.id}:cameras`, metadata: { cameras } }));
    return insights;
  }

  if (role === "staff") {
    const [tasks, docs, messages, incidents] = await Promise.all([
      countRows(supabase, "staff tasks", () => supabase.from("tasks" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "done")),
      countRows(supabase, "staff docs", () => supabase.from("documents" as any).select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id).in("status", ["missing", "expired", "rejected"])),
      countRows(supabase, "staff messages", () => supabase.from("messages" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null)),
      countRows(supabase, "staff incidents", () => supabase.from("incident_reports" as any).select("id", { count: "exact", head: true }).eq("assigned_to", profile.id).neq("status", "closed"))
    ]);
    if (tasks > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "צוות", severity: "warning", title: `${tasks} משימות פתוחות`, description: "משימות יומיות שממתינות לביצוע.", recommended_action: "פתחי משימות", action_url: "/dashboard/staff/tasks", dedupe_key: `staff:${profile.id}:tasks`, metadata: { tasks } }));
    if (docs > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "מסמכים", severity: "warning", title: `${docs} מסמכים חסרים`, description: "חסר מסמך צוות או תעודה שצריך להשלים.", recommended_action: "השלמת מסמכים", action_url: "/dashboard/staff/documents", dedupe_key: `staff:${profile.id}:docs`, metadata: { docs } }));
    if (messages > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "צוות", severity: "info", title: `${messages} הודעות מהמנהלת`, description: "יש הודעות שלא נקראו.", recommended_action: "פתחי הודעות", action_url: "/dashboard/staff/messages", dedupe_key: `staff:${profile.id}:messages`, metadata: { messages } }));
    if (incidents > 0) insights.push(insight({ role, recipient_profile_id: recipient, kindergarten_id: gardenId, category: "ילדים", severity: "urgent", title: `${incidents} אירועים הוקצו לך`, description: "אירוע פתוח דורש טיפול או עדכון.", recommended_action: "טיפול באירועים", action_url: "/dashboard/staff/child-journal?quick=incident", dedupe_key: `staff:${profile.id}:incidents`, metadata: { incidents } }));
    return insights;
  }

  if (role === "inspector") {
    const [due, late, violations, cameras] = await Promise.all([
      countRows(supabase, "inspector due", () => supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).gte("due_at", nowIso()).lte("due_at", inDays(smartThresholds.inspectionDueSoonDays)).neq("status", "done")),
      countRows(supabase, "inspector late", () => supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).lt("due_at", nowIso()).neq("status", "done")),
      countRows(supabase, "inspector violations", () => supabase.from("violations" as any).select("id", { count: "exact", head: true }).eq("inspector_id", profile.id).neq("status", "done")),
      countRows(supabase, "inspector cameras", () => supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).in("status", ["offline", "failed", "error"]))
    ]);
    if (late > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "פיקוח", severity: "urgent", title: `${late} ביקורות באיחור`, description: "ביקורת באיחור דורשת תיאום או הסלמה.", recommended_action: "פתחי ביקורות באיחור", action_url: "/dashboard/inspector/inspections/due", dedupe_key: `inspector:${profile.id}:late`, metadata: { late } }));
    if (due > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "פיקוח", severity: "warning", title: `${due} ביקורות קרובות`, description: "ביקורות שמגיעות בשלושת הימים הקרובים.", recommended_action: "פתחי ביקורות להיום", action_url: "/dashboard/inspector/inspections/due", dedupe_key: `inspector:${profile.id}:due`, metadata: { due } }));
    if (violations > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "פיקוח", severity: "warning", title: `${violations} ליקויים פתוחים`, description: "ליקויים שממתינים לתיקון או אישור.", recommended_action: "פתחי ליקויים", action_url: "/dashboard/inspector/violations", dedupe_key: `inspector:${profile.id}:violations`, metadata: { violations } }));
    if (cameras > 0) insights.push(insight({ role, recipient_profile_id: recipient, category: "מצלמות", severity: "warning", title: "יש מצלמות עם תקלה", description: "מצלמות בגנים דורשות בדיקה אם יש הרשאת פיקוח.", recommended_action: "בדיקת מצלמות", action_url: "/dashboard/inspector/cameras", dedupe_key: `inspector:${profile.id}:cameras`, metadata: { cameras } }));
    return insights;
  }

  const [late, docs, complaints, cameras] = await Promise.all([
    countRows(supabase, "admin late", () => supabase.from("required_inspections" as any).select("id", { count: "exact", head: true }).lt("due_at", nowIso()).neq("status", "done")),
    countRows(supabase, "admin docs", () => supabase.from("documents" as any).select("id", { count: "exact", head: true }).in("status", ["missing", "expired", "rejected"])),
    countRows(supabase, "admin complaints", () => supabase.from("complaints" as any).select("id", { count: "exact", head: true }).neq("status", "closed")),
    countRows(supabase, "admin cameras", () => supabase.from("camera_streams" as any).select("id", { count: "exact", head: true }).in("status", ["pending_gateway", "offline", "failed", "error", "disabled"]))
  ]);
  if (late > 0) insights.push(insight({ role: "admin", recipient_profile_id: recipient, category: "פיקוח", severity: "urgent", title: `${late} גנים באיחור פיקוח`, description: "נדרש טיפול פיקוח מערכתי.", recommended_action: "פתחי איחורי פיקוח", action_url: "/dashboard/admin/inspections/late", dedupe_key: `admin:${profile.id}:late`, metadata: { late } }));
  if (docs > 0) insights.push(insight({ role: "admin", recipient_profile_id: recipient, category: "מסמכים", severity: "warning", title: `${docs} מסמכים חסרים/פגי תוקף`, description: "מסמכים חסרים ברמת המערכת.", recommended_action: "פתחי מסמכים", action_url: "/dashboard/admin/documents", dedupe_key: `admin:${profile.id}:docs`, metadata: { docs } }));
  if (complaints > 0) insights.push(insight({ role: "admin", recipient_profile_id: recipient, category: "הורים", severity: "warning", title: `${complaints} פניות פתוחות`, description: "פניות ותלונות שלא נסגרו.", recommended_action: "פתחי דיווחים ופניות", action_url: "/dashboard/admin/complaints", dedupe_key: `admin:${profile.id}:complaints`, metadata: { complaints } }));
  if (cameras > 0) insights.push(insight({ role: "admin", recipient_profile_id: recipient, category: "מצלמות", severity: "warning", title: `${cameras} מצלמות דורשות בדיקה`, description: "מצלמות ממתינות ל-Gateway או לא מחוברות.", recommended_action: "פתחי אודיט מצלמות", action_url: "/dashboard/admin/camera-audit", dedupe_key: `admin:${profile.id}:cameras`, metadata: { cameras } }));
  return insights;
}

export function summarizeInsightsForAssistant(role: UserRole, insights: SmartInsight[]) {
  const sorted = [...insights].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const top = sorted.slice(0, 6);
  const title = role === "parent" ? "מה התעדכן אצל הילד שלי?" : role === "staff" ? "מה חשוב במשמרת היום?" : role === "inspector" ? "מה לבדוק היום?" : "מה דורש טיפול היום?";
  const summary = top.length
    ? top.map((item) => `${item.title} - ${item.recommended_action}`).join(" · ")
    : role === "parent"
      ? "כרגע אין משהו דחוף. אם יגיע עדכון מהגן, הוא יופיע כאן."
      : "כרגע לא זוהתה פעולה דחופה לפי הנתונים הזמינים.";
  return {
    provider: providerStatus(),
    role,
    title,
    summary,
    suggestions: top.map((item) => ({ title: item.title, body: item.description, href: item.action_url, tone: item.severity === "critical" || item.severity === "urgent" ? "bad" : item.severity === "warning" ? "warn" : "good" })),
    prompts: promptsForRole(role),
    answers: buildAssistantAnswers(role, insights)
  };
}

function severityRank(severity: SmartSeverity) {
  return { info: 1, warning: 2, urgent: 3, critical: 4 }[severity];
}

function promptsForRole(role: UserRole) {
  if (role === "parent") return ["איך עבר היום של הילד שלי?", "האם הילד אכל?", "האם הילד ישן?", "האם יש עדכונים חדשים?", "האם אני צריך להשלים משהו?"];
  if (role === "staff") return ["אילו ילדים עדיין צריכים עדכון?", "מה המשימות שלי היום?", "יש התראות שדורשות טיפול?", "מה כדאי לעשות עכשיו?"];
  if (role === "inspector") return ["אילו גנים צריכים ביקורת?", "אילו ליקויים עדיין פתוחים?", "אילו סיכונים עולים?", "אילו תלונות דורשות בדיקה?"];
  if (role === "admin") return ["אילו גנים דורשים תשומת לב?", "מה הסיכונים התפעוליים הגדולים?", "אילו מנויים בסיכון?", "מה מגמות הפלטפורמה?"];
  return ["מה דורש טיפול היום?", "אילו ילדים דורשים מעקב?", "לאילו אנשי צוות יש משימות פתוחות?", "אילו מסמכים עומדים לפוג?", "אילו נושאים פתוחים קיימים?"];
}

function buildAssistantAnswers(role: UserRole, insights: SmartInsight[]) {
  const answer = (filter: (item: SmartInsight) => boolean, fallback: string) => {
    const rows = insights.filter(filter);
    return rows.length ? rows.map((item) => `${item.title}: ${item.description} מומלץ: ${item.recommended_action}.`).join(" ") : fallback;
  };
  return {
    "איך עבר היום של הילד שלי?": answer((item) => item.category === "ילדים", "אין כרגע עדכון ילד חדש שאושר להצגה. כשהגן יעדכן, הוא יופיע בציר הילד."),
    "האם הילד אכל?": answer((item) => item.category === "ילדים" && (item.title.includes("יומן") || item.title.includes("עדכון")), "אין במערכת עדכון ארוחה מאושר חדש כרגע."),
    "האם הילד ישן?": answer((item) => item.category === "ילדים" && (item.title.includes("יומן") || item.title.includes("עדכון")), "אין במערכת עדכון שינה מאושר חדש כרגע."),
    "האם יש עדכונים חדשים?": answer(() => true, "אין כרגע עדכונים חדשים שדורשים פעולה."),
    "האם אני צריך להשלים משהו?": answer((item) => item.category === "מסמכים" || item.category === "כספים", "אין כרגע פעולה שחסרה מצדך לפי הנתונים הזמינים."),
    "אילו ילדים עדיין צריכים עדכון?": answer((item) => item.category === "ילדים", "לא זוהו ילדים שדורשים עדכון לפי הנתונים הזמינים."),
    "מה המשימות שלי היום?": answer((item) => item.category === "צוות", "לא זוהו משימות פתוחות כרגע."),
    "יש התראות שדורשות טיפול?": answer((item) => item.severity === "warning" || item.severity === "urgent" || item.severity === "critical", "אין כרגע התראות שדורשות טיפול."),
    "מה כדאי לעשות עכשיו?": answer(() => true, "אין פעולה דחופה כרגע. המשיכו בעדכונים ובמשימות השוטפות."),
    "אילו גנים צריכים ביקורת?": answer((item) => item.category === "פיקוח", "לא זוהו ביקורות דחופות לפי הנתונים הזמינים."),
    "אילו ליקויים עדיין פתוחים?": answer((item) => item.title.includes("ליקויים") || item.category === "פיקוח", "לא זוהו ליקויים פתוחים לפי הנתונים הזמינים."),
    "אילו סיכונים עולים?": answer((item) => item.severity === "warning" || item.severity === "urgent" || item.severity === "critical", "לא זוהו סיכונים עולים לפי הנתונים הזמינים."),
    "אילו תלונות דורשות בדיקה?": answer((item) => item.category === "הורים", "לא זוהו תלונות פתוחות שדורשות בדיקה לפי הנתונים הזמינים."),
    "אילו גנים דורשים תשומת לב?": answer((item) => item.kindergarten_id !== null || item.category === "פיקוח", "לא זוהו גנים שדורשים תשומת לב מיידית."),
    "מה הסיכונים התפעוליים הגדולים?": answer((item) => item.severity === "warning" || item.severity === "urgent" || item.severity === "critical", "לא זוהו סיכונים תפעוליים גדולים כרגע."),
    "אילו מנויים בסיכון?": answer((item) => item.category === "כספים", "לא זוהו מנויים או תשלומים בסיכון לפי הנתונים הזמינים."),
    "מה מגמות הפלטפורמה?": answer(() => true, "המגמות מוצגות לפי ההתראות והמדדים הזמינים בלבד. לא הופעלה תחזית חיצונית."),
    "אילו ילדים דורשים מעקב?": answer((item) => item.category === "ילדים", "לא זוהו ילדים שדורשים מעקב כרגע."),
    "לאילו אנשי צוות יש משימות פתוחות?": answer((item) => item.category === "צוות", "לא זוהו משימות צוות פתוחות לפי הנתונים הזמינים."),
    "אילו מסמכים עומדים לפוג?": answer((item) => item.category === "מסמכים", "לא זוהו מסמכים שפג תוקפם או חסרים לפי הנתונים הזמינים."),
    "אילו נושאים פתוחים קיימים?": answer((item) => item.severity !== "info", "אין כרגע נושאים פתוחים שמצריכים טיפול."),
    "מה דורש טיפול היום?": answer((item) => item.severity === "urgent" || item.severity === "critical" || item.severity === "warning", "כרגע אין טיפול דחוף לפי הנתונים הזמינים."),
    "מי לא שילם?": answer((item) => item.category === "כספים", "לא זוהו תשלומים חריגים כרגע."),
    "מי חסר בגדים?": answer((item) => item.dedupe_key.includes("change-clothes"), "לא זוהו ילדים שחסרים להם בגדים להחלפה."),
    "אילו פניות פתוחות?": answer((item) => item.category === "הורים", "לא זוהו פניות פתוחות שדורשות טיפול."),
    "אילו מצלמות לא מחוברות?": answer((item) => item.category === "מצלמות", "לא זוהו מצלמות לא מחוברות לפי הנתונים הזמינים."),
    "מה שכחתי?": answer((item) => item.severity !== "info", role === "parent" ? "אין כרגע פעולה חסרה מצדך." : "אין כרגע פעולה שנראית נשכחת."),
    "מה חשוב עכשיו?": answer(() => true, "הכל נראה רגוע כרגע.")
  };
}

export async function syncSmartInsights(supabase: SupabaseClient<any, any, any>, insights: SmartInsight[]) {
  const persisted: SmartInsight[] = [];
  for (const item of insights) {
    try {
      const existing = await supabase
        .from("smart_insights" as any)
        .select("*")
        .eq("recipient_profile_id", item.recipient_profile_id ?? "")
        .eq("dedupe_key", item.dedupe_key)
        .in("status", ["open", "snoozed"])
        .maybeSingle();
      if (existing.data) {
        persisted.push(existing.data as SmartInsight);
        continue;
      }
      const { data, error } = await supabase.from("smart_insights" as any).insert(item as any).select("*").single();
      if (error) {
        console.error("[smart-engine:insert-insight]", error);
        persisted.push(item);
      } else {
        persisted.push(data as SmartInsight);
      }
    } catch (error) {
      console.error("[smart-engine:sync-insight]", error);
      persisted.push(item);
    }
  }
  return persisted;
}

export async function createNotificationsForUrgentInsights(supabase: SupabaseClient<any, any, any>, insights: SmartInsight[]) {
  const cutoff = hoursAgo(smartThresholds.notificationDedupeHours);
  for (const item of insights.filter((insight) => insight.severity === "urgent" || insight.severity === "critical")) {
    if (!item.recipient_profile_id) continue;
    try {
      const existing = await supabase
        .from("notifications" as any)
        .select("id")
        .eq("recipient_profile_id", item.recipient_profile_id)
        .eq("entity_type", "smart_insight")
        .eq("metadata->>dedupe_key", item.dedupe_key)
        .gte("created_at", cutoff)
        .limit(1);
      if ((existing.data ?? []).length > 0) continue;
      await supabase.from("notifications" as any).insert({
        recipient_id: item.recipient_profile_id,
        recipient_profile_id: item.recipient_profile_id,
        recipient_role: item.role,
        garden_id: item.kindergarten_id ?? null,
        kindergarten_id: item.kindergarten_id ?? null,
        child_id: item.child_id ?? null,
        entity_type: "smart_insight",
        entity_id: item.id ?? null,
        title: item.title,
        body: item.description,
        message: item.description,
        severity: item.severity,
        status: "unread",
        action_url: item.action_url,
        metadata: { dedupe_key: item.dedupe_key, category: item.category, recommended_action: item.recommended_action }
      } as any);
    } catch (error) {
      console.error("[smart-engine:notification]", error);
    }
  }
}
