import Link from "next/link";
import { AlertTriangle, Camera, ClipboardCheck, FileText, MapPin, MessageSquareWarning, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, RoleMetricCard } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function safetyTone(score?: number | null, status?: string | null) {
  if (Number(score ?? 0) >= 85 || status === "safe") return "good" as const;
  if (Number(score ?? 0) < 65) return "bad" as const;
  return "warn" as const;
}

export default async function InspectorDashboard() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("id, service_cities, certification_notes, profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name, city, address, logo_url, safe_status, last_inspection_score, next_inspection_at").eq("inspector_id", profile.id).order("name")
  ]);
  const inspector = inspectorRes.data as any;
  if (!inspector || profile.active === false) {
    return (
      <DashboardShell role="inspector" title="בקשת מפקח">
        <section className="dashboard-hero-card">
          <div>
            <p className="eyebrow">חשבון מפקח מוגבל</p>
            <h1>יש להשלים בקשת הצטרפות למערך המפקחים.</h1>
            <p>עד אישור אדמין ושיוך גנים, אין גישה לגנים, ביקורות, מצלמות, דוחות או נתונים רגישים.</p>
          </div>
          <span className="pill warn">ממתין לאישור</span>
        </section>
        <section className="staff-action-grid">
          <ActionCard title="הגשת בקשה" text="פרטים, אזורים ומסמכים" href="/dashboard/inspector/apply" icon={ClipboardCheck} tone="good" />
          <ActionCard title="התראות" text="עדכוני אדמין על הבקשה" href="/dashboard/inspector/notifications" icon={ShieldAlert} />
        </section>
      </DashboardShell>
    );
  }
  const gardens = (gardensRes.data ?? []) as any[];
  const gardenIds = gardens.map((garden: any) => garden.id);

  const [requiredRes, inspectionsRes, violationsRes, complaintsRes, incidentsRes, aiRes, camerasRes, tasksRes] = await Promise.all([
    gardenIds.length ? supabase.from("required_inspections" as any).select("id, garden_id, due_at, status, inspection_type, gardens(id, name, city, logo_url, safe_status, last_inspection_score)").in("garden_id", gardenIds).neq("status", "done").order("due_at", { ascending: true }).limit(40) : Promise.resolve({ data: [] }),
    supabase.from("inspections" as any).select("id, garden_id, status, weighted_score, completed_at, violation_count, gps_verified, duration_minutes, gardens(id, name, city, logo_url)").eq("inspector_id", profile.id).order("completed_at", { ascending: false }).limit(30),
    gardenIds.length ? supabase.from("violations" as any).select("id, garden_id, title, severity, status, correction_due_at, gardens(name, city)").in("garden_id", gardenIds).neq("status", "done").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("complaints" as any).select("id, garden_id, subject, severity, status, created_at, gardens(name, city)").in("garden_id", gardenIds).neq("status", "closed").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("incident_reports" as any).select("id, garden_id, title, severity, status, created_at, gardens(name, city)").in("garden_id", gardenIds).neq("status", "closed").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("ai_camera_events" as any).select("id, kindergarten_id, event_type, severity, status, created_at, gardens(name), camera_streams(name, area)").in("kindergarten_id", gardenIds).neq("status", "closed").order("created_at", { ascending: false }).limit(20) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("camera_streams" as any).select("id, garden_id, kindergarten_id, status, active").or(`garden_id.in.(${gardenIds.join(",")}),kindergarten_id.in.(${gardenIds.join(",")})`) : Promise.resolve({ data: [] }),
    supabase.from("tasks" as any).select("id, garden_id, title, priority, status, due_at").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).neq("status", "done").order("created_at", { ascending: false }).limit(20)
  ]);

  const required = (requiredRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const violations = (violationsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const incidents = (incidentsRes.data ?? []) as any[];
  const aiEvents = (aiRes.data ?? []) as any[];
  const cameraIssues = ((camerasRes.data ?? []) as any[]).filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status ?? "")));
  const scopedTasks = ((tasksRes.data ?? []) as any[]).filter((task) => task.assigned_to === profile.id || !task.garden_id || gardenIds.includes(task.garden_id));
  const overdue = required.filter((item) => {
    const days = daysUntil(item.due_at);
    return days !== null && days < 0;
  });
  const dueSoon = required.filter((item) => {
    const days = daysUntil(item.due_at);
    return days !== null && days >= 0 && days <= 7;
  });
  const activeComplaints = complaints.filter((item) => ["critical", "high", "urgent"].includes(String(item.severity)));
  const observerAlerts = aiEvents.filter((item) => ["critical", "high", "urgent"].includes(String(item.severity)));
  const findingsOpen = violations.length + incidents.length;
  const completedThisMonth = inspections.filter((inspection) => {
    if (!inspection.completed_at) return false;
    const date = new Date(inspection.completed_at);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const closedFindings = inspections.reduce((sum, inspection) => sum + Number(inspection.violation_count ?? 0), 0);
  const attentionTotal = overdue.length + dueSoon.length + findingsOpen + complaints.length + observerAlerts.length;

  return (
    <DashboardShell role="inspector" title="מרכז פיקוח">
      <div className="inspector-command-shell">
        <section className="inspector-command-hero">
          <div className="inspector-alert-score">
            <span>לטיפול</span>
            <strong>{attentionTotal}</strong>
            <small>נושאים פתוחים</small>
          </div>
          <div>
            <p className="eyebrow">מה דורש תשומת לב היום?</p>
            <h1>מרכז פיקוח ובטיחות.</h1>
            <p>{gardens.length} גנים משויכים · {overdue.length} ביקורות באיחור · {complaints.length} תלונות פתוחות · {observerAlerts.length} התראות תצפיתן.</p>
            <div className="parent-status-row">
              <span className={overdue.length ? "pill bad" : "pill good"}>{overdue.length ? "יש איחורים" : "אין איחורים"}</span>
              <span className={observerAlerts.length ? "pill warn" : "pill good"}>{observerAlerts.length} התראות תצפיתן</span>
              <span className="pill good">{Array.isArray(inspector?.service_cities) && inspector.service_cities.length ? inspector.service_cities.join(", ") : "אזור לא הוגדר"}</span>
            </div>
          </div>
          <Avatar name={profile.full_name} src={inspector?.profile_photo_url ?? profile.profile_image_url} size="lg" />
        </section>

        <section className="inspector-kpi-strip">
          <RoleMetricCard label="ביקורות קרובות" value={dueSoon.length} hint="עד 7 ימים" tone={dueSoon.length ? "warn" : "good"} href="/dashboard/inspector/inspections/due" />
          <RoleMetricCard label="באיחור" value={overdue.length} hint="דורש טיפול" tone={overdue.length ? "bad" : "good"} href="/dashboard/inspector/inspections/due" />
          <RoleMetricCard label="ליקויים פתוחים" value={findingsOpen} hint="כולל אירועים" tone={findingsOpen ? "warn" : "good"} href="/dashboard/inspector/violations" />
          <RoleMetricCard label="תלונות פעילות" value={complaints.length} hint={`${activeComplaints.length} דחופות`} tone={complaints.length ? "warn" : "good"} href="/dashboard/inspector/reports" />
          <RoleMetricCard label="התראות תצפיתן" value={aiEvents.length + cameraIssues.length} hint="מצלמות ותצפיתן" tone={aiEvents.length + cameraIssues.length ? "warn" : "good"} href="/dashboard/inspector/ai-events" />
        </section>

        <section className="inspector-two-column">
          <article className="inspector-priority-card">
            <div className="section-heading"><h2>תור פיקוח להיום</h2><p>ביקורות באיחור, קרובות או דורשות המשך.</p></div>
            {required.length === 0 ? <div className="empty-state"><strong>אין ביקורות פתוחות</strong><span>משימות פיקוח יופיעו כאן לפי תאריך יעד.</span></div> : <div className="inspector-planning-list">{required.slice(0, 8).map((item) => {
              const days = daysUntil(item.due_at);
              return <Link href={`/dashboard/inspector/inspections?required=${item.id}`} key={item.id}><Avatar name={item.gardens?.name} src={item.gardens?.logo_url} /><div><strong>{item.gardens?.name ?? "גן"}</strong><span>{item.gardens?.city ?? ""} · {days !== null && days < 0 ? `${Math.abs(days)} ימים באיחור` : `${days ?? "-"} ימים נותרו`}</span></div><small>{item.inspection_type ?? "ביקורת"}</small></Link>;
            })}</div>}
          </article>
          <article className="inspector-assistant-card">
            <ShieldCheck />
            <h2>עוזר פיקוח</h2>
            <p>שאלות קצרות שמובילות למסך הנכון.</p>
            <div>
              <Link href="/dashboard/inspector/inspections/due">אילו גנים צריכים ביקורת?</Link>
              <Link href="/dashboard/inspector/violations">אילו ליקויים לא נסגרו?</Link>
              <Link href="/dashboard/inspector/reports">אילו תלונות דורשות תגובה?</Link>
              <Link href="/dashboard/inspector/observer-network">איפה יש סיכון עולה?</Link>
            </div>
          </article>
        </section>

        <section className="inspector-action-grid">
          <ActionCard title="ביקורת חדשה" text="טופס, GPS וחתימה" href="/dashboard/inspector/inspections" icon={ClipboardCheck} tone="warn" />
          <ActionCard title="לוח ביקורות" text="קרובות, באיחור ומעקב" href="/dashboard/inspector/inspections/due" icon={MapPin} />
          <ActionCard title="תלונות" text="בדיקה והסלמה" href="/dashboard/inspector/reports" icon={MessageSquareWarning} />
          <ActionCard title="ליקויים" text="תיקונים ואישורים" href="/dashboard/inspector/violations" icon={ShieldAlert} />
          <ActionCard title="דירוג גנים" text="ציונים וסיכון" href="/dashboard/inspector/ratings" icon={Star} />
          <ActionCard title="מודיעין סיכון" text="גנים במגמת עלייה" href="/dashboard/inspector/risk" icon={AlertTriangle} />
          <ActionCard title="רשת בטיחות" text="סימנים והמלצות" href="/dashboard/inspector/observer-network" icon={AlertTriangle} />
          <ActionCard title="דוחות" text="סיכום והפקה" href="/dashboard/inspector/reports" icon={FileText} />
        </section>

        <section className="inspector-two-column">
          <article className="inspector-priority-card">
            <div className="section-heading"><h2>גנים משויכים</h2><p>ציון, ביקורת אחרונה ותאריך יעד הבא.</p></div>
            {gardens.length === 0 ? <div className="empty-state"><strong>לא הוקצו גנים</strong><span>אדמין צריך לשייך גנים כדי להתחיל פיקוח.</span></div> : <div className="inspector-garden-list">{gardens.map((garden: any) => {
              const nextDays = daysUntil(garden.next_inspection_at);
              return <article key={garden.id}><Avatar name={garden.name} src={garden.logo_url} /><div><strong>{garden.name}</strong><span>{garden.city ?? ""} · {garden.address ?? ""}</span><small>ביקורת הבאה: {garden.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "לא נקבעה"}</small></div><span className={`pill ${safetyTone(garden.last_inspection_score, garden.safe_status)}`}>{garden.last_inspection_score ?? "-"} / 100</span><Link className="button secondary tiny" href={`/dashboard/inspector/inspections?garden=${garden.id}`}>{nextDays !== null && nextDays < 0 ? "בדיקה דחופה" : "פתיחה"}</Link></article>;
            })}</div>}
          </article>
          <article className="inspector-priority-card">
            <div className="section-heading"><h2>תלונות והתראות</h2><p>תלונות, אירועי בטיחות והתראות תצפיתן לפי חומרה.</p></div>
            <div className="inspector-alert-feed">
              {[...complaints.slice(0, 4), ...incidents.slice(0, 3), ...aiEvents.slice(0, 4)].slice(0, 8).map((item: any) => <Link href={item.event_type ? "/dashboard/inspector/ai-events" : item.subject ? "/dashboard/inspector/reports" : "/dashboard/inspector/violations"} key={`${item.id}-${item.subject ?? item.title ?? item.event_type}`}><span className={["critical", "high", "urgent"].includes(String(item.severity)) ? "severity-dot critical" : "severity-dot medium"} /><div><strong>{item.subject ?? item.title ?? item.event_type ?? "התראה"}</strong><small>{item.gardens?.name ?? item.camera_streams?.name ?? "גן"} · {item.created_at ? new Date(item.created_at).toLocaleString("he-IL") : ""}</small></div></Link>)}
              {complaints.length + incidents.length + aiEvents.length === 0 ? <div className="empty-state"><strong>אין התראות פתוחות</strong><span>תלונות, אירועים והתראות שיוקצו לך יופיעו כאן.</span></div> : null}
            </div>
          </article>
        </section>

        <section className="inspector-report-row">
          <span><ClipboardCheck /> ביקורות החודש <b>{completedThisMonth}</b></span>
          <span><ShieldAlert /> ליקויים שנמצאו <b>{closedFindings}</b></span>
          <span><AlertTriangle /> פעולות פתוחות <b>{scopedTasks.length}</b></span>
          <span><Camera /> מצלמות לבדיקה <b>{cameraIssues.length}</b></span>
          <span><MapPin /> GPS וחתימה <b>נדרש בטופס</b></span>
        </section>
      </div>
    </DashboardShell>
  );
}
