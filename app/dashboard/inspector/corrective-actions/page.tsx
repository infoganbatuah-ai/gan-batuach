import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Wrench } from "lucide-react";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorEmpty, InspectorHero, InspectorList, InspectorMetricCard, InspectorMetricGrid, InspectorRow, InspectorSection, InspectorStatus } from "@/components/inspector-app-ui";

const statusLabel: Record<string, string> = { open: "פתוח", in_progress: "בטיפול בגן", waiting_approval: "ממתין לבדיקת מפקח", rejected: "הוחזר לתיקון", overdue: "באיחור", done: "הושלם" };

export default async function InspectorCorrectiveActionsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id)
  ]);
  const gardenIds = (gardensRes.data ?? []).map((row: any) => row.id);
  const violationsRes = gardenIds.length ? await supabase.from("violations" as any).select("id,garden_id,title,description,severity,status,correction_due_at,submitted_at,correction_files,gardens(name,city)").in("garden_id", gardenIds).order("updated_at", { ascending: false }).limit(100) : { data: [] };
  const rows = (violationsRes.data ?? []) as any[];
  const waiting = rows.filter((row) => row.status === "waiting_approval").length;
  const overdue = rows.filter((row) => row.status !== "done" && row.correction_due_at && new Date(row.correction_due_at).getTime() < Date.now()).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/corrective-actions" title="מעקב תיקונים" subtitle="ראיות, החלטות והיסטוריית טיפול" badge="פעולות תיקון">
      <InspectorHero eyebrow="GB-M23" title="כל תיקון נבדק מול הממצא המקורי" subtitle="הגן מגיש הסבר וראיות. המפקח מאשר, דוחה או פותח מחדש — בלי לשנות את ציון הביקורת המקורי." artwork={<Wrench />} action={<Link className="inspector-action-button" href="/dashboard/inspector/violations">לכל הממצאים</Link>} />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="פתוחים" value={rows.filter((r) => r.status !== "done").length} hint="דורשי מעקב" icon={AlertTriangle} tone="warning" />
        <InspectorMetricCard label="ממתינים לבדיקה" value={waiting} hint="הוגשו על ידי הגן" icon={FileCheck2} tone={waiting ? "primary" : "success"} />
        <InspectorMetricCard label="באיחור" value={overdue} hint="עבר תאריך היעד" icon={Clock3} tone={overdue ? "danger" : "success"} />
        <InspectorMetricCard label="הושלמו" value={rows.filter((r) => r.status === "done").length} hint="נסגרו לאחר אימות" icon={CheckCircle2} tone="success" />
      </InspectorMetricGrid>
      <InspectorSection title="תור בדיקת תיקונים" subtitle="הממתינים להחלטה מופיעים ראשונים" icon={FileCheck2}>
        <InspectorList>
          {[...rows].sort((a, b) => Number(b.status === "waiting_approval") - Number(a.status === "waiting_approval")).map((row) => (
            <InspectorRow key={row.id} href={`/dashboard/inspector/corrective-actions/${row.id}`} title={row.title} subtitle={`${row.gardens?.name ?? "גן"} · ${row.gardens?.city ?? ""}`} meta={row.correction_due_at ? `יעד: ${new Date(row.correction_due_at).toLocaleDateString("he-IL")}` : "ללא תאריך יעד"} status={<InspectorStatus tone={row.status === "done" ? "success" : row.status === "waiting_approval" ? "primary" : row.status === "overdue" ? "danger" : "warning"}>{statusLabel[row.status] ?? row.status}</InspectorStatus>} />
          ))}
          {rows.length === 0 ? <InspectorEmpty title="אין פעולות תיקון" text="ממצאים שדורשים טיפול יופיעו כאן עם ראיות והחלטת פקח." icon={CheckCircle2} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
