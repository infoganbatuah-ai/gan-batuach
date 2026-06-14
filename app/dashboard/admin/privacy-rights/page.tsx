import { revalidatePath } from "next/cache";
import { Archive, CheckCircle2, FileSearch, Gavel, ShieldAlert, Trash2, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { resolveDataSubjectScope, summarizePrivacyScope } from "@/lib/privacy/data-subject-scope";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

const requestLabels: Record<string, string> = {
  access: "Access",
  correction: "Correction",
  export: "Export",
  deletion: "Deletion",
  restriction: "Restriction",
  anonymization: "Anonymization"
};

function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

function statusTone(status: string): "good" | "warn" | "bad" {
  if (["completed", "approved", "active"].includes(status)) return "good";
  if (["rejected", "blocked_by_legal_hold", "active_hold", "needs_legal_review"].includes(status)) return "bad";
  return "warn";
}

async function updatePrivacyRequestStatus(formData: FormData) {
  "use server";
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "under_review");
  const decisionReason = String(formData.get("decision_reason") ?? "").slice(0, 1200);
  const update = await supabase.from("privacy_rights_requests" as any).update({
    status,
    reviewer_id: profile.id,
    decision_reason: decisionReason || null,
    completed_at: status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
    response_summary: status === "rejected" ? "הבקשה נדחתה לאחר בדיקה." : status === "completed" ? "הטיפול בבקשה הושלם." : "הבקשה נמצאת בטיפול."
  }).eq("id", id).select("id,request_type,garden_id,child_id").maybeSingle();
  if (!update.error) {
    await writeAuditEvent({
      eventType: `privacy_request_${status}`,
      eventCategory: "regulatory",
      actorProfileId: profile.id,
      actorRole: profile.role,
      targetType: "privacy_request",
      targetId: id,
      gardenId: (update.data as any)?.garden_id ?? null,
      childId: (update.data as any)?.child_id ?? null,
      metadata: { request_type: (update.data as any)?.request_type ?? null, decision_reason: decisionReason || null },
      riskLevel: status === "approved" || status === "completed" ? "high" : "medium"
    });
  }
  revalidatePath("/dashboard/admin/privacy-rights");
}

async function calculateRequestScope(formData: FormData) {
  "use server";
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const request = await supabase.from("privacy_rights_requests" as any).select("*").eq("id", id).maybeSingle();
  if (request.error || !request.data) return;
  const row = request.data as any;
  const items = await resolveDataSubjectScope(supabase as any, {
    subjectUserId: row.subject_user_id ?? row.requested_by ?? row.requester_profile_id,
    childId: row.child_id,
    gardenId: row.garden_id,
    subjectType: row.subject_type ?? row.data_subject_type
  });
  await supabase.from("privacy_request_scope_items" as any).delete().eq("privacy_request_id", id);
  if (items.length) {
    await supabase.from("privacy_request_scope_items" as any).insert(items.map((item) => ({
      privacy_request_id: id,
      data_category: item.dataCategory,
      table_name: item.tableName,
      estimated_record_count: item.estimatedRecordCount,
      action_recommendation: item.actionRecommendation,
      parent_export_allowed: item.parentExportAllowed,
      blocked_by_retention: item.actionRecommendation === "retain",
      notes: item.notes,
      metadata: { source: "phase156_scope_resolver" }
    })));
  }
  const summary = summarizePrivacyScope(items);
  await supabase.from("privacy_rights_requests" as any).update({
    status: row.status === "submitted" ? "under_review" : row.status,
    execution_status: "scoped",
    scope_calculated_at: new Date().toISOString(),
    retention_conflicts: items.filter((item) => item.actionRecommendation === "retain"),
    metadata: { ...(row.metadata ?? {}), scope_summary: summary },
    updated_at: new Date().toISOString()
  }).eq("id", id);
  await writeAuditEvent({
    eventType: "privacy_scope_calculated",
    eventCategory: "regulatory",
    actorProfileId: profile.id,
    actorRole: profile.role,
    targetType: "privacy_request",
    targetId: id,
    gardenId: row.garden_id ?? null,
    childId: row.child_id ?? null,
    metadata: summary,
    riskLevel: "high"
  });
  revalidatePath("/dashboard/admin/privacy-rights");
}

