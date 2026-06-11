import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Camera,
  ClipboardCheck,
  FileCheck2,
  FileText,
  MapPin,
  MessageSquareWarning,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UploadCloud
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Date(value).toLocaleDateString("he-IL");
}

function severityTone(value?: string | number | null) {
  const text = String(value ?? "").toLowerCase();
  const score = Number(value);
  if (["critical", "high", "urgent"].includes(text) || score >= 75) return "bad" as const;
  if (["medium", "warn", "warning"].includes(text) || score >= 45) return "warn" as const;
  return "good" as const;
}

function inspectionTypeLabel(value?: string | null) {
  const map: Record<string, string> = {
    monthly: "חודשית",
    surprise: "פתע",
    follow_up: "מעקב",
    complaint: "בעקבות תלונה",
    ai_recommended: "מומלצת לבדיקה",
    observer_recommended: "מומלצת מתצפיתן"
  };
  return map[String(value ?? "")] ?? "ביקורת";
}

function statusLabel(value?: string | null) {
  const map: Record<string, string> = {
    pending: "ממתין",
    scheduled: "מתוכנן",
    in_progress: "בתהליך",
    done: "הושלם",
    open: "פתוח",
    reviewing: "בבדיקה",
    needs_review: "דורש בדיקה",
    escalated: "הוסלם",
    resolved: "נסגר",
    verified: "אומת"
  };
  return map[String(value ?? "")] ?? "פתוח";
}

function avg(rows: any[], key: string) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0) / rows.length);
}

