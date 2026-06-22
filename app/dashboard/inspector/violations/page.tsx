import Link from "next/link";
import { AlertTriangle, ShieldCheck, Wrench } from "lucide-react";
import { ViolationStatusActions } from "@/components/violation-status-actions";
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
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

function severityTone(value?: string | null) {
  return value === "critical" || value === "high" ? "danger" : value === "medium" ? "warning" : "primary";
}

function severityLabel(value?: string | null) {
  const labels: Record<string, string> = {
    critical: "קריטי",
    high: "גבוה",
    medium: "בינוני",
    low: "נמוך"
  };
  return labels[String(value ?? "")] ?? value ?? "ליקוי";
}

export default async function InspectorViolationsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id)
  ]);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const violationsRes = gardenIds.length
    ? await supabase
        .from("violations" as any)
        .select("id, garden_id, title, description, category, severity, score, status, correction_due_at, gardens(name, city)")
        .in("garden_id", gardenIds)
        .order("created_at", { ascending: false })
        .limit(80)
    : { data: [] };
  const rows = (violationsRes.data ?? []) as any[];
  const urgent = rows.filter((row) => row.severity === "critical" || row.severity === "high").length;
  const overdue = rows.filter((row) => row.correction_due_at && new Date(row.correction_due_at).getTime() < Date.now()).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="ליקויים ותיקונים" subtitle="אישור, דחייה ומעקב בגנים המשויכים" badge="ליקויים">
      <InspectorHero
        eyebrow="מעקב תיקונים"
        title="כל ליקוי מקבל סטטוס ברור ופעולת המשך"
        subtitle="פקח רואה רק ליקויים של גנים שהוקצו לו, כולל ציון, חומרה, תאריך יעד והוכחות תיקון."
        artwork={<Wrench />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/tasks">פתיחת משימות</Link>}
      />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="ליקויים פתוחים" value={rows.length} hint="בגנים שלך" icon={AlertTriangle} tone={rows.length ? "warning" : "success"} />
        <InspectorMetricCard label="דחופים" value={urgent} hint="קריטי/גבוה" icon={AlertTriangle} tone={urgent ? "danger" : "success"} />
        <InspectorMetricCard label="באיחור" value={overdue} hint="עבר יעד תיקון" icon={Wrench} tone={overdue ? "danger" : "success"} />
        <InspectorMetricCard label="גנים משויכים" value={gardenIds.length} hint="טווח הרשאה" icon={ShieldCheck} />
      </InspectorMetricGrid>
      <InspectorSection title="רשימת ליקויים" subtitle="עדכון סטטוס מתבצע דרך פעולות מאובטחות קיימות" icon={AlertTriangle}>
        <InspectorList>
          {rows.map((row) => (
            <InspectorRow
              key={row.id}
              title={row.title}
              subtitle={`${row.gardens?.name ?? "גן"} · ${row.category ?? "ליקוי"} · ציון ${row.score ?? "-"}`}
              meta={row.correction_due_at ? `יעד תיקון: ${new Date(row.correction_due_at).toLocaleDateString("he-IL")}` : "לא הוגדר יעד תיקון"}
              status={<InspectorStatus tone={severityTone(row.severity)}>{severityLabel(row.severity)}</InspectorStatus>}
              actions={<ViolationStatusActions id={row.id} initialStatus={row.status ?? "open"} />}
            />
          ))}
          {rows.length === 0 ? <InspectorEmpty title="אין ליקויים פתוחים בגנים שלך" text="שאלות פיקוח בציון נמוך או כשל קריטי ייצרו כאן ליקוי ומשימת תיקון לאישור הפקח." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