async function createLegalHoldForRequest(formData: FormData) {
  "use server";
  const { profile } = await requireRole(["admin"]);
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("hold_reason") ?? "Manual privacy deletion hold").slice(0, 400);
  const request = await supabase.from("privacy_rights_requests" as any).select("*").eq("id", id).maybeSingle();
  if (request.error || !request.data) return;
  const row = request.data as any;
  const hold = await supabase.from("legal_holds" as any).insert({
    hold_key: `privacy:${id}:${Date.now()}`,
    hold_reason: reason,
    hold_type: "audit_preservation",
    status: "active",
    garden_id: row.garden_id ?? null,
    child_id: row.child_id ?? null,
    subject_user_id: row.subject_user_id ?? row.requested_by ?? null,
    created_by: profile.id,
    metadata: { privacy_request_id: id, source: "admin_privacy_rights" }
  }).select("id").single();
  await supabase.from("privacy_rights_requests" as any).update({
    status: "blocked_by_legal_hold",
    legal_hold_checked_at: new Date().toISOString(),
    execution_status: "blocked",
    legal_hold_conflicts: [{ hold_id: hold.data?.id ?? null, reason }],
    updated_at: new Date().toISOString()
  }).eq("id", id);
  await writeAuditEvent({
    eventType: "legal_hold_checked",
    eventCategory: "regulatory",
    actorProfileId: profile.id,
    actorRole: profile.role,
    targetType: "privacy_request",
    targetId: id,
    gardenId: row.garden_id ?? null,
    childId: row.child_id ?? null,
    metadata: { hold_id: hold.data?.id ?? null, reason },
    riskLevel: "high"
  });
  revalidatePath("/dashboard/admin/privacy-rights");
}

