import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarCheck, Camera, ClipboardCheck, FileText, MapPin, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { requireApprovedInspector } from "@/lib/management/operational-role";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
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
  InspectorSection,
  InspectorStatus,
  InspectorTimeline
} from "@/components/inspector-app-ui";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }) : "טרם נקבע";
}

type InspectorPhoto = { profile_photo_url?: string | null };
type InspectorGarden = {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  safe_status?: string | null;
  last_inspection_score?: number | null;
  last_inspection_at?: string | null;
  next_inspection_at?: string | null;
  inspection_required_status?: string | null;
};
type InspectionSummary = { id: string; status: string; completed_at?: string | null; weighted_score?: number | null; violation_count?: number | null };
type ViolationSummary = { id: string; title: string; severity: string; status: string; correction_due_at?: string | null };
type ComplaintSummary = { id: string; status: string };
type TaskSummary = { id: string; title: string; status: string; due_at?: string | null };

export default async function InspectorGardenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireApprovedInspector();
  const supabase = await createClient();
  const [inspectorRes, gardenRes] = await Promise.all([
    supabase.from("inspectors").select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens").select("id,name,city,address,logo_url,image_url,safe_status,last_inspection_score,last_inspection_at,next_inspection_at,inspection_required_status").eq("id", id).eq("inspector_id", profile.id).maybeSingle()
  ]);
  const garden = gardenRes.data as unknown as InspectorGarden | null;
  if (!garden) notFound();
  const [inspectionsRes, violationsRes, complaintsRes, tasksRes] = await Promise.all([
    supabase.from("inspections").select("id,status,completed_at,weighted_score,violation_count").eq("garden_id", id).eq("inspector_id", profile.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("violations").select("id,title,severity,status,correction_due_at").eq("garden_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("complaints").select("id,subject,severity,status,created_at").eq("garden_id", id).eq("assigned_inspector_id", profile.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("tasks").select("id,title,status,priority,due_at").eq("garden_id", id).or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).order("created_at", { ascending: false }).limit(12)
  ]);
  const inspections = (inspectionsRes.data ?? []) as unknown as InspectionSummary[];
  const violations = (violationsRes.data ?? []) as unknown as ViolationSummary[];
  const complaints = (complaintsRes.data ?? []) as unknown as ComplaintSummary[];
  const tasks = (tasksRes.data ?? []) as unknown as TaskSummary[];
  const openViolations = violations.filter((row) => row.status !== "done");
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? profile.profile_image_url };
  const gardenName = cleanSyntheticLabel(garden.name, "גן");

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/control-center" title={gardenName} subtitle="תיק פיקוח — מידע מורשה בלבד" badge="גן משויך" backHref="/dashboard/inspector/control-center">
      <InspectorHero
        eyebrow="תיק גן"
        title={gardenName}
        subtitle={`${garden.city ?? ""}${garden.address ? ` · ${garden.address}` : ""}`}
        imageSrc={garden.image_url ?? garden.logo_url ?? "/assets/gan-batuach-auth-hero.webp"}
        imageAlt={`תמונת ${gardenName}`}
        meta={<><InspectorStatus tone={garden.safe_status === "safe" ? "success" : "warning"}>{garden.safe_status === "safe" ? "סטטוס תקין" : "דורש מעקב"}</InspectorStatus><InspectorStatus tone="info"><MapPin size={15} /> {garden.city ?? "ללא עיר"}</InspectorStatus></>}
        action={<Link className="inspector-action-button" href={`/dashboard/inspector/inspections?garden=${id}`}>פתיחת ביקורת</Link>}
      />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="ציון אחרון" value={garden.last_inspection_score ?? "—"} hint={date(garden.last_inspection_at)} icon={ShieldCheck} tone={Number(garden.last_inspection_score ?? 0) >= 80 ? "success" : "warning"} />
        <InspectorMetricCard label="ביקורת הבאה" value={date(garden.next_inspection_at)} hint={garden.inspection_required_status ?? "לפי לוח פיקוח"} icon={CalendarCheck} />
        <InspectorMetricCard label="ליקויים פתוחים" value={openViolations.length} hint="פעולות תיקון" icon={AlertTriangle} tone={openViolations.length ? "warning" : "success"} />
        <InspectorMetricCard label="פניות פתוחות" value={complaints.filter((row) => !["closed", "resolved"].includes(row.status)).length} hint="בתחום השיוך" icon={MessageSquareWarning} />
      </InspectorMetricGrid>
      <div className="inspector-detail-grid">
        <InspectorSection title="פעילות פיקוח אחרונה" subtitle="ביקורות, ציונים וליקויים נשמרים כהיסטוריה" icon={ClipboardCheck}>
          {inspections.length ? <InspectorTimeline items={inspections.slice(0, 7).map((row) => ({ title: row.status === "done" ? `ביקורת הושלמה — ציון ${row.weighted_score ?? "—"}` : "ביקורת בתהליך", text: `${row.violation_count ?? 0} ליקויים`, date: date(row.completed_at), tone: row.status === "done" ? "success" : "primary" }))} /> : <InspectorEmpty title="אין ביקורות קודמות" text="הביקורת הראשונה תופיע כאן לאחר פתיחתה." icon={ClipboardCheck} />}
        </InspectorSection>
        <InspectorSection title="פעולות פתוחות" subtitle="משימות וליקויים של הגן" icon={AlertTriangle}>
          <InspectorList>
            {openViolations.slice(0, 3).map((row) => <InspectorRow key={row.id} href={`/dashboard/inspector/corrective-actions/${row.id}`} title={row.title} subtitle={`יעד: ${date(row.correction_due_at)}`} status={<InspectorStatus tone={["critical", "high"].includes(row.severity) ? "danger" : "warning"}>{row.status}</InspectorStatus>} />)}
            {tasks.slice(0, 3).map((row) => <InspectorRow key={row.id} href="/dashboard/inspector/tasks" title={row.title} subtitle={row.due_at ? `יעד: ${date(row.due_at)}` : "ללא תאריך יעד"} status={<InspectorStatus tone="info">{row.status}</InspectorStatus>} />)}
            {!openViolations.length && !tasks.length ? <InspectorEmpty title="אין פעולות פתוחות" text="הגן אינו ממתין כרגע לפעולת פיקוח." icon={ShieldCheck} /> : null}
          </InspectorList>
        </InspectorSection>
      </div>
      <InspectorActions>
        <InspectorActionCard title="ביקורות" text="טיוטה, הגשה והיסטוריה" href={`/dashboard/inspector/inspections?garden=${id}`} icon={ClipboardCheck} />
        <InspectorActionCard title="תיקונים" text="ראיות והחלטת מפקח" href="/dashboard/inspector/corrective-actions" icon={AlertTriangle} tone="warning" />
        <InspectorActionCard title="דוחות" text="דוחות חתומים" href="/dashboard/inspector/inspections/history" icon={FileText} />
        <InspectorActionCard title="מצלמות" text="לפי מדיניות הגן בלבד" href="/dashboard/inspector/cameras" icon={Camera} tone="info" />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
