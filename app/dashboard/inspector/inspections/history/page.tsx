import Link from "next/link";
import { BarChart3, CalendarCheck, FileText, ShieldCheck } from "lucide-react";
import { FormField, SearchFilterBar } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
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

function inspectionStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    planned: "מתוכננת",
    scheduled: "מתוכננת",
    in_progress: "בביצוע",
    pending: "ממתינה להשלמה",
    completed: "הושלמה",
    done: "הושלמה",
    overdue: "באיחור",
    follow_up: "נדרש מעקב",
    closed: "נסגרה"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "ממתינה";
}

export default async function InspectorInspectionHistoryPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, historyRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("inspections" as any).select("id, garden_id, completed_at, status, weighted_score, violation_count, critical_failures, gps_verified, gardens(name, city)").eq("inspector_id", profile.id).order("completed_at", { ascending: false }).limit(100)
  ]);
  const rows = (historyRes.data ?? []) as any[];
  const scoreRows = rows.map((row) => Number(row.weighted_score)).filter((score) => Number.isFinite(score));
  const avg = scoreRows.length ? Math.round(scoreRows.reduce((sum, score) => sum + score, 0) / scoreRows.length) : null;
  const passed = rows.filter((row) => Number(row.weighted_score ?? 0) >= 80).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="היסטוריית ביקורות" subtitle="עמידה בתקן, ציונים ודוחות עבר" badge="דוחות" backHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="דוחות וביקורות"
        title="כל הביקורות שביצעת במקום אחד"
        subtitle="היסטוריית ביקורות לפי גן, ציון, ליקויים, חתימה ו-GPS."
        artwork={<BarChart3 />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/reports">דיווחים פתוחים</Link>}
      />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="סה״כ ביקורות" value={rows.length} hint="בתקופה האחרונה" icon={CalendarCheck} />
        <InspectorMetricCard label="ציון ממוצע" value={avg ?? "—"} hint={avg === null ? "טרם חושב" : "מתוך 100"} icon={BarChart3} tone={avg === null ? "muted" : "primary"} />
        <InspectorMetricCard label="עמדו בתקן" value={passed} hint="ביקורות שעברו" icon={ShieldCheck} tone="success" />
        <InspectorMetricCard label="ליקויים" value={rows.reduce((sum, row) => sum + Number(row.violation_count ?? 0), 0)} hint="נמצאו בביקורות" icon={FileText} tone="warning" />
      </InspectorMetricGrid>
      <SearchFilterBar filters={<><FormField as="select" label="תקופה"><option>12 חודשים אחרונים</option><option>חודש נוכחי</option><option>רבעון</option></FormField><FormField as="select" label="ציון"><option>כל הציונים</option><option>מתחת 80</option><option>80 ומעלה</option></FormField></>} />
      <InspectorSection title="ביקורות אחרונות" subtitle="פתיחת דוח PDF או צפייה בפרטים" icon={FileText}>
        <InspectorList>
          {rows.map((row) => (
            <InspectorRow
              key={row.id}
              title={row.gardens?.name ?? row.garden_id}
              subtitle={row.gardens?.city ?? ""}
              meta={`ליקויים: ${row.violation_count ?? 0} · קריטיים: ${row.critical_failures ?? 0} · GPS ${row.gps_verified ? "אומת" : "לא אומת"}`}
              status={<><InspectorScoreRing value={row.weighted_score ?? "-"} label="ציון" /><InspectorStatus tone={Number(row.weighted_score ?? 0) >= 80 ? "success" : "danger"}>{row.completed_at ? new Date(row.completed_at).toLocaleDateString("he-IL") : inspectionStatusLabel(row.status)}</InspectorStatus></>}
              actions={<><Link className="inspector-action-button secondary" href={`/api/inspections/${row.id}/report`}>צפייה</Link><Link className="inspector-action-button" href={`/api/inspections/${row.id}/report?download=1`}>הורדה</Link></>}
            />
          ))}
          {rows.length === 0 ? <InspectorEmpty title="אין היסטוריית ביקורות" text="לאחר שליחת טופס פיקוח חתום, הדוח יופיע כאן." icon={FileText} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
