import Link from "next/link";
import { AlertTriangle, Bot, Camera, ClipboardCheck, FileText, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { InspectionOverrideButton } from "@/components/inspection-override-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminGardenProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();
  const [gardenRes, children, parents, staff, attendance, complaints, tasks, docs, cameras, aiEvents, inspections, leads] = await Promise.all([
    supabase.from("gardens").select("*, manager:profiles!gardens_manager_id_fkey(id, full_name, phone), inspector:profiles!gardens_inspector_id_fkey(id, full_name)").eq("id", id).single(),
    supabase.from("children").select("id, full_name, status, parent_completed, manager_approved_at").eq("garden_id", id).limit(20),
    supabase.from("parents").select("id, full_name, phone, email, status").eq("garden_id", id).limit(20),
    supabase.from("staff").select("id, full_name, role_title, background_check_status, police_clearance_status, approved_to_work").eq("garden_id", id).limit(20),
    supabase.from("attendance").select("id, status, attendance_date").eq("garden_id", id).limit(100),
    supabase.from("complaints").select("id, subject, severity, status").eq("garden_id", id).neq("status", "closed").limit(10),
    supabase.from("tasks").select("id, title, status, due_at").eq("garden_id", id).neq("status", "done").limit(10),
    supabase.from("documents").select("id, name, document_type, status, expires_at").eq("garden_id", id).limit(10),
    supabase.from("camera_streams").select("id, name, area, status, active, parent_view_allowed").eq("garden_id", id).limit(10),
    supabase.from("ai_events").select("id, event_type, severity, status, confidence, detected_at").eq("garden_id", id).order("detected_at", { ascending: false }).limit(10),
    supabase.from("inspections").select("id, status, weighted_score, completed_at, violation_count").eq("garden_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("id, parent_name, phone, child_name, status").eq("garden_id", id).eq("lead_type", "parent").limit(10)
  ]);
  const garden = gardenRes.data as any;
  const attendanceRows = attendance.data ?? [];
  const presentCount = attendanceRows.filter((row: any) => row.status === "present").length;
  if (!garden) return <DashboardShell role="admin" title="פרופיל גן"><div className="empty-state"><strong>הגן לא נמצא</strong><span>בדקו שהקישור תקין.</span></div></DashboardShell>;

  return (
    <DashboardShell role="admin" title="פרופיל גן">
      <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Kindergarten profile</p><h1>{garden.name}</h1><p>{garden.city} · {garden.address ?? "כתובת לא הוזנה"} · מנהלת: {garden.manager?.full_name ?? "לא שויך"}</p></div><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}><ShieldCheck size={15} /> {garden.safe_status}</span></div>
      <div className="grid cols-4 dashboard-kpis"><StatCard label="ילדים" value={children.data?.length ?? 0} /><StatCard label="הורים" value={parents.data?.length ?? 0} /><StatCard label="ציון ביקורת" value={String(garden.last_inspection_score ?? "-")} /><StatCard label="נוכחים במדגם" value={presentCount} tone="good" /></div>
      <section className="quick-actions-grid"><Link className="quick-action" href="/dashboard/admin/notices"><UserRound /><strong>הודעה למנהלת</strong><span>שליחת הודעה מתועדת.</span></Link><Link className="quick-action" href="/dashboard/admin/tasks"><ClipboardCheck /><strong>יצירת משימה</strong><span>משימה לגן או לפקח.</span></Link><Link className="quick-action" href="/dashboard/admin/onboarding"><UsersRound /><strong>שיוך פקח</strong><span>ניהול משתמשים ושיוכים.</span></Link><Link className="quick-action" href="/dashboard/admin/camera-ai"><Camera /><strong>מצלמות</strong><span>צפייה בהגדרות ובריאות.</span></Link></section>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel"><h2>צוות</h2>{(staff.data ?? []).length === 0 ? <div className="empty-mini">אין אנשי צוות.</div> : (staff.data ?? []).map((item: any) => <div className="list-item" key={item.id}><div><strong>{item.full_name}</strong><span>{item.role_title} · רקע {item.background_check_status} · יושר {item.police_clearance_status}</span></div><span className={item.approved_to_work ? "pill good" : "pill warn"}>{item.approved_to_work ? "מאושר" : "ממתין"}</span></div>)}</article>
        <article className="card action-panel"><h2>ילדים ובקשות רישום</h2>{(children.data ?? []).length === 0 ? <div className="empty-mini">אין ילדים.</div> : (children.data ?? []).map((item: any) => <div className="list-item" key={item.id}><div><strong>{item.full_name}</strong><span>{item.parent_completed ? "הורה השלים" : "חסר פרטים"}</span></div><span className="pill">{item.status}</span></div>)}</article>
        <article className="card action-panel"><h2>הורים</h2>{(parents.data ?? []).length === 0 ? <div className="empty-mini">אין הורים.</div> : (parents.data ?? []).map((item: any) => <div className="list-item" key={item.id}><div><strong>{item.full_name}</strong><span>{item.phone} · {item.email ?? "ללא מייל"}</span></div><span className="pill">{item.status}</span></div>)}</article>
        <article className="card action-panel"><h2>משימות ותלונות</h2><div className="risk-list"><div><ClipboardCheck /> משימות פתוחות <b>{tasks.data?.length ?? 0}</b></div><div><AlertTriangle /> תלונות פתוחות <b>{complaints.data?.length ?? 0}</b></div><div><FileText /> מסמכים <b>{docs.data?.length ?? 0}</b></div></div></article>
        <article className="card action-panel"><h2>מצלמות</h2>{(cameras.data ?? []).length === 0 ? <div className="empty-mini">אין מצלמות מחוברות.</div> : (cameras.data ?? []).map((camera: any) => <div className="list-item" key={camera.id}><div><strong>{camera.name}</strong><span>{camera.area} · צפיית הורים {camera.parent_view_allowed ? "מאושרת" : "לא מאושרת"}</span></div><span className={camera.status === "online" ? "pill good" : "pill bad"}>{camera.status}</span></div>)}</article>
        <article className="card action-panel"><h2>תצפיתן AI</h2>{(aiEvents.data ?? []).length === 0 ? <div className="empty-mini">אין אירועי AI.</div> : (aiEvents.data ?? []).map((event: any) => <div className="list-item" key={event.id}><div><strong>{event.event_type}</strong><span>confidence {event.confidence ?? "-"}</span></div><span className="pill bad">{event.severity}</span></div>)}</article>
      </section>
      <section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>ביקורות אחרונות</h2>{(inspections.data ?? []).length === 0 ? <div className="empty-mini">אין ביקורות.</div> : (inspections.data ?? []).map((inspection: any) => <div className="list-item" key={inspection.id}><div><strong>ציון {inspection.weighted_score ?? "-"}</strong><span>{inspection.completed_at ? new Date(inspection.completed_at).toLocaleDateString("he-IL") : inspection.status}</span><InspectionOverrideButton inspectionId={inspection.id} /></div><span className="pill">{inspection.violation_count ?? 0} ליקויים</span></div>)}</article><article className="card action-panel"><h2>לידים מהורים</h2>{(leads.data ?? []).length === 0 ? <div className="empty-mini">אין לידים.</div> : (leads.data ?? []).map((lead: any) => <div className="list-item" key={lead.id}><div><strong>{lead.parent_name}</strong><span>{lead.phone} · {lead.child_name ?? "ילד"}</span></div><span className="pill warn">{lead.status}</span></div>)}</article></section>
    </DashboardShell>
  );
}
