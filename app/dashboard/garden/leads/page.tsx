import { Bell, CheckCircle2, FileText, UserRoundPlus, UsersRound } from "lucide-react";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenChildTransferRequestsPanel } from "@/components/garden-child-transfer-requests-panel";
import { GardenParentLeadsCenter } from "@/components/garden-parent-leads-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

const leadFilterLabels: Record<string, string> = {
  new: "בקשות חדשות שממתינות להמרה",
  pending: "בקשות שממתינות לטיפול",
  completion: "הורים פעילים שממתינים להשלמת פרטי ילד",
  missing: "בקשות שחסרים בהן פרטים",
  converted: "בקשות שכבר הומרו"
};

function filterLeads(leads: any[], status?: string) {
  if (!status) return leads;
  if (status === "new") return leads.filter((lead) => ["new", "new_parent_lead", "viewed"].includes(String(lead.status)));
  if (status === "pending") return leads.filter((lead) => ["new", "new_parent_lead", "viewed", "missing_details"].includes(String(lead.status)));
  if (status === "completion") return leads.filter((lead) => ["parent_approved_pending_child_completion", "approved_pending_parent_completion"].includes(String(lead.status)));
  if (status === "missing") return leads.filter((lead) => lead.status === "missing_details");
  if (status === "converted") return leads.filter((lead) => ["parent_approved_pending_child_completion", "approved_pending_parent_completion", "active", "converted"].includes(String(lead.status)));
  return leads;
}

