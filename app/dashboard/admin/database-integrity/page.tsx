import Link from "next/link";
import { Database, FileWarning, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["passed", "fixed"].includes(value)) return "good";
  if (["needs_review", "warning"].includes(value)) return "warn";
  if (["critical", "blocked"].includes(value)) return "bad";
  return "default";
}

function toneForScore(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 65) return "warn";
  return "bad";
}

function label(value?: string | null) {
  return String(value ?? "unknown").replaceAll("_", " ");
}

function areaItems(items: Row[], area: string) {
  return items.filter((item) => item.audit_area === area);
}

async function safeQuery<T>(labelText: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(labelText, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(labelText, error);
    return [];
  }
}

export default async function DatabaseIntegrityPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("database integrity", async () => {
    const supabase = await createClient();
    const [scores, auditItems, rlsTargets, storageBuckets, qaBugs, finalGaps] = await Promise.all([
      safeQuery<Row>("database integrity score", () => supabase.from("database_integrity_score" as any).select("*").order("measured_at", { ascending: false }).limit(1)),
      safeQuery<Row>("database integrity audit items", () => supabase.from("database_integrity_audit_items" as any).select("*").order("severity").order("audit_area").limit(250)),
      safeQuery<Row>("database rls audit targets", () => supabase.from("database_rls_audit_targets" as any).select("*").order("sensitivity").order("table_name").limit(160)),
      safeQuery<Row>("database storage bucket audit", () => supabase.from("database_storage_bucket_audit" as any).select("*").order("sensitivity").order("bucket_id").limit(80)),
      safeQuery<Row>("qa database blockers", () => supabase.from("qa_bug_reports" as any).select("*").eq("launch_blocker", true).order("severity").limit(80)),
      safeQuery<Row>("final database gaps", () => supabase.from("final_compliance_gaps" as any).select("*").in("gap_area", ["security", "privacy", "storage", "camera", "iso"]).order("severity").limit(80))
    ]);
    return {
      score: scores[0] ?? null,
      auditItems,
      rlsTargets,
      storageBuckets,
      qaBugs,
      finalGaps
    };
  }, {
    score: null as Row | null,
    auditItems: [] as Row[],
    rlsTargets: [] as Row[],
    storageBuckets: [] as Row[],
    qaBugs: [] as Row[],
    finalGaps: [] as Row[]
  });

  const data = result.data;
  const score = Number(data.score?.database_integrity_score ?? 0);
  const critical = data.auditItems.filter((item) => ["critical", "blocked"].includes(String(item.status)) || item.severity === "critical");
  const warnings = data.auditItems.filter((item) => ["needs_review", "warning"].includes(String(item.status)));
  const fixed = data.auditItems.filter((item) => item.status === "fixed").length;
  const passed = data.auditItems.filter((item) => item.status === "passed").length;

  return (
    <DashboardShell role="admin" title="Database Integrity">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Supabase Integrity"
          title="מרכז יציבות מיגרציות ושלמות בסיס הנתונים"
          subtitle="בדיקת migration safety, RLS, enum consistency, helper functions, storage buckets, indexes, schema drift וחסמי DB קריטיים."
          badge={`${score}/100`}
          badgeTone={toneForScore(score)}
          actions={<><Link className="button primary" href="/dashboard/admin/master-qa">Master QA</Link><Link className="button secondary" href="/dashboard/admin/security">Security</Link></>}
        >
          <div className="setup-checklist">
            <span>{data.score?.recommendation ?? "needs_review"}</span>
            <span>{critical.length} critical blockers</span>
            <span>{warnings.length} items need review</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Database integrity" value={`${score}%`} hint={data.score?.recommendation ?? "not measured"} tone={toneForScore(score)} />
          <RoleMetricCard label="Migration safety" value={`${data.score?.migration_safety_score ?? 0}%`} hint="idempotency and seed safety" tone={toneForScore(Number(data.score?.migration_safety_score ?? 0))} />
          <RoleMetricCard label="RLS readiness" value={`${data.score?.rls_coverage_score ?? 0}%`} hint={`${data.rlsTargets.length} sensitive targets`} tone={toneForScore(Number(data.score?.rls_coverage_score ?? 0))} />
          <RoleMetricCard label="Enum consistency" value={`${data.score?.enum_consistency_score ?? 0}%`} hint="status and enum drift" tone={toneForScore(Number(data.score?.enum_consistency_score ?? 0))} />
          <RoleMetricCard label="Helpers" value={`${data.score?.helper_function_score ?? 0}%`} hint="is_admin and scope helpers" tone={toneForScore(Number(data.score?.helper_function_score ?? 0))} />
          <RoleMetricCard label="Storage security" value={`${data.score?.storage_security_score ?? 0}%`} hint={`${data.storageBuckets.length} buckets tracked`} tone={toneForScore(Number(data.score?.storage_security_score ?? 0))} />
          <RoleMetricCard label="Indexes" value={`${data.score?.index_readiness_score ?? 0}%`} hint="safe conditional indexes" tone={toneForScore(Number(data.score?.index_readiness_score ?? 0))} />
          <RoleMetricCard label="Schema gaps" value={critical.length + warnings.length} hint={`${fixed + passed} passed/fixed`} tone={critical.length ? "bad" : warnings.length ? "warn" : "good"} />
        </section>

        <section className="grid cols-3 dashboard-panels">
          <ActionCard icon={Database} title="Migration audit" text="127 migrations scanned locally for ordering, destructive patterns, seed risk and helper assumptions." href="#migration-audit" tone={warnings.length ? "warn" : "default"} />
          <ActionCard icon={LockKeyhole} title="RLS coverage" text="Sensitive target tables are tracked and Phase 162 re-applies RLS safely where tables exist." href="#rls-audit" tone="warn" />
          <ActionCard icon={FileWarning} title="Storage security" text="Sensitive buckets require live Supabase proof for public flags, signed URLs and access audit." href="#storage-audit" tone="warn" />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Critical Database Blockers" subtitle="חסמים שמונעים production confidence עד אימות או תיקון.">
            {critical.length === 0 ? <EmptyState title="אין חסמי DB קריטיים" /> : (
              <div className="camera-infra-list">
                {critical.map((item) => (
                  <article className="camera-infra-row" key={item.id ?? item.item_key}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.finding}</span>
                    </div>
                    <StatusBadge tone="bad">{label(item.severity)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>

          <CleanSection title="Critical Fixes Applied" subtitle="תיקונים בטוחים שבוצעו בלי מחיקה ובלי reset.">
            <div className="camera-infra-list">
              {data.auditItems.filter((item) => item.status === "fixed").map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.item_key}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.finding}</span>
                  </div>
                  <StatusBadge tone="good">Phase {item.fixed_in_phase}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Migration Audit" subtitle="ממצאי audit לפי migration safety, idempotency, seed safety ו-schema drift." action={<span id="migration-audit" />}>
          {data.auditItems.length === 0 ? <EmptyState title="אין ממצאי audit" text="הרץ את מיגרציית Phase 162 כדי לטעון את תמונת ה-DB." /> : (
            <div className="procedure-list">
              {data.auditItems.map((item) => (
                <article className="card procedure-card" key={item.id ?? item.item_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                    <h3>{item.title}</h3>
                    <p>{item.finding}</p>
                    <small>{label(item.audit_area)} · affected: {(item.affected_objects ?? []).slice(0, 8).join(", ")}</small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={toneForStatus(item.severity)}>{label(item.severity)}</StatusBadge>
                    {item.fixed_in_phase ? <StatusBadge tone="good">fixed</StatusBadge> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="camera-infra-grid">
          <CleanSection title="RLS Coverage Targets" subtitle="טבלאות רגישות שצריכות RLS ו-policy coverage." action={<span id="rls-audit" />}>
            <div className="camera-infra-list">
              {data.rlsTargets.map((target) => (
                <article className="camera-infra-row" key={target.id ?? target.table_name}>
                  <div>
                    <strong>{target.table_name}</strong>
                    <span>{label(target.expected_scope)} · {target.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(target.current_status)}>{label(target.current_status)}</StatusBadge>
                  <StatusBadge tone={target.sensitivity === "regulated" || target.sensitivity === "medical" ? "bad" : "warn"}>{label(target.sensitivity)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Storage Bucket Security" subtitle="סיווג bucket, private requirement, signed URL ואודיט גישה." action={<span id="storage-audit" />}>
            <div className="camera-infra-list">
              {data.storageBuckets.map((bucket) => (
                <article className="camera-infra-row" key={bucket.id ?? bucket.bucket_id}>
                  <div>
                    <strong>{bucket.bucket_id}</strong>
                    <span>{bucket.bucket_purpose} · {bucket.notes}</span>
                  </div>
                  <StatusBadge tone={bucket.expected_public ? "bad" : "good"}>{bucket.expected_public ? "public" : "private"}</StatusBadge>
                  <StatusBadge tone={toneForStatus(bucket.current_status)}>{label(bucket.current_status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Production Readiness Notes" subtitle="מה עדיין צריך לפני שמכריזים על Supabase production-ready.">
          <div className="grid cols-3">
            <ActionCard icon={ShieldCheck} title="Run live catalog check" text="Verify relrowsecurity, policies and helper signatures directly in Supabase production/staging." href="/dashboard/admin/master-qa" />
            <ActionCard icon={FileWarning} title="Replay migrations safely" text="Run migration replay against a disposable/staging database to catch missing dependencies and enum drift." href="/dashboard/admin/security-pipeline" tone="warn" />
            <ActionCard icon={KeyRound} title="Verify storage access" text="Inventory storage buckets and test signed URL access for medical, ID, signature and evidence files." href="/dashboard/admin/document-center" tone="warn" />
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
