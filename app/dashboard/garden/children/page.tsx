import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { ChildrenProfileCards } from "@/components/people-profile-cards";
import { Avatar } from "@/components/avatar";
import { ChildStatusActions } from "@/components/child-status-actions";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const filterLabels: Record<string, string> = {
  "change-clothes": "ילדים שחסר להם בגדים להחלפה",
  "parent-requests": "ילדים עם פניות הורים פתוחות",
  "health": "ילדים עם דגש בריאותי",
  "payments": "ילדים עם תשלום לטיפול"
};

export default async function GardenChildrenPage({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string; missing?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [childrenRes, attendanceRes, journalsRes, incidentsRes, feeGroupsRes, requestsRes] = await Promise.all([
    supabase.from("children" as any).select("*").eq("garden_id", gardenId).order("full_name"),
    supabase.from("attendance" as any).select("child_id, status, pickup_authorized, pickup_name, note").eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood, bathroom, incidents, notes_to_parents, photo_urls").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("incident_reports" as any).select("child_id, id").eq("garden_id", gardenId).neq("status", "closed"),
    supabase.from("kindergarten_fee_groups" as any).select("id, group_name, monthly_fee").eq("garden_id", gardenId),
    supabase.from("parent_child_requests" as any).select("id, child_id, status").eq("garden_id", gardenId).in("status", ["new", "viewed"])
  ]);
  if (childrenRes.error) console.error("[garden-children] children query failed", { garden_id: gardenId, error: childrenRes.error.message });
  if (attendanceRes.error) console.error("[garden-children] attendance query failed", { garden_id: gardenId, error: attendanceRes.error.message });
  if (journalsRes.error) console.error("[garden-children] journals query failed", { garden_id: gardenId, error: journalsRes.error.message });
  if (incidentsRes.error) console.error("[garden-children] incidents query failed", { garden_id: gardenId, error: incidentsRes.error.message });
  if (feeGroupsRes.error) console.error("[garden-children] fee groups query failed", { garden_id: gardenId, error: feeGroupsRes.error.message });
  if (requestsRes.error) console.error("[garden-children] requests query failed", { garden_id: gardenId, error: requestsRes.error.message });
  const attendanceByChild = new Map((attendanceRes.data ?? []).map((row: any) => [row.child_id, row]));
  const journalByChild = new Map((journalsRes.data ?? []).map((row: any) => [row.child_id, row]));
  const feeGroups = (feeGroupsRes.data ?? []) as any[];
  const feeById = new Map(feeGroups.map((group) => [group.id, group]));
  const incidentCount = new Map<string, number>();
  for (const incident of (incidentsRes.data ?? []) as any[]) incidentCount.set(incident.child_id, (incidentCount.get(incident.child_id) ?? 0) + 1);
  const requestCount = new Map<string, number>();
  for (const request of (requestsRes.data ?? []) as any[]) requestCount.set(request.child_id, (requestCount.get(request.child_id) ?? 0) + 1);
  const allRows = ((childrenRes.data ?? []) as any[]).map((child) => {
    const attendance = attendanceByChild.get(child.id) as any;
    const journal = journalByChild.get(child.id) as any;
    const group = feeById.get(child.payment_group_id) ?? feeGroups.find((item) => item.group_name === child.age_group || item.group_name === child.classroom);
    const hasSpecialArrangement = child.custom_monthly_fee !== null && child.custom_monthly_fee !== undefined && (!child.arrangement_valid_until || new Date(child.arrangement_valid_until).getTime() >= Date.now());
    const meals = Array.isArray(journal?.meals) ? journal.meals.map((meal: any) => meal.text ?? meal).join(", ") : "";
    return {
      ...child,
      fee_group_name: group?.group_name ?? child.classroom ?? child.age_group ?? "ללא קבוצת תשלום",
      group_monthly_fee: group?.monthly_fee ?? child.monthly_fee,
      actual_monthly_fee: hasSpecialArrangement ? Number(child.custom_monthly_fee ?? 0) : Number(group?.monthly_fee ?? child.monthly_fee ?? 0),
      has_special_arrangement: hasSpecialArrangement,
      open_parent_requests: requestCount.get(child.id) ?? 0,
      attendance_status: attendance?.status ?? "not_updated",
      pickup_status: attendance?.pickup_name ? `נאסף על ידי ${attendance.pickup_name}` : "ממתין לאיסוף",
      child_file_label: child.permanent_child_file_id ? "תיק ילד קבוע" : "תיק מעבר",
      pickup_authorized: attendance?.pickup_authorized,
      meals_text: meals,
      sleep_summary: journal?.sleep_summary,
      mood: journal?.mood,
      notes_to_parents: journal?.notes_to_parents,
      photo_urls: journal?.photo_urls ?? [],
      incident_count: incidentCount.get(child.id) ?? 0
    };
  });
  const rows = allRows.filter((row) => {
    if (params.missing === "meal") return !row.meals_text;
    if (params.missing === "sleep") return !row.sleep_summary;
    if (params.filter === "change-clothes") return row.has_change_clothes === false;
    if (params.filter === "parent-requests") return Number(row.open_parent_requests ?? 0) > 0;
    if (params.filter === "health") return Boolean(row.allergies || row.medical_notes || row.regular_medications);
    if (params.filter === "payments") return ["overdue", "unpaid", "partial", "failed", "not_transferred"].includes(row.payment_status);
    if (params.view === "attention") return Boolean(row.allergies || row.medical_notes || row.has_change_clothes === false || row.open_parent_requests || ["overdue", "unpaid", "partial", "failed", "not_transferred"].includes(row.payment_status) || row.attendance_status === "not_updated" || row.incident_count);
    return true;
  });
  const label = params.missing === "meal" ? "ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "ילדים ללא עדכון שינה" : filterLabels[params.filter ?? ""] ?? (params.view === "attention" ? "ילדים שדורשים תשומת לב" : null);
  const emptyTitle = params.missing === "meal" ? "אין כרגע ילדים ללא עדכון ארוחה" : params.missing === "sleep" ? "אין כרגע ילדים ללא עדכון שינה" : label ? `אין כרגע ${label}` : undefined;

  return (
    <DashboardShell role="manager" title="ילדים">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Children Profiles</p><h1>מערכת כרטיסי ילדים חכמה.</h1><p>לא עוד רשימה אפורה: תמונה, נוכחות, בריאות, איסוף, יומן יומי ואירועים בכרטיס אחד.</p></div><span className="pill good">{rows.length} ילדים</span></div>
      <DashboardFilterChip label={label} clearHref="/dashboard/garden/children" isEmpty={rows.length === 0} emptyTitle={emptyTitle} emptyText="כל הילדים הרלוונטיים כבר טופלו במסנן הזה. אפשר לנקות סינון כדי לראות את כל הילדים." />
      <div className="grid cols-4 dashboard-kpis"><StatCard label="נוכחים היום" value={rows.filter((row) => row.attendance_status === "present").length} tone="good" /><StatCard label="טרם עודכנו" value={rows.filter((row) => row.attendance_status === "not_updated").length} tone="warn" /><StatCard label="אלרגיות" value={rows.filter((row) => row.allergies).length} tone="bad" /><StatCard label="אירועים פתוחים" value={rows.reduce((sum, row) => sum + Number(row.incident_count ?? 0), 0)} tone="warn" /></div>

      <section className="dashboard-section">
        <div className="section-heading"><h2>ילדים ממתינים לאישור</h2><p>בקשות רישום שהורים שלחו, כולל בריאות, אלרגיות, מורשי איסוף ותמונה אם הועלתה.</p></div>
        {rows.filter((row) => row.status === "pending_manager_approval" || row.status === "missing_info" || row.status === "request_missing_details" || row.status === "rejected").length === 0 ? <div className="empty-state"><strong>אין ילדים ממתינים לאישור</strong><span>כאשר הורה יוסיף ילד נוסף או ישלים כרטיס, הבקשה תופיע כאן לאישור מנהלת.</span></div> : <div className="people-card-grid">{rows.filter((row) => row.status === "pending_manager_approval" || row.status === "missing_info" || row.status === "request_missing_details" || row.status === "rejected").map((child) => <article className="person-card child-profile-card" key={`pending-${child.id}`}><div className="person-card-top"><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" /><div><span className="pill warn">{child.status}</span><h3>{child.full_name}</h3><p>{child.child_age ? `גיל ${child.child_age}` : child.birth_date ?? "תאריך לידה חסר"} · {child.requested_age_group ?? child.age_group ?? child.classroom ?? "קבוצה לא הוגדרה"}</p><p>תחילת גן: {child.requested_start_date ? new Date(child.requested_start_date).toLocaleDateString("he-IL") : "לא צוינה"}</p></div></div><div className="profile-badge-row"><span className={child.allergies ? "pill bad" : "pill good"}>אלרגיות: {child.allergies || "אין"}</span><span className="pill">קופה: {child.hmo ?? "-"}</span><span className="pill">מורשי איסוף: {Array.isArray(child.pickup_authorized) ? child.pickup_authorized.length : 0}</span><span className={child.parent_photo_url || child.mother_photo_url || child.father_photo_url ? "pill good" : "pill warn"}>תמונת הורה</span></div><div className="gallery-preview approval-photo-preview">{[child.photo_url ?? child.face_image_url, child.parent_photo_url, child.mother_photo_url, child.father_photo_url].filter(Boolean).map((url: string) => <img src={url} alt="תמונת רישום" key={url} />)}</div><details className="profile-expand"><summary>פרטי בקשה</summary><div className="profile-details-grid"><section><h4>הורה</h4><p>{child.mother_name ?? child.father_name ?? child.lead_parent_name ?? "לא צוין"}</p><p>{child.mother_phone ?? child.father_phone ?? child.lead_parent_phone ?? child.emergency_phone ?? "אין טלפון"}</p><p>ת״ז אם: {child.mother_identity_number ?? "-"}</p><p>ת״ז אב: {child.father_identity_number ?? "-"}</p><p>כתובת: {child.address ?? "-"}</p></section><section><h4>בריאות והיכרות</h4><p>{child.important_notes || child.medical_notes || "אין הערה מיוחדת"}</p><p>אוהב/ת: {child.likes_notes || "-"}</p><p>פחות מתחבר/ת: {child.dislikes_notes || "-"}</p><p>תרופות: {child.regular_medications || "אין"}</p></section><section><h4>איסוף ותמונות</h4><p>מורשי איסוף: {Array.isArray(child.pickup_authorized) ? child.pickup_authorized.map((item: any) => item.name).join(", ") : "-"}</p><div className="gallery-preview">{Array.isArray(child.pickup_authorized) ? child.pickup_authorized.map((item: any) => item.photo_url).filter(Boolean).map((url: string) => <img src={url} alt="מורשה איסוף" key={url} />) : null}</div><p>תמונת ילד: {child.photo_url || child.face_image_url ? "הועלתה" : "חסרה"}</p><p>תמונת הורה: {child.parent_photo_url || child.mother_photo_url || child.father_photo_url ? "הועלתה" : "חסרה"}</p></section></div></details><ChildStatusActions childId={child.id} /></article>)}</div>}
      </section>
      <ChildrenProfileCards children={rows.filter((row) => row.status === "active" || row.status === "approved")} />
    </DashboardShell>
  );
}
