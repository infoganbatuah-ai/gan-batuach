import Link from "next/link";
import { ClipboardCheck, UsersRound } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardGrid, EmptyState, ListRowCard, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function inspectionStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    done: "הושלמה",
    completed: "הושלמה",
    in_progress: "בביצוע",
    planned: "מתוכננת",
    scheduled: "מתוכננת",
    pending: "ממתינה",
    overdue: "באיחור"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "פתוחה";
}

export default async function AdminInspectorsPage() {
  const { profile } = await requireRole(["admin"]);
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

  const activeInspectors = result.data.rows.filter((inspector: any) => {
    const profileRow = Array.isArray(inspector.profiles) ? inspector.profiles[0] : inspector.profiles;
    return profileRow?.active !== false;
  }).length;
  const assignedGardens = Object.values(result.data.gardensByInspector ?? {}).reduce((sum: number, gardens: any) => sum + (Array.isArray(gardens) ? gardens.length : 0), 0);
  const openTasks = Object.values(result.data.tasksByInspector ?? {}).reduce((sum: number, count: any) => sum + Number(count ?? 0), 0);

  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/inspectors" title="ניהול מפקחים" subtitle="שיבוצים, עומסים, ביקורות פתוחות ומוכנות פיקוח." badge="מפקחים">
    <PremiumCard size="lg" className="admin-section-card">
      <SectionHeader eyebrow="Inspectors Directory" title="ניהול מפקחים וביקורות" subtitle="ערים משויכות, גנים באחריות, משימות פעילות והיסטוריית ביקורות." icon={UsersRound} action={<Link className="admin-primary-button" href="/dashboard/admin/users/new-inspector">הוספת מפקח</Link>} />
    </PremiumCard>
    <DashboardGrid columns={4}>
      <MetricCard label="מפקחים" value={result.data.rows.length} hint="סה״כ" icon={UsersRound} tone="primary" />
      <MetricCard label="פעילים" value={activeInspectors} hint="מאושרים לגישה" icon={UsersRound} tone="success" />
      <MetricCard label="גנים משויכים" value={assignedGardens} hint="טווח אחריות" icon={ClipboardCheck} tone="primary" />
      <MetricCard label="משימות פתוחות" value={openTasks} hint="דורש מעקב" icon={ClipboardCheck} tone={openTasks ? "warning" : "success"} />
    </DashboardGrid>
    <AdminDataError message={result.error ?? result.data.queryError} />
    <PremiumCard size="lg" className="admin-section-card">
      <SectionHeader title="רשימת מפקחים" subtitle="כל מפקח מוצג עם שיבוץ גנים, ביקורות ומשימות פתוחות." icon={UsersRound} />
      {result.data.rows.length === 0 ? <EmptyState title="אין מפקחים להצגה" text="מפקח שייווצר ידנית או מליד יופיע כאן." icon={UsersRound} /> : <div className="admin-list-stack">{result.data.rows.map((inspector) => {
      const profile = Array.isArray(inspector.profiles) ? inspector.profiles[0] : inspector.profiles;
      const gardens = result.data.gardensByInspector?.[inspector.id] ?? [];
      const inspections = result.data.inspectionsByInspector?.[inspector.id] ?? [];
      const completed = inspections.filter((inspection: any) => ["done", "completed"].includes(String(inspection.status))).length;
      return <ListRowCard
        key={inspector.id}
        href="/dashboard/admin/users"
        title={profile?.full_name ?? "מפקח"}
        subtitle={Array.isArray(inspector.service_cities) ? inspector.service_cities.join(", ") : "אזור לא צוין"}
        meta={`גנים משויכים: ${gardens.map((garden: any) => garden.name).join(", ") || "-"} · ביקורות שהושלמו: ${completed} · משימות פעילות: ${result.data.tasksByInspector?.[inspector.id] ?? 0}`}
        status={<StatusChip tone={profile?.active === false ? "danger" : "success"}>{profile?.active === false ? "לא פעיל" : "פעיל"}</StatusChip>}
        actions={<div className="gb-list-actions"><Link className="admin-link-button" href="/dashboard/admin/inspection-forms">טפסים</Link><Link className="admin-link-button" href="/dashboard/admin/tasks">משימות</Link>{inspections[0] ? <StatusChip tone="primary">{inspections[0].weighted_score ?? inspectionStatusLabel(inspections[0].status)}</StatusChip> : null}</div>}
      />;
    })}</div>}
    </PremiumCard>
  </AdminAppFrame>;
}