export default async function AdminPrivacyRightsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("privacy rights", async () => {
    const supabase = await createClient();
    const [requestsRes, holdsRes, policiesRes, scopeRes, executionRes, queueRes] = await Promise.all([
      supabase.from("privacy_rights_requests" as any).select("*, requester:requested_by(full_name,email,role), child:child_id(full_name), garden:garden_id(name,city)").order("created_at", { ascending: false }).limit(160),
      supabase.from("legal_holds" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("data_retention_policies" as any).select("*").order("data_category").limit(120),
      supabase.from("privacy_request_scope_items" as any).select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("privacy_execution_actions" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("retention_review_queue" as any).select("*").order("due_at", { ascending: true }).limit(120)
    ]);
    [requestsRes, holdsRes, policiesRes, scopeRes, executionRes, queueRes].forEach((query, index) => logSupabaseError(`privacy rights query ${index}`, (query as any).error));
    return {
      requests: requestsRes.data ?? [],
      holds: holdsRes.data ?? [],
      policies: policiesRes.data ?? [],
      scope: scopeRes.data ?? [],
      execution: executionRes.data ?? [],
      queue: queueRes.data ?? [],
      queryError: [requestsRes.error, holdsRes.error, policiesRes.error, scopeRes.error, executionRes.error, queueRes.error].some(Boolean)
        ? "חלק מנתוני זכויות הפרטיות לא נטענו. ייתכן שמיגרציית Phase 156 עדיין לא הורצה."
        : null
    };
  }, { requests: [] as any[], holds: [] as any[], policies: [] as any[], scope: [] as any[], execution: [] as any[], queue: [] as any[], queryError: null as string | null });

  const requests = result.data.requests;
  const open = requests.filter((request: any) => !["completed", "rejected", "cancelled"].includes(String(request.status))).length;
  const deletion = requests.filter((request: any) => ["deletion", "anonymization"].includes(String(request.request_type))).length;
  const exportRequests = requests.filter((request: any) => request.request_type === "export").length;
  const activeHolds = result.data.holds.filter((hold: any) => hold.status === "active").length;
  const legalReviewPolicies = result.data.policies.filter((policy: any) => policy.status === "needs_legal_review").length;
  const scoped = requests.filter((request: any) => request.scope_calculated_at).length;
  const readiness = Math.round(((requests.length ? Math.max(30, 100 - open * 5) : 75) + (result.data.policies.length ? 85 : 15) + (activeHolds ? 70 : 90) + (scoped ? 85 : 45)) / 4);
  const scopeByRequest = new Map<string, any[]>();
  for (const item of result.data.scope) {
    const list = scopeByRequest.get(item.privacy_request_id) ?? [];
    list.push(item);
    scopeByRequest.set(item.privacy_request_id, list);
  }

  return (
    <DashboardShell role="admin" title="Privacy Rights">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Data Lifecycle Governance</p>
          <h1>מרכז זכויות פרטיות, שימור ומחיקה.</h1>
          <p>גישה, תיקון, ייצוא, מחיקה, אנונימיזציה ו-legal hold עם בדיקה אנושית מלאה וללא מחיקה עיוורת.</p>
        </div>
        <div className="profile-actions">
          <span className={`pill ${scoreTone(readiness)}`}>{readiness}/100</span>
          <span className="pill warn">No automatic deletion</span>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="Open requests" value={open} tone={open ? "warn" : "good"} />
        <StatCard label="Deletion / anonymization" value={deletion} tone={deletion ? "bad" : "good"} />
        <StatCard label="Export requests" value={exportRequests} tone={exportRequests ? "warn" : "good"} />
        <StatCard label="Active legal holds" value={activeHolds} tone={activeHolds ? "bad" : "good"} />
        <StatCard label="Retention policies" value={result.data.policies.length} tone="good" />
        <StatCard label="Legal review policies" value={legalReviewPolicies} tone={legalReviewPolicies ? "warn" : "good"} />
        <StatCard label="Scoped requests" value={scoped} tone={scoped ? "good" : "warn"} />
        <StatCard label="Retention queue" value={result.data.queue.length} tone={result.data.queue.length ? "warn" : "good"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Archive size={20} /> Retention Registry</h2><p>מדיניות לפי קטגוריית מידע.</p></div>
          <div className="procedure-list compact-list">
            {result.data.policies.slice(0, 12).map((policy: any) => (
              <div className="mini-row" key={policy.id}>
                <span>{policy.title}</span>
                <strong className={`pill ${statusTone(policy.status)}`}>{policy.status}</strong>
                <small>{policy.retention_period_days ?? "legal"} ימים · {policy.deletion_method}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Gavel size={20} /> Legal Holds</h2><p>חסימות מחיקה בשל ראיות וחובות שימור.</p></div>
          <div className="procedure-list compact-list">
            {result.data.holds.length === 0 ? <div className="empty-mini">אין legal holds פעילים.</div> : result.data.holds.slice(0, 10).map((hold: any) => (
              <div className="mini-row" key={hold.id}>
                <span>{hold.hold_reason}</span>
                <strong className={`pill ${statusTone(hold.status)}`}>{hold.status}</strong>
                <small>{hold.hold_type}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldAlert size={20} /> Safe Deletion Rules</h2><p>מה אסור למחוק אוטומטית.</p></div>
          <div className="risk-list">
            <div>Active incidents <b>block</b></div>
            <div>Inspection evidence <b>retain</b></div>
            <div>Payment records <b>retain legal</b></div>
            <div>Audit logs <b>preserve integrity</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><UserCheck size={20} /> Privacy Requests</h2><p>Review, scope, legal hold and completion workflow.</p></div>
        {requests.length === 0 ? <div className="empty-state"><strong>No privacy requests</strong><span>User requests will appear here.</span></div> : <div className="procedure-list">
          {requests.map((request: any) => {
            const requestScope = scopeByRequest.get(request.id) ?? [];
            return (
              <article className="card procedure-card" key={request.id}>
                <div>
                  <span className={`pill ${statusTone(request.status)}`}>{request.status}</span>
                  <h3>{requestLabels[request.request_type] ?? request.request_type}</h3>
                  <p>{request.request_reason ?? request.response_summary ?? "No reason supplied."}</p>
                  <small>
                    {request.requester?.full_name ?? "Unknown user"} · {request.garden?.name ?? "No garden"} · {request.created_at ? new Date(request.created_at).toLocaleString("he-IL") : ""}
                  </small>
                  {requestScope.length ? <div className="risk-list">
                    <div>Scoped tables <b>{requestScope.length}</b></div>
                    <div>Records <b>{requestScope.reduce((sum, item) => sum + Number(item.estimated_record_count ?? 0), 0)}</b></div>
                    <div>Retention blocks <b>{requestScope.filter((item) => item.blocked_by_retention).length}</b></div>
                  </div> : null}
                </div>
                <div className="procedure-meta">
                  <form action={calculateRequestScope}><input type="hidden" name="id" value={request.id} /><button className="button secondary"><FileSearch size={16} /> Scope</button></form>
                  <form action={updatePrivacyRequestStatus}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="status" value="approved" /><button className="button secondary"><CheckCircle2 size={16} /> Approve</button></form>
                  <form action={updatePrivacyRequestStatus}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="status" value="completed" /><button className="button secondary">Complete</button></form>
                  <form action={createLegalHoldForRequest}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="hold_reason" value="Privacy request requires evidence preservation review" /><button className="button danger"><Gavel size={16} /> Legal hold</button></form>
                  <form action={updatePrivacyRequestStatus}><input type="hidden" name="id" value={request.id} /><input type="hidden" name="status" value="rejected" /><button className="button secondary"><Trash2 size={16} /> Reject</button></form>
                </div>
              </article>
            );
          })}
        </div>}
      </section>
    </DashboardShell>
  );
}
