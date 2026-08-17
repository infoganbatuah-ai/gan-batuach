import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  Home,
  MapPin,
  Navigation,
  ShieldCheck
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  InspectorActionCard,
  InspectorActions,
  InspectorAppFrame,
  InspectorEmpty,
  InspectorHero,
  InspectorList,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorRow,
  InspectorScoreRing,
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

function daysUntil(value?: string | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function statusTone(score?: number | null) {
  if (score === null || score === undefined) return "muted" as const;
  if (Number(score ?? 0) >= 85) return "success" as const;
  if (Number(score ?? 0) < 70) return "warning" as const;
  return "primary" as const;
}

function severityLabel(value?: string | null) {
  const labels: Record<string, string> = {
    critical: "קריטי",
    urgent: "דחוף",
    high: "גבוה",
    medium: "בינוני",
    low: "נמוך"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "בדיקה";
}

function taskStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    open: "פתוח",
    todo: "פתוח",
    pending: "ממתין",
    in_progress: "בטיפול",
    review: "בבדיקה",
    blocked: "חסום"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "פתוח";
}

export default async function InspectorDashboard() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("id, service_cities, profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name, city, address, logo_url, safe_status, last_inspection_score, next_inspection_at").eq("inspector_id", profile.id).order("name")
  ]);

  const inspector = inspectorRes.data as any;
  const profileForUi = { ...profile, profile_image_url: inspector?.profile_photo_url ?? profile.profile_image_url };

  const assignedGardens = (gardensRes.data ?? []) as any[];

  if ((!inspector && assignedGardens.length === 0) || profile.active === false) {
    return (
      <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector" title="בקשת מפקח" subtitle="הגישה תיפתח לאחר אישור אדמין ושיוך גנים" badge="ממתין לאישור">
        <InspectorHero
          eyebrow="סטטוס מועמדות"
          title="הבקשה שלך ממתינה לאישור אדמין"
          subtitle="עד אישור ושיוך גנים לא מוצגים גנים, ביקורות, מצלמות, דוחות או נתונים רגישים."
          artwork={<ClipboardCheck />}
          action={<Link className="inspector-action-button" href="/dashboard/inspector/apply">השלמת בקשה</Link>}
        />
        <InspectorMetricGrid columns={3}>
          <InspectorMetricCard label="גישה לגנים" value="חסומה" hint="עד שיוך מפורש" icon={Home} tone="warning" />
          <InspectorMetricCard label="בקשה" value="בהמתנה" hint="פרטים ומסמכים" icon={ClipboardCheck} tone="warning" href="/dashboard/inspector/apply" />
          <InspectorMetricCard label="משימות" value="0" hint="יופיעו לאחר אישור" icon={CalendarCheck} tone="muted" />
        </InspectorMetricGrid>
      </InspectorAppFrame>
    );
  }

  const gardens = assignedGardens;
  const gardenIds = gardens.map((garden) => garden.id).filter(Boolean);
  const [requiredRes, inspectionsRes, violationsRes, complaintsRes, tasksRes] = await Promise.all([
    gardenIds.length ? supabase.from("required_inspections" as any).select("id, garden_id, due_at, status, inspection_type, gardens(id, name, city, address, logo_url, last_inspection_score)").in("garden_id", gardenIds).neq("status", "done").order("due_at", { ascending: true }).limit(20) : Promise.resolve({ data: [] }),
    supabase.from("inspections" as any).select("id, weighted_score, completed_at, violation_count, gardens(name, city)").eq("inspector_id", profile.id).order("completed_at", { ascending: false }).limit(12),
    gardenIds.length ? supabase.from("violations" as any).select("id, garden_id, title, severity, status, correction_due_at, gardens(name, city)").in("garden_id", gardenIds).neq("status", "done").order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    gardenIds.length ? supabase.from("complaints" as any).select("id, garden_id, subject, severity, status, created_at, gardens(name, city)").in("garden_id", gardenIds).neq("status", "closed").order("created_at", { ascending: false }).limit(12) : Promise.resolve({ data: [] }),
    supabase.from("tasks" as any).select("id, garden_id, title, priority, status, due_at").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).neq("status", "done").order("created_at", { ascending: false }).limit(12)
  ]);

  const required = (requiredRes.data ?? []) as any[];
  const inspections = (inspectionsRes.data ?? []) as any[];
  const violations = (violationsRes.data ?? []) as any[];
  const complaints = (complaintsRes.data ?? []) as any[];
  const tasks = ((tasksRes.data ?? []) as any[]).filter((task) => !task.garden_id || gardenIds.includes(task.garden_id));
  const next = required[0];
  const overdue = required.filter((item) => {
    const days = daysUntil(item.due_at);
    return days !== null && days < 0;
  });
  const dueSoon = required.filter((item) => {
    const days = daysUntil(item.due_at);
    return days !== null && days >= 0 && days <= 7;
  });
  const inspectionScores = inspections.map((item) => Number(item.weighted_score)).filter((score) => Number.isFinite(score));
  const gardenScores = gardens.map((garden) => Number(garden.last_inspection_score)).filter((score) => Number.isFinite(score));
  const avgScore = inspectionScores.length
    ? Math.round(inspectionScores.reduce((sum, score) => sum + score, 0) / inspectionScores.length)
    : gardenScores.length
      ? Math.round(gardenScores.reduce((sum, score) => sum + score, 0) / gardenScores.length)
      : null;

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="הביקורת הבאה"
        title={next?.gardens?.name ?? "אין ביקורת מתוכננת"}
        subtitle={next ? `${next.gardens?.address ?? next.gardens?.city ?? ""} · ${next.due_at ? new Date(next.due_at).toLocaleDateString("he-IL") : "ללא תאריך"}` : "כאשר אדמין ישייך ביקורת, היא תופיע כאן עם כל פרטי השטח."}
        artwork={<ClipboardCheck />}
        meta={next ? <><InspectorStatus tone="primary">{next.due_at ? new Date(next.due_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "ללא שעה"}</InspectorStatus><InspectorStatus tone={overdue.length ? "warning" : "success"}>{overdue.length ? "דורש טיפול" : "מתוכננת"}</InspectorStatus></> : null}
        action={<><Link className="inspector-action-button" href={next ? `/dashboard/inspector/inspections?required=${next.id}` : "/dashboard/inspector/inspections"}>התחל ביקורת</Link><Link className="inspector-action-button" href="/dashboard/inspector/control-center">נווט <Navigation size={18} /></Link></>}
      />

      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="גנים מוקצים" value={gardens.length} hint="גנים בפיקוח" icon={Home} tone="success" href="/dashboard/inspector/control-center" />
        <InspectorMetricCard label="ביקורות החודש" value={`${inspections.length}/${Math.max(required.length, gardens.length, 1)}`} hint="הושלמו" icon={ClipboardCheck} tone="primary" href="/dashboard/inspector/inspections/history" />
        <InspectorMetricCard label="ליקויים פתוחים" value={violations.length} hint="דורש טיפול" icon={AlertTriangle} tone={violations.length ? "warning" : "success"} href="/dashboard/inspector/violations" />
        <InspectorMetricCard label="ממוצע בטיחות" value={avgScore ?? "—"} hint={avgScore === null ? "טרם חושב" : "מתוך 100"} icon={ShieldCheck} tone={statusTone(avgScore)} href="/dashboard/inspector/ratings" />
      </InspectorMetricGrid>

      <DashboardTwoColumns>
        <InspectorSection title="היום שלי" subtitle="ביקורות, מעקב ושיחות לפי סדר עדיפות" icon={CalendarCheck} action={<Link href="/dashboard/inspector/inspections/due">צפה ביומן המלא</Link>}>
          <InspectorList>
            {required.slice(0, 4).map((item) => {
              const days = daysUntil(item.due_at);
              return (
                <InspectorRow
                  key={item.id}
                  href={`/dashboard/inspector/inspections?required=${item.id}`}
                  title={item.gardens?.name ?? "גן"}
                  subtitle={item.inspection_type === "follow_up" ? "מעקב תיקונים" : "ביקורת מתוכננת"}
                  meta={item.due_at ? new Date(item.due_at).toLocaleString("he-IL") : "ללא תאריך"}
                  status={<InspectorStatus tone={days !== null && days < 0 ? "danger" : "primary"}>{days !== null && days < 0 ? "באיחור" : "מתוכנן"}</InspectorStatus>}
                />
              );
            })}
            {required.length === 0 ? <InspectorEmpty title="אין ביקורות פתוחות" text="יומן הביקורות יתעדכן אחרי שיוך גנים ומשימות." icon={CalendarCheck} /> : null}
          </InspectorList>
        </InspectorSection>

        <InspectorSection title="התראות אחרונות" subtitle="ליקויים, תלונות ואירועים בגנים המשויכים" icon={BellIcon} action={<Link href="/dashboard/inspector/notifications">צפה בכל ההתראות</Link>}>
          <InspectorList>
            {[...violations.slice(0, 3), ...complaints.slice(0, 3)].slice(0, 5).map((item: any) => (
              <InspectorRow
                key={`${item.id}-${item.title ?? item.subject}`}
                href={item.subject ? "/dashboard/inspector/reports" : "/dashboard/inspector/violations"}
                title={item.title ?? item.subject ?? "התראה"}
                subtitle={item.gardens?.name ?? "גן"}
                meta={item.created_at ? new Date(item.created_at).toLocaleString("he-IL") : item.correction_due_at ? `יעד: ${new Date(item.correction_due_at).toLocaleDateString("he-IL")}` : ""}
                status={<InspectorStatus tone={["critical", "high", "urgent"].includes(String(item.severity)) ? "danger" : "warning"}>{severityLabel(item.severity)}</InspectorStatus>}
              />
            ))}
            {violations.length + complaints.length === 0 ? <InspectorEmpty title="אין התראות פתוחות" text="אירועים וליקויים שיוקצו לך יופיעו כאן." icon={ShieldCheck} /> : null}
          </InspectorList>
        </InspectorSection>
      </DashboardTwoColumns>

      <InspectorActions>
        <InspectorActionCard title="גנים" text="רשימת הגנים המוקצים" href="/dashboard/inspector/control-center" icon={Home} />
        <InspectorActionCard title="יומן ביקורות" text="תכנון וצפייה ביומן" href="/dashboard/inspector/inspections/due" icon={CalendarCheck} />
        <InspectorActionCard title="דוחות" text="היסטוריה וייצוא" href="/dashboard/inspector/inspections/history" icon={FileText} />
        <InspectorActionCard title="ליקויים" text="מעקב תיקונים" href="/dashboard/inspector/violations" icon={AlertTriangle} tone="warning" />
      </InspectorActions>

      <InspectorSection title="משימות פתוחות" subtitle="פעולות המשך לביצוע היום" icon={MapPin} action={<Link href="/dashboard/inspector/tasks">לכל המשימות</Link>}>
        <InspectorList>
          {tasks.slice(0, 5).map((task) => (
            <InspectorRow
              key={task.id}
              href="/dashboard/inspector/tasks"
              title={task.title ?? "משימת פיקוח"}
              subtitle={task.due_at ? `עד ${new Date(task.due_at).toLocaleDateString("he-IL")}` : "ללא תאריך יעד"}
              status={<InspectorStatus tone={task.priority === "high" ? "warning" : "primary"}>{taskStatusLabel(task.status)}</InspectorStatus>}
            />
          ))}
          {tasks.length === 0 ? <InspectorEmpty title="אין משימות פתוחות" text="משימות פיקוח, תיקונים ומעקב יופיעו כאן." icon={ClipboardCheck} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}

function DashboardTwoColumns({ children }: { children: ReactNode }) {
  return <div className="gb-dashboard-grid gb-grid-2" style={{ "--gb-grid-min": "300px" } as CSSProperties}>{children}</div>;
}

function BellIcon(props: any) {
  return <AlertTriangle {...props} />;
}
