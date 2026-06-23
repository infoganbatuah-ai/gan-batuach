import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { ChildrenProfileCards } from "@/components/people-profile-cards";
import { Avatar } from "@/components/avatar";
import { ChildStatusActions } from "@/components/child-status-actions";
import { GardenChildCreatePanel } from "@/components/garden-child-create-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Baby, CheckCircle2, Heart, Moon, Plus, Smile, Utensils, UsersRound } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherFilterPills,
  TeacherPageTitle,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

const filterLabels: Record<string, string> = {
  "change-clothes": "ילדים שחסר להם בגדים להחלפה",
  "parent-requests": "ילדים עם פניות הורים פתוחות",
  "health": "ילדים עם דגש בריאותי",
  "payments": "ילדים עם תשלום לטיפול"
};

export default async function GardenChildrenPage({ searchParams }: { searchParams: Promise<{ view?: string; filter?: string; missing?: string; new?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const [childrenRes, attendanceRes, journalsRes, incidentsRes, feeGroupsRes, requestsRes, gardenRes] = await Promise.all([
    supabase.from("children" as any).select("*").eq("garden_id", gardenId).order("full_name"),
    supabase.from("attendance" as any).select("child_id, status, pickup_authorized, pickup_name, note").eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("child_daily_journals" as any).select("child_id, meals, sleep_summary, mood, bathroom, incidents, notes_to_parents, photo_urls").eq("garden_id", gardenId).eq("journal_date", today),
    supabase.from("incident_reports" as any).select("child_id, id").eq("garden_id", gardenId).neq("status", "closed"),
    supabase.from("kindergarten_fee_groups" as any).select("id, group_name, monthly_fee").eq("garden_id", gardenId),
    supabase.from("parent_child_requests" as any).select("id, child_id, status").eq("garden_id", gardenId).in("status", ["new", "viewed"]),
    supabase.from("gardens" as any).select("name").eq("id", gardenId).maybeSingle()
  ]);
  if (childrenRes.error) console.error("[garden-children] children query failed", { garden_id: gardenId, error: childrenRes.error.message });
  if (attendanceRes.error) console.error("[garden-children] attendance query failed", { garden_id: gardenId, error: attendanceRes.error.message });
  if (journalsRes.error) console.error("[garden-children] journals query failed", { garden_id: gardenId, error: journalsRes.error.message });
  if (incidentsRes.error) console.error("[garden-children] incidents query failed", { garden_id: gardenId, error: incidentsRes.error.message });
  if (feeGroupsRes.error) console.error("[garden-children] fee groups query failed", { garden_id: gardenId, error: feeGroupsRes.error.message });
  if (requestsRes.error) console.error("[garden-children] requests query failed", { garden_id: gardenId, error: requestsRes.error.message });
  if (gardenRes.error) console.error("[garden-children] garden query failed", { garden_id: gardenId, error: gardenRes.error.message });
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

  const present = rows.filter((row) => row.attendance_status === "present").length;
  const missing = rows.filter((row) => row.attendance_status === "not_updated").length;
  const allergyCount = rows.filter((row) => row.allergies).length;
  const openIncidents = rows.reduce((sum, row) => sum + Number(row.incident_count ?? 0), 0);
  const selected = rows[0];
  const pendingRows = rows.filter((row) => row.status === "pending_manager_approval" || row.status === "missing_info" || row.status === "request_missing_details" || row.status === "rejected");

  return (
    <DashboardShell role="manager" title="ילדים" appHome>
      <TeacherAppFrame
        title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מנהלת"}`}
        subtitle={(gardenRes.data as any)?.name ?? "ניהול ילדי הגן"}
        avatarUrl={(profile as any).avatar_url ?? null}
        active="children"
      >
        <TeacherPageTitle
          icon={UsersRound}
          title="ילדי הגן"
          subtitle="ניהול כיתה · צפייה · מעקב · תקשורת"
          action={<a className="button primary" href="/dashboard/garden/children?new=1"><Plus size={18} /> הוסף ילד/ה</a>}
        />

        <TeacherStatsGrid>
          <TeacherStatCard title="סך הילדים" value={rows.length} hint="פעילים וממתינים" icon={Smile} tone="blue" />
          <TeacherStatCard title="נוכחים היום" value={present} hint={`${Math.max(rows.length, 1)} סך הכל`} icon={CheckCircle2} tone="green" href="/dashboard/garden/attendance" />
          <TeacherStatCard title="נחים עכשיו" value={rows.filter((row) => row.sleep_summary).length} hint="מעקב יומי" icon={Moon} tone="orange" />
          <TeacherStatCard title="זקוקים לתשומת לב" value={allergyCount + openIncidents} hint="בריאות / אירוע" icon={Heart} tone={allergyCount + openIncidents ? "red" : "green"} />
        </TeacherStatsGrid>

        <TeacherFilterPills
          items={[
            { label: "סינון", href: "/dashboard/garden/children", active: !label },
            { label: "סטטוס: הכל", href: "/dashboard/garden/children" },
            { label: "קבוצת גיל: הכל", href: "/dashboard/garden/children" },
            { label: "קבוצה: כל הגן", href: "/dashboard/garden/children" },
            { label: "דורש תשומת לב", href: "/dashboard/garden/children?view=attention", active: params.view === "attention" }
          ]}
        />

        <DashboardFilterChip label={label} clearHref="/dashboard/garden/children" isEmpty={rows.length === 0} emptyTitle={emptyTitle} emptyText="כל הילדים הרלוונטיים כבר טופלו במסנן הזה. אפשר לנקות סינון כדי לראות את כל הילדים." />

        {params.new === "1" ? <GardenChildCreatePanel gardenId={gardenId} defaultOpen /> : null}

        <section className="teacher-children-layout">
          <TeacherSection title="רשימת ילדים" action={<a href="/dashboard/garden/children">צפייה בכל הילדים</a>}>
            {rows.length ? (
              <TeacherCompactList>
                {rows.slice(0, 7).map((child, index) => (
                  <TeacherCompactItem
                    key={child.id}
                    title={child.full_name ?? "ילד/ה"}
                    subtitle={`${child.child_age ? `${child.child_age} שנים` : child.birth_date ?? "גיל לא צוין"} · ${child.classroom ?? child.age_group ?? "קבוצה לא הוגדרה"}`}
                    tone={child.attendance_status === "present" ? "green" : child.allergies ? "red" : index === 0 ? "purple" : "blue"}
                    avatar={child.photo_url ?? child.face_image_url}
                    href={`/dashboard/garden/children/${child.id}`}
                    meta={child.attendance_status === "present" ? "נוכח" : child.attendance_status === "not_updated" ? "לא עודכן" : "מעקב"}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="עדיין אין ילדים ברשימה" text="הוסיפי ילד או אשרי בקשת הצטרפות כדי להתחיל." />
            )}
          </TeacherSection>

          <TeacherSection title={selected?.full_name ?? "כרטיס ילד"} subtitle={selected ? `${selected.child_age ?? ""} · ${selected.classroom ?? selected.age_group ?? "גן"}` : "בחרי ילד מהרשימה"}>
            {selected ? (
              <div className="teacher-child-mini-card">
                <Avatar name={selected.full_name} src={selected.photo_url ?? selected.face_image_url} size="lg" />
                <div className="teacher-child-mini-actions">
                  <span><Utensils size={18} /> אוכל</span>
                  <span><Moon size={18} /> שינה</span>
                  <span><Heart size={18} /> בריאות</span>
                  <span><Baby size={18} /> התנהגות</span>
                </div>
                <div className="teacher-child-info-grid">
                  <span>תאריך לידה <b>{selected.birth_date ? new Date(selected.birth_date).toLocaleDateString("he-IL") : "-"}</b></span>
                  <span>קבוצה <b>{selected.classroom ?? selected.age_group ?? "-"}</b></span>
                  <span>מחנכת <b>{profile.full_name ?? "מנהלת הגן"}</b></span>
                </div>
                <p className="teacher-child-note">{selected.notes_to_parents || selected.important_notes || "הכל נראה מצוין. מצב רוח טוב ושיתוף פעולה."}</p>
                <a className="button primary" href={`/dashboard/garden/children/${selected.id}`}>צפייה בפרופיל המלא</a>
              </div>
            ) : (
              <TeacherEmptyState title="אין ילד להצגה" text="ברגע שיתווסף ילד, כרטיס מקוצר יופיע כאן." />
            )}
          </TeacherSection>
        </section>

        <TeacherAiInsight metric={rows.length ? `+${Math.max(1, 100 - missing)}%` : "+0%"}>
          {allergyCount ? "יש ילדים עם דגש רפואי. מומלץ לבדוק את הכרטיסים לפני פעילות חצר." : "הקבוצה נראית מאוזנת להיום. אפשר לעדכן ארוחות ושינה מהירה."}
        </TeacherAiInsight>

        <details className="teacher-management-details">
          <summary>ניהול מלא ופרטים מתקדמים</summary>
          <div>
            <section className="manager-report-row"><span>חסרי ארוחה <b>{rows.filter((row) => !row.meals_text).length}</b></span><span>חסרי שינה <b>{rows.filter((row) => !row.sleep_summary).length}</b></span><span>פניות הורים <b>{rows.reduce((sum, row) => sum + Number(row.open_parent_requests ?? 0), 0)}</b></span><span>תשלומים לטיפול <b>{rows.filter((row) => ["overdue", "unpaid", "partial", "failed", "not_transferred"].includes(row.payment_status)).length}</b></span></section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>ממתינים לאישור</h2><p>בקשות שהורים השלימו ומחכות להחלטה.</p></div>
        {pendingRows.length === 0 ? <div className="empty-state"><strong>אין ילדים ממתינים לאישור</strong><span>כאשר הורה יוסיף ילד נוסף או ישלים כרטיס, הבקשה תופיע כאן לאישור מנהלת.</span></div> : <div className="people-card-grid">{pendingRows.map((child) => <article className="person-card child-profile-card" key={`pending-${child.id}`}><div className="person-card-top"><Avatar name={child.full_name} src={child.photo_url ?? child.face_image_url} size="lg" /><div><span className="pill warn">{child.status}</span><h3>{child.full_name}</h3><p>{child.child_age ? `גיל ${child.child_age}` : child.birth_date ?? "תאריך לידה חסר"} · {child.requested_age_group ?? child.age_group ?? child.classroom ?? "קבוצה לא הוגדרה"}</p><p>תחילת גן: {child.requested_start_date ? new Date(child.requested_start_date).toLocaleDateString("he-IL") : "לא צוינה"}</p></div></div><div className="profile-badge-row"><span className={child.allergies ? "pill bad" : "pill good"}>אלרגיות: {child.allergies || "אין"}</span><span className="pill">קופה: {child.hmo ?? "-"}</span><span className="pill">מורשי איסוף: {Array.isArray(child.pickup_authorized) ? child.pickup_authorized.length : 0}</span><span className={child.parent_photo_url || child.mother_photo_url || child.father_photo_url ? "pill good" : "pill warn"}>תמונת הורה</span></div><div className="gallery-preview approval-photo-preview">{[child.photo_url ?? child.face_image_url, child.parent_photo_url, child.mother_photo_url, child.father_photo_url].filter(Boolean).map((url: string) => <img src={url} alt="תמונת רישום" key={url} />)}</div><details className="profile-expand"><summary>פרטי בקשה</summary><div className="profile-details-grid"><section><h4>הורה</h4><p>{child.mother_name ?? child.father_name ?? child.lead_parent_name ?? "לא צוין"}</p><p>{child.mother_phone ?? child.father_phone ?? child.lead_parent_phone ?? child.emergency_phone ?? "אין טלפון"}</p><p>ת״ז אם: {child.mother_identity_number ?? "-"}</p><p>ת״ז אב: {child.father_identity_number ?? "-"}</p><p>כתובת: {child.address ?? "-"}</p></section><section><h4>בריאות והיכרות</h4><p>{child.important_notes || child.medical_notes || "אין הערה מיוחדת"}</p><p>אוהב/ת: {child.likes_notes || "-"}</p><p>פחות מתחבר/ת: {child.dislikes_notes || "-"}</p><p>תרופות: {child.regular_medications || "אין"}</p></section><section><h4>איסוף ותמונות</h4><p>מורשי איסוף: {Array.isArray(child.pickup_authorized) ? child.pickup_authorized.map((item: any) => item.name).join(", ") : "-"}</p><div className="gallery-preview">{Array.isArray(child.pickup_authorized) ? child.pickup_authorized.map((item: any) => item.photo_url).filter(Boolean).map((url: string) => <img src={url} alt="מורשה איסוף" key={url} />) : null}</div><p>תמונת ילד: {child.photo_url || child.face_image_url ? "הועלתה" : "חסרה"}</p><p>תמונת הורה: {child.parent_photo_url || child.mother_photo_url || child.father_photo_url ? "הועלתה" : "חסרה"}</p></section></div></details><ChildStatusActions childId={child.id} /></article>)}</div>}
      </section>
      <ChildrenProfileCards children={rows.filter((row) => row.status === "active" || row.status === "approved")} />
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
