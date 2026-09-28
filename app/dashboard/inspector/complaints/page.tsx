import { AlertTriangle, Clock3, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { ComplaintCaseActions } from "@/components/complaint-case-actions";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorEmpty, InspectorHero, InspectorList, InspectorMetricCard, InspectorMetricGrid, InspectorRow, InspectorSection, InspectorStatus } from "@/components/inspector-app-ui";

type InspectorPhoto = { profile_photo_url?: string | null };
type GardenId = { id: string };
type ComplaintRow = {
  id: string;
  subject: string;
  category?: string | null;
  severity?: string | null;
  status: string;
  created_at: string;
  acknowledgement_due_at?: string | null;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  gardens?: { name?: string | null; city?: string | null } | null;
};

export default async function InspectorComplaintsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors").select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens").select("id").eq("inspector_id", profile.id)
  ]);
  const gardenIds = ((gardensRes.data ?? []) as unknown as GardenId[]).map((garden) => garden.id);
  const complaintsRes = gardenIds.length ? await supabase.from("complaints").select("id,garden_id,subject,category,severity,status,created_at,acknowledgement_due_at,response_due_at,resolution_due_at,gardens(name,city)").in("garden_id", gardenIds).eq("assigned_inspector_id", profile.id).order("created_at", { ascending: false }).limit(100) : { data: [] };
  const rows = (complaintsRes.data ?? []) as unknown as ComplaintRow[];
  const open = rows.filter((r) => !["closed", "resolved"].includes(String(r.status ?? "")));
  const overdue = open.filter((r) => [r.acknowledgement_due_at, r.response_due_at, r.resolution_due_at].some((d) => d && new Date(d).getTime() < Date.now())).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? profile.profile_image_url };
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/complaints" title="תלונות ופניות" subtitle="גישה רק לפניות בתחום השיוך" badge="תלונות">
      <InspectorHero eyebrow="טיפול אנושי" title="פניות שדורשות תשומת לב של מפקח" subtitle="התוכן מוצג רק כאשר התלונה שויכה אליך ובתחום גן מוקצה. הערות פנימיות שאינן מורשות אינן נחשפות." artwork={<MessageSquareWarning />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="פתוחות" value={open.length} hint="דורשות פעולה" icon={MessageSquareWarning} />
        <InspectorMetricCard label="יעד חלף" value={overdue} hint="לפי SLA קנוני" icon={Clock3} tone={overdue ? "danger" : "success"} />
        <InspectorMetricCard label="גנים בטווח" value={gardenIds.length} hint="שיוך מאומת" icon={ShieldCheck} />
      </InspectorMetricGrid>
      <InspectorSection title="תור פניות" subtitle="מיון לפי זמן, חומרה וסטטוס" icon={AlertTriangle}>
        <InspectorList>{rows.map((row) => <InspectorRow key={row.id} title={row.subject} subtitle={`${row.gardens?.name ?? "גן"} · ${row.category ?? "פנייה"}`} meta={new Date(row.created_at).toLocaleString("he-IL")} status={<InspectorStatus tone={["critical", "high", "urgent"].includes(String(row.severity ?? "")) ? "danger" : "warning"}>{row.status}</InspectorStatus>} actions={<ComplaintCaseActions id={row.id} status={row.status} role="inspector" />} />)}{rows.length === 0 ? <InspectorEmpty title="אין תלונות בתחום השיוך" text="פניות מורשות בלבד יופיעו כאן." icon={ShieldCheck} /> : null}</InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