export default async function InspectorCommandCenterPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);

  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("id, service_cities, certification_notes, profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id,name,city,address,logo_url,safe_status,last_inspection_score,next_inspection_at,latitude,longitude").eq("inspector_id", profile.id).order("name")
  ]);
  const inspector = inspectorRes.data as any;
  const gardens = (gardensRes.data ?? []) as any[];
  const gardenIds = gardens.map((garden) => garden.id).filter(Boolean);

  const [
    requiredRes,
    inspectionsRes,
    violationsRes,
    complaintsRes,
    incidentsRes,
    observerRes,
    complianceActionsRes,
    complianceAlertsRes,
    riskRes,
    camerasRes,
    tasksRes
  ] = await Promise.all([
    gardenIds.length ? supabase.from("required_inspections" as any).select("id,garden_id,due_at,status,inspection_type,created_at,gardens(id,name,city,address,logo_url,last_inspection_score)").in("garden_id", gardenIds).neq("status", "done").order("due_at", { ascending: true }).limit(80) : Promise.resolve({ data: [] }),
    supabase.from("inspections" as any).select("id,garden_id,status,inspection_type,weighted_score,completed_at,created_at,violation_count,gps_verified,duration_minutes,signed_at,signature_image,gardens(id,name,city,logo_url)").eq("inspector_id", profile.id).order("created_at", { ascending: false }).limit(80),
    gardenIds.length ? supabase.from("violations" as any).select("id,garden_id,title,severity,status,correction_due_at,created_at,gardens(name,city)").in("garden_id", gardenIds).neq("status", "done").order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("complaints" as any).select("id,garden_id,subject,severity,status,created_at,gardens(name,city)").in("garden_id", gardenIds).neq("status", "closed").order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("incident_reports" as any).select("id,garden_id,title,severity,status,created_at,gardens(name,city)").in("garden_id", gardenIds).neq("status", "closed").order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("observer_intelligence_signals" as any).select("id,kindergarten_id,signal_type,severity,confidence,review_status,recommended_action,created_at,gardens(name,city)").in("kindergarten_id", gardenIds).in("review_status", ["needs_review", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("compliance_corrective_actions" as any).select("id,garden_id,action_title,status,priority,due_at,gardens(name,city)").in("garden_id", gardenIds).in("status", ["identified", "assigned", "in_progress", "ready_for_verification"]).order("due_at", { ascending: true }).limit(60) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("compliance_alerts" as any).select("id,garden_id,title,severity,status,due_at,gardens(name,city)").in("garden_id", gardenIds).neq("status", "resolved").order("due_at", { ascending: true }).limit(60) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("kindergarten_risk_profiles" as any).select("id,garden_id,overall_risk_score,risk_level,risk_trend,prediction_summary,gardens(name,city)").in("garden_id", gardenIds).order("overall_risk_score", { ascending: false }).limit(80) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("camera_streams" as any).select("id,garden_id,kindergarten_id,name,status,active,last_health_check_at").or(`garden_id.in.(${gardenIds.join(",")}),kindergarten_id.in.(${gardenIds.join(",")})`) : Promise.resolve({ data: [] }),
    supabase.from("tasks" as any).select("id,garden_id,title,priority,status,due_at,assigned_to,assigned_role").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).neq("status", "done").order("created_at", { ascending: false }).limit(60)
  ]);

  const required = (requiredRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const violations = (violationsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const incidents = (incidentsRes.data ?? []) as any[];
  const observerSignals = (observerRes.data ?? []) as any[];
  const complianceActions = (complianceActionsRes.data ?? []) as any[];
  const complianceAlerts = (complianceAlertsRes.data ?? []) as any[];
  const risks = (riskRes.data ?? []) as any[];
  const cameras = (camerasRes.data ?? []) as any[];
  const tasks = ((tasksRes.data ?? []) as any[]).filter((task) => task.assigned_to === profile.id || task.assigned_role === "inspector" || !task.garden_id || gardenIds.includes(task.garden_id));

  const dueToday = required.filter((item) => String(item.due_at ?? "").slice(0, 10) === today);
  const overdue = required.filter((item) => {
    const days = daysUntil(item.due_at);
    return days !== null && days < 0;
  });
  const upcoming = required.filter((item) => {
    const days = daysUntil(item.due_at);
    return days !== null && days >= 0 && days <= 14;
  });
  const completedThisMonth = inspections.filter((item) => item.completed_at && new Date(item.completed_at) >= monthStart).length;
  const draftInspections = inspections.filter((item) => ["draft", "in_progress", "started"].includes(String(item.status)));
  const signedInspections = inspections.filter((item) => item.signature_image || item.signed_at).length;
  const gpsVerified = inspections.filter((item) => item.gps_verified).length;
  const suspiciousGps = inspections.filter((item) => item.gps_verified === false && item.completed_at).length;
  const unresolvedFindings = violations.length + complianceActions.length;
  const activeComplaints = complaints.filter((item) => !["closed", "resolved"].includes(String(item.status)));
  const cameraIssues = cameras.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status ?? "")));
  const highRiskGardens = risks.filter((risk) => ["high", "critical"].includes(String(risk.risk_level)) || Number(risk.overall_risk_score ?? 0) >= 70);
  const attentionTotal = dueToday.length + overdue.length + unresolvedFindings + activeComplaints.length + observerSignals.length + highRiskGardens.length;
  const calendarGroups = [
    { label: "חודשיות", items: required.filter((item) => item.inspection_type === "monthly") },
    { label: "פתע", items: required.filter((item) => item.inspection_type === "surprise") },
    { label: "מעקב", items: required.filter((item) => item.inspection_type === "follow_up") },
    { label: "תלונה", items: required.filter((item) => item.inspection_type === "complaint") },
    { label: "מומלצות", items: required.filter((item) => ["ai_recommended", "observer_recommended"].includes(String(item.inspection_type))) }
  ];
  const priorityQueue = [
    ...overdue.map((item) => ({ id: item.id, title: item.gardens?.name ?? "גן", body: `${inspectionTypeLabel(item.inspection_type)} · ${Math.abs(daysUntil(item.due_at) ?? 0)} ימים באיחור`, tone: "bad" as const, href: `/dashboard/inspector/inspections?required=${item.id}` })),
    ...dueToday.map((item) => ({ id: item.id, title: item.gardens?.name ?? "גן", body: `${inspectionTypeLabel(item.inspection_type)} · היום`, tone: "warn" as const, href: `/dashboard/inspector/inspections?required=${item.id}` })),
    ...observerSignals.map((item) => ({ id: item.id, title: item.gardens?.name ?? "גן", body: item.recommended_action ?? item.signal_type ?? "סימן לבדיקה", tone: severityTone(item.severity), href: "/dashboard/inspector/observer-network" })),
    ...activeComplaints.map((item) => ({ id: item.id, title: item.gardens?.name ?? "גן", body: item.subject ?? "תלונה פתוחה", tone: severityTone(item.severity), href: "/dashboard/inspector/reports" })),
    ...complianceActions.map((item) => ({ id: item.id, title: item.gardens?.name ?? "גן", body: item.action_title ?? "פעולת ציות", tone: severityTone(item.priority), href: "/dashboard/inspector/compliance" }))
  ].slice(0, 12);

  return (
    <DashboardShell role="inspector" title="מרכז פיקוח שטח">
      <div className="inspector-ops-2">
        <section className="inspector-command-hero">
          <div className="inspector-alert-score">
            <span>לטיפול</span>
            <strong>{attentionTotal}</strong>
            <small>נושאים פתוחים</small>
          </div>
          <div>
            <p className="eyebrow">פיקוח בשטח</p>
            <h1>כל עבודת הפיקוח במקום אחד.</h1>
            <p>{gardens.length} גנים משויכים · {dueToday.length} ביקורות היום · {overdue.length} באיחור · {observerSignals.length} סימני תצפיתן לבדיקה.</p>
            <div className="parent-status-row">
              <StatusBadge tone={overdue.length ? "bad" : "good"}>{overdue.length ? "יש ביקורות באיחור" : "אין איחורים"}</StatusBadge>
              <StatusBadge tone={suspiciousGps ? "warn" : "good"}>{suspiciousGps ? "יש GPS לבדיקה" : "GPS תקין"}</StatusBadge>
              <StatusBadge tone="good">{Array.isArray(inspector?.service_cities) && inspector.service_cities.length ? inspector.service_cities.join(", ") : "אזור לא הוגדר"}</StatusBadge>
            </div>
          </div>
          <Avatar name={profile.full_name} src={inspector?.profile_photo_url ?? profile.profile_image_url} size="lg" />
        </section>

        <section className="inspector-kpi-strip">
          <RoleMetricCard label="היום" value={dueToday.length} hint="ביקורות לביצוע" tone={dueToday.length ? "warn" : "good"} href="/dashboard/inspector/inspections/due" />
          <RoleMetricCard label="באיחור" value={overdue.length} hint="דורש תיאום" tone={overdue.length ? "bad" : "good"} href="/dashboard/inspector/inspections/due" />
          <RoleMetricCard label="ליקויים" value={unresolvedFindings} hint="פתוחים לאימות" tone={unresolvedFindings ? "warn" : "good"} href="/dashboard/inspector/violations" />
          <RoleMetricCard label="תלונות" value={activeComplaints.length} hint="לטיפול פקח" tone={activeComplaints.length ? "warn" : "good"} href="/dashboard/inspector/reports" />
          <RoleMetricCard label="סיכון גבוה" value={highRiskGardens.length} hint={`ממוצע ${avg(risks, "overall_risk_score")}/100`} tone={highRiskGardens.length ? "bad" : "good"} href="/dashboard/inspector/risk" />
        </section>

        <section className="inspector-two-column">
          <CleanSection title="תור עבודה בשטח" subtitle="מה צריך לפתוח קודם כשאת/ה מגיע/ה ליום פיקוח.">
            {priorityQueue.length ? <div className="inspector-priority-queue">{priorityQueue.map((item) => <Link href={item.href} key={`${item.href}-${item.id}`}><StatusBadge tone={item.tone}>{item.tone === "bad" ? "דחוף" : item.tone === "warn" ? "לטיפול" : "מעקב"}</StatusBadge><div><strong>{item.title}</strong><span>{item.body}</span></div></Link>)}</div> : <EmptyState title="אין נושאים דחופים" text="ביקורות, תלונות וסימני בטיחות יופיעו כאן כשהם דורשים טיפול." />}
          </CleanSection>

          <article className="inspector-field-card">
            <Bot />
            <h2>עוזר פיקוח 2.0</h2>
            <p>שאלות קצרות שמובילות לתמונה המבצעית.</p>
            <div className="inspector-field-links">
              <Link href="/dashboard/inspector/inspections/due">אילו ביקורות באיחור?</Link>
              <Link href="/dashboard/inspector/risk">אילו גנים דורשים תשומת לב?</Link>
              <Link href="/dashboard/inspector/violations">אילו ממצאים לא נסגרו?</Link>
              <Link href="/dashboard/inspector/observer-network">אילו סימנים חוזרים?</Link>
            </div>
          </article>
        </section>

        <section className="inspector-calendar-grid">
          {calendarGroups.map((group) => <Link href="/dashboard/inspector/inspections/due" key={group.label}><span>{group.label}</span><strong>{group.items.length}</strong><small>{group.items[0]?.due_at ? `קרוב: ${dateText(group.items[0].due_at)}` : "אין כרגע"}</small></Link>)}
        </section>

        <section className="inspector-field-workflow">
          <article><MapPin /><h2>GPS הגעה</h2><p>אימות מיקום, מרחק מהגן וזמן הגעה לפני פתיחת הביקורת.</p><strong>{gpsVerified}/{inspections.length || 0} אומתו</strong></article>
          <article><Timer /><h2>משך ביקורת</h2><p>שמירת התחלה, המשך וסיום כדי לזהות ביקורות קצרות מדי.</p><strong>{draftInspections.length} בטיוטה</strong></article>
          <article><UploadCloud /><h2>ראיות</h2><p>צילום, מסמך, הערה וסימן תצפיתן שמצורפים לדוח.</p><strong>{violations.length + incidents.length} פריטים</strong></article>
          <article><PenLine /><h2>חתימה</h2><p>חתימת פקח, זמן ו-GPS נשמרים בדוח הסופי.</p><strong>{signedInspections} חתומות</strong></article>
          <article><FileCheck2 /><h2>דוח מלא</h2><p>ברקוד, מזהה, שאלות, תשובות, ציונים, תמונות וחתימות.</p><strong>{completedThisMonth} החודש</strong></article>
        </section>

        <section className="inspector-action-grid">
          <ActionCard title="התחלת ביקורת" text="טופס, שמירה וחתימה" href="/dashboard/inspector/inspections" icon={ClipboardCheck} tone="warn" />
          <ActionCard title="לוח ביקורות" text="חודשיות, פתע, מעקב ותלונות" href="/dashboard/inspector/inspections/due" icon={MapPin} />
          <ActionCard title="תלונות" text="תגובה, מידע והסלמה" href="/dashboard/inspector/reports" icon={MessageSquareWarning} />
          <ActionCard title="ליקויים" text="אימות תיקונים וסגירה" href="/dashboard/inspector/violations" icon={ShieldAlert} />
          <ActionCard title="ציות" text="מסמכים, פעולות והתראות" href="/dashboard/inspector/compliance" icon={ShieldCheck} />
          <ActionCard title="תצפיתן" text="סימני בטיחות לבדיקה" href="/dashboard/inspector/observer-network" icon={AlertTriangle} />
          <ActionCard title="סיכון" text="המלצות ביקורת מונעת" href="/dashboard/inspector/risk" icon={AlertTriangle} />
          <ActionCard title="דוחות" text="סיכומי ביקורת והורדה" href="/dashboard/inspector/reports" icon={FileText} />
        </section>

        <section className="inspector-two-column">
          <CleanSection title="גנים משויכים ואזור" subtitle="כיסוי אזורי, ציון בטיחות וסיכון.">
            {gardens.length ? <div className="inspector-garden-list">{gardens.map((garden) => {
              const risk = risks.find((item) => item.garden_id === garden.id);
              const nextDays = daysUntil(garden.next_inspection_at);
              return <article key={garden.id}><Avatar name={garden.name} src={garden.logo_url} /><div><strong>{garden.name}</strong><span>{garden.city ?? ""} · {garden.address ?? ""}</span><small>ביקורת הבאה: {dateText(garden.next_inspection_at)} · {nextDays !== null && nextDays < 0 ? "באיחור" : "מתוכנן"}</small></div><StatusBadge tone={severityTone(risk?.overall_risk_score ?? garden.last_inspection_score)}>{risk?.overall_risk_score ?? garden.last_inspection_score ?? "-"}/100</StatusBadge><Link className="button secondary tiny" href={`/dashboard/inspector/inspections?garden=${garden.id}`}>פתיחה</Link></article>;
            })}</div> : <EmptyState title="לא הוקצו גנים" text="אדמין צריך לשייך גנים לפקח כדי להתחיל עבודה." />}
          </CleanSection>

          <CleanSection title="תלונות, תצפיתן וציות" subtitle="הזנות שמייצרות צורך בבדיקה אנושית.">
            <div className="inspector-alert-feed">
              {[...activeComplaints, ...observerSignals, ...complianceAlerts, ...incidents].slice(0, 10).map((item) => <Link href={item.signal_type ? "/dashboard/inspector/observer-network" : item.subject ? "/dashboard/inspector/reports" : "/dashboard/inspector/compliance"} key={`${item.id}-${item.signal_type ?? item.subject ?? item.title}`}><span className={["critical", "high", "urgent"].includes(String(item.severity)) ? "severity-dot critical" : "severity-dot medium"} /><div><strong>{item.subject ?? item.title ?? item.signal_type ?? "עדכון לבדיקה"}</strong><small>{item.gardens?.name ?? "גן"} · {statusLabel(item.status ?? item.review_status)}</small></div></Link>)}
              {activeComplaints.length + observerSignals.length + complianceAlerts.length + incidents.length === 0 ? <EmptyState title="אין הזנות פתוחות" text="תלונות, סימני תצפיתן וציות יופיעו כאן." /> : null}
            </div>
          </CleanSection>
        </section>

        <section className="inspector-report-row">
          <span><ClipboardCheck /> ביקורות החודש <b>{completedThisMonth}</b></span>
          <span><ShieldAlert /> ליקויים פתוחים <b>{violations.length}</b></span>
          <span><MessageSquareWarning /> תלונות פתוחות <b>{activeComplaints.length}</b></span>
          <span><Camera /> מצלמות לבדיקה <b>{cameraIssues.length}</b></span>
          <span><AlertTriangle /> משימות פתוחות <b>{tasks.length}</b></span>
        </section>
      </div>
    </DashboardShell>
  );
}
