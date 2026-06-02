import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminInspectorsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("מפקחים", async () => {
    const supabase = await createClient();
    const [inspectorsRes, gardensRes, inspectionsRes, tasksRes] = await Promise.all([
      supabase.from("inspectors" as any).select("id, service_cities, certification_notes, created_at, profiles:id(full_name, phone, email, active, profile_image_url)"),
      supabase.from("gardens" as any).select("id, name, city, inspector_id"),
      supabase.from("inspections" as any).select("id, inspector_id, garden_id, completed_at, weighted_score, status, gardens:garden_id(name,city)").order("completed_at", { ascending: false }),
      supabase.from("tasks" as any).select("id, assigned_to, status").neq("status", "done")
    ]);
    logSupabaseError("מפקחים", inspectorsRes.error ?? gardensRes.error ?? inspectionsRes.error ?? tasksRes.error);
    const gardensByInspector = (gardensRes.data ?? []).reduce((acc: Record<string, any[]>, garden: any) => { if (garden.inspector_id) (acc[garden.inspector_id] ??= []).push(garden); return acc; }, {});
    const inspectionsByInspector = (inspectionsRes.data ?? []).reduce((acc: Record<string, any[]>, inspection: any) => { if (inspection.inspector_id) (acc[inspection.inspector_id] ??= []).push(inspection); return acc; }, {});
    const tasksByInspector = (tasksRes.data ?? []).reduce((acc: Record<string, number>, task: any) => { if (task.assigned_to) acc[task.assigned_to] = (acc[task.assigned_to] ?? 0) + 1; return acc; }, {});
    return { rows: (inspectorsRes.data ?? []) as any[], gardensByInspector, inspectionsByInspector, tasksByInspector, queryError: inspectorsRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], gardensByInspector: {}, inspectionsByInspector: {}, tasksByInspector: {}, queryError: null as string | null });

  return <DashboardShell role="admin" title="מפקחים">
    <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Inspectors Directory</p><h1>ניהול מפקחים וביקורות.</h1><p>ערים משויכות, גנים באחריות, משימות פעילות והיסטוריית ביקורות.</p></div><Link className="button primary" href="/dashboard/admin/users/new-inspector">הוספת מפקח</Link></div>
    <AdminDataError message={result.error ?? result.data.queryError} />
    <section className="dashboard-section">{result.data.rows.length === 0 ? <div className="empty-state"><strong>אין מפקחים להצגה</strong><span>מפקח שייווצר ידנית או מליד יופיע כאן.</span></div> : <div className="procedure-list">{result.data.rows.map((inspector) => {
      const profile = Array.isArray(inspector.profiles) ? inspector.profiles[0] : inspector.profiles;
      const gardens = result.data.gardensByInspector?.[inspector.id] ?? [];
      const inspections = result.data.inspectionsByInspector?.[inspector.id] ?? [];
      return <article className="card procedure-card" key={inspector.id}><div><span className={profile?.active === false ? "pill bad" : "pill good"}>{profile?.active === false ? "לא פעיל" : "פעיל"}</span><h3>{profile?.full_name ?? "פקח"}</h3><p>{Array.isArray(inspector.service_cities) ? inspector.service_cities.join(", ") : ""}</p><small>גנים משויכים: {gardens.map((garden: any) => garden.name).join(", ") || "-"} · ביקורות שהושלמו: {inspections.filter((inspection: any) => inspection.status === "done").length} · משימות פעילות: {result.data.tasksByInspector?.[inspector.id] ?? 0}</small><div className="stack-list">{inspections.slice(0, 4).map((inspection: any) => <div className="list-item" key={inspection.id}><div><strong>{inspection.gardens?.name ?? inspection.garden_id}</strong><span>{inspection.completed_at ? new Date(inspection.completed_at).toLocaleString("he-IL") : "פתוחה"}</span></div><span className="pill">{inspection.weighted_score ?? inspection.status ?? "-"}</span></div>)}</div></div><div className="procedure-meta"><Link className="button secondary" href="/dashboard/admin/inspection-forms">טפסים</Link><Link className="button secondary" href="/dashboard/admin/tasks">משימות</Link><Link className="button" href="/dashboard/admin/users">פרופיל</Link></div></article>;
    })}</div>}</section>
  </DashboardShell>;
}
