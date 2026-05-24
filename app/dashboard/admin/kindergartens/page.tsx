import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function countByGarden(rows: any[] | null | undefined) {
  return (rows ?? []).reduce((acc: Record<string, number>, row: any) => {
    if (row.garden_id) acc[row.garden_id] = (acc[row.garden_id] ?? 0) + 1;
    return acc;
  }, {});
}

export default async function AdminKindergartensPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("גנים", async () => {
    const supabase = await createClient();
    const [gardensRes, childrenRes, parentsRes, staffRes, camerasRes, inspectionsRes, aiRes] = await Promise.all([
      supabase.from("gardens" as any).select("id, name, city, address, image_url, ages, framework_type, children_capacity, current_children_count, staff_count, safe_status, status, rating, inspector_id, manager_id, owner_profile_id, owner_name, last_inspection_score, last_inspection_at, next_inspection_at, created_at, inspection_required_status, managers:manager_id(full_name), owners:owner_profile_id(full_name), inspectors:inspector_id(full_name)").order("created_at", { ascending: false }),
      supabase.from("children" as any).select("garden_id"),
      supabase.from("parents" as any).select("garden_id"),
      supabase.from("staff" as any).select("garden_id"),
      supabase.from("camera_streams" as any).select("garden_id,status,ai_enabled"),
      supabase.from("inspections" as any).select("id,garden_id,completed_at,weighted_score,status").order("completed_at", { ascending: false }),
      supabase.from("ai_events" as any).select("garden_id,status,severity")
    ]);
    logSupabaseError("גנים", gardensRes.error ?? childrenRes.error ?? parentsRes.error ?? staffRes.error ?? camerasRes.error ?? inspectionsRes.error ?? aiRes.error);
    const cameraStats = (camerasRes.data ?? []).reduce((acc: Record<string, any>, camera: any) => {
      const entry = acc[camera.garden_id] ?? { total: 0, online: 0, ai: 0 };
      entry.total += 1;
      if (camera.status === "online") entry.online += 1;
      if (camera.ai_enabled) entry.ai += 1;
      acc[camera.garden_id] = entry;
      return acc;
    }, {});
    const lastInspection = (inspectionsRes.data ?? []).reduce((acc: Record<string, any>, inspection: any) => {
      if (!acc[inspection.garden_id]) acc[inspection.garden_id] = inspection;
      return acc;
    }, {});
    return {
      rows: (gardensRes.data ?? []) as any[],
      children: countByGarden(childrenRes.data),
      parents: countByGarden(parentsRes.data),
      staff: countByGarden(staffRes.data),
      cameraStats,
      aiStats: countByGarden(aiRes.data),
      lastInspection,
      queryError: gardensRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null
    };
  }, { rows: [] as any[], children: {}, parents: {}, staff: {}, cameraStats: {}, aiStats: {}, lastInspection: {}, queryError: null as string | null });

  return <DashboardShell role="admin" title="גנים">
    <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Kindergarten Directory</p><h1>ספריית גני הילדים המלאה.</h1><p>ניהול גנים, צוות, פיקוח, מצלמות, AI ומצב בטיחות במקום אחד.</p></div><Link className="button primary" href="/dashboard/admin/users/new-kindergarten">הוספת גן</Link></div>
    <AdminDataError message={result.error ?? result.data.queryError} />
    <section className="dashboard-section">{result.data.rows.length === 0 ? <div className="empty-state"><strong>אין גנים להצגה</strong><span>גן שייווצר ידנית או מליד יופיע כאן.</span></div> : <div className="procedure-list">{result.data.rows.map((garden) => {
      const cameras = result.data.cameraStats?.[garden.id] ?? { total: 0, online: 0, ai: 0 };
      const latest = result.data.lastInspection?.[garden.id];
      return <article className="card procedure-card" key={garden.id}><div><div className="garden-card-top"><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status ?? "pending"}</span><span className="pill">{garden.inspection_required_status ?? "pending_first_inspection"}</span></div><h3>{garden.name}</h3><p>{garden.city} · {garden.address ?? "ללא כתובת"} · גילאים: {Array.isArray(garden.ages) && garden.ages.length ? garden.ages.join(", ") : garden.framework_type ?? "מעורב"}</p><small>מנהלת: {garden.managers?.full_name ?? "-"} · בעלים: {garden.owners?.full_name ?? garden.owner_name ?? "-"} · פקח: {garden.inspectors?.full_name ?? garden.inspector_id ?? "-"}</small><div className="garden-facts"><span>קיבולת: {garden.current_children_count ?? 0}/{garden.children_capacity ?? 0}</span><span>ילדים: {result.data.children?.[garden.id] ?? 0}</span><span>הורים: {result.data.parents?.[garden.id] ?? 0}</span><span>צוות: {result.data.staff?.[garden.id] ?? garden.staff_count ?? 0}</span><span>מצלמות: {cameras.online}/{cameras.total}</span><span>AI: {cameras.ai ? "פעיל בחלק" : "ממתין"}</span></div><small>ביקורת אחרונה: {latest?.completed_at ? new Date(latest.completed_at).toLocaleDateString("he-IL") : garden.last_inspection_at ? new Date(garden.last_inspection_at).toLocaleDateString("he-IL") : "טרם"} · ציון: {latest?.weighted_score ?? garden.last_inspection_score ?? "-"}</small></div><div className="procedure-meta"><Link className="button secondary" href={`/dashboard/admin/gardens/${garden.id}`}>View</Link><Link className="button secondary" href={`/dashboard/admin/users/new-kindergarten?gardenId=${garden.id}`}>Edit</Link><Link className="button secondary" href="/dashboard/garden">Open dashboard</Link><Link className="button secondary" href="/dashboard/admin/inspection-forms">View inspections</Link><button className="button secondary">Export PDF</button><Link className="button" href="/dashboard/admin/users/new-inspector">Assign inspector</Link></div></article>;
    })}</div>}</section>
  </DashboardShell>;
}