export default async function GardenLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const { data } = await supabase
    .from("leads" as any)
    .select("id, garden_id, lead_type, parent_name, parent_identity_number, phone, email, child_name, child_identity_number, child_age, requested_age_group, requested_start_date, address, notes, status, source, missing_details, converted_parent_id, converted_child_id, converted_at, created_at, gardens(name, city)")
    .eq("garden_id", gardenId)
    .eq("lead_type", "parent")
    .order("created_at", { ascending: false });

  const leads = (data ?? []) as any[];
  const visibleLeads = filterLeads(leads, params.status);
  const [incomingTransfersRes, outgoingTransfersRes] = await Promise.all([
    supabase.from("child_transfer_requests" as any).select("*").eq("target_garden_id", gardenId).order("created_at", { ascending: false }),
    supabase.from("child_transfer_requests" as any).select("*").eq("current_garden_id", gardenId).order("created_at", { ascending: false })
  ]);
  const transferRows = [...((incomingTransfersRes.data ?? []) as any[]), ...((outgoingTransfersRes.data ?? []) as any[])];
  const childIds = Array.from(new Set(transferRows.flatMap((row) => [row.child_id, row.target_child_id]).filter(Boolean)));
  const fileIds = Array.from(new Set(transferRows.map((row) => row.permanent_child_file_id).filter(Boolean)));
  const parentIds = Array.from(new Set(transferRows.map((row) => row.parent_id).filter(Boolean)));
  const transferGardenIds = Array.from(new Set(transferRows.flatMap((row) => [row.current_garden_id, row.target_garden_id]).filter(Boolean)));
  const [transferChildrenRes, transferFilesRes, transferParentsRes, transferGardensRes] = await Promise.all([
    childIds.length ? supabase.from("children" as any).select("id, full_name, birth_date, photo_url, face_image_url, allergies, medical_notes, emergency_phone, pickup_authorized").in("id", childIds) : { data: [] },
    fileIds.length ? supabase.from("permanent_child_files" as any).select("id, full_name, birth_date, photo_url, face_image_url, allergies, medical_notes, emergency_phone, pickup_authorized").in("id", fileIds) : { data: [] },
    parentIds.length ? supabase.from("parents" as any).select("id, full_name, phone, email").in("id", parentIds) : { data: [] },
    transferGardenIds.length ? supabase.from("gardens" as any).select("id, name, city").in("id", transferGardenIds) : { data: [] }
  ]);
  const childrenById = new Map(((transferChildrenRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const filesById = new Map(((transferFilesRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const parentsById = new Map(((transferParentsRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const gardensById = new Map(((transferGardensRes.data ?? []) as any[]).map((row) => [row.id, row]));
  const hydrateTransfer = (row: any) => ({
    ...row,
    child: row.child_id ? childrenById.get(row.child_id) : null,
    target_child: row.target_child_id ? childrenById.get(row.target_child_id) : null,
    permanent_child_files: row.permanent_child_file_id ? filesById.get(row.permanent_child_file_id) : null,
    parent: row.parent_id ? parentsById.get(row.parent_id) : null,
    current_garden: row.current_garden_id ? gardensById.get(row.current_garden_id) : null,
    target_garden: row.target_garden_id ? gardensById.get(row.target_garden_id) : null
  });
  const incomingTransfers = ((incomingTransfersRes.data ?? []) as any[]).map(hydrateTransfer);
  const outgoingTransfers = ((outgoingTransfersRes.data ?? []) as any[]).map(hydrateTransfer);
  const newCount = leads.filter((lead) => ["new", "new_parent_lead"].includes(lead.status)).length;
  const pendingCompletion = leads.filter((lead) => ["parent_approved_pending_child_completion", "approved_pending_parent_completion"].includes(String(lead.status))).length;
  const missing = leads.filter((lead) => lead.status === "missing_details").length;
  const transferCount = incomingTransfers.length + outgoingTransfers.length;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="לידים / בקשות הצטרפות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="בקשות הורים וקליטה" avatarUrl={(profile as any).profile_image_url ?? null} active="children">
        <TeacherPageTitle icon={UserRoundPlus} title="בקשות הצטרפות ולידים" subtitle="בודקים בקשה, מאשרים, וההורה משלים את פרטי הילד" action={<a className="button primary" href="#leads-full"><Bell size={18} /> ניהול מלא</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="חדשים" value={newCount} hint="לטיפול" icon={Bell} tone={newCount ? "orange" : "green"} href="/dashboard/garden/leads?status=new" />
          <TeacherStatCard title="השלמת הורה" value={pendingCompletion} hint="ממתינים" icon={UserRoundPlus} tone={pendingCompletion ? "purple" : "blue"} href="/dashboard/garden/leads?status=completion" />
          <TeacherStatCard title="חסרים פרטים" value={missing} hint="להשלמה" icon={FileText} tone={missing ? "red" : "green"} href="/dashboard/garden/leads?status=missing" />
          <TeacherStatCard title="בקשות מעבר" value={transferCount} hint="קליטה/שחרור" icon={UsersRound} tone={transferCount ? "orange" : "green"} />
        </TeacherStatsGrid>

        <TeacherSection title="בקשות אחרונות" action={<a href="#leads-full">לכל הבקשות ›</a>}>
          {visibleLeads.length ? (
            <TeacherCompactList>
              {visibleLeads.slice(0, 7).map((lead) => (
                <TeacherCompactItem
                  key={lead.id}
                  title={lead.child_name ?? lead.parent_name ?? "בקשת הורה"}
                  subtitle={`${lead.parent_name ?? "הורה"} · ${lead.phone ?? "טלפון חסר"} · ${lead.requested_age_group ?? "קבוצת גיל"}`}
                  tone={lead.status === "missing_details" ? "red" : ["new", "new_parent_lead"].includes(String(lead.status)) ? "orange" : "purple"}
                  meta={lead.status ?? "חדש"}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title="אין בקשות במסנן הזה" text="כל הבקשות במסנן הזה כבר טופלו או עברו לשלב הבא." />
          )}
        </TeacherSection>

        <TeacherAiInsight metric={`${leads.length}`}>
          מאשרים בקשה, ההורה משלים פרטים, ורק לאחר אישור הגן הילד עובר להפעלה. אין העברת ילד אוטומטית בין גנים.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות בקשה">
          <TeacherActionTile title="בקשות הצטרפות" href="/dashboard/garden/enrollment-requests" icon={UserRoundPlus} tone="purple" />
          <TeacherActionTile title="ילדי הגן" href="/dashboard/garden/children" icon={UsersRound} tone="blue" />
          <TeacherActionTile title="הודעות הורים" href="/dashboard/garden/messages" icon={Bell} tone="orange" />
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={FileText} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="leads-full">
          <summary>ניהול מלא של בקשות ולידים</summary>
          <DashboardFilterChip
            label={leadFilterLabels[params.status ?? ""]}
            clearHref="/dashboard/garden/leads"
            isEmpty={visibleLeads.length === 0}
            emptyTitle={params.status === "new" ? "אין כרגע לידים חדשים" : params.status ? `אין כרגע ${leadFilterLabels[params.status]}` : undefined}
            emptyText="כל הבקשות במסנן הזה כבר טופלו או עברו לשלב הבא."
          />
          <GardenChildTransferRequestsPanel incoming={incomingTransfers} outgoing={outgoingTransfers} />
          <GardenParentLeadsCenter leads={visibleLeads} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
