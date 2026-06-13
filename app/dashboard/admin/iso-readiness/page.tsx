import Link from "next/link";
import { AlertTriangle, Archive, ClipboardCheck, Cloud, Database, FileCheck2, LockKeyhole, Scale, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildIsoReadinessSummary } from "@/lib/domain/iso-readiness";

function toneForScore(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function toneForStatus(status: string): "good" | "warn" | "bad" | "default" {
  if (["implemented", "approved", "ready", "closed", "verified", "completed", "collected"].includes(status)) return "good";
  if (["partial", "draft", "mitigating", "in_progress", "needs_review"].includes(status)) return "warn";
  if (["blocked", "missing", "expired", "open", "critical", "high"].includes(status)) return "bad";
  return "default";
}

function standardLabel(value: string) {
  if (value === "iso_27001") return "ISO 27001";
  if (value === "iso_27017") return "ISO 27017";
  if (value === "iso_27701") return "ISO 27701";
  return value;
}

export default async function AdminIsoReadinessPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("iso readiness", async () => {
    const supabase = await createClient();
    const [controlsRes, assetsRes, risksRes, auditsRes, permitAlertsRes, policiesRes, securityChecksRes] = await Promise.all([
      supabase.from("iso_controls" as any).select("*").order("standard").order("control_id"),
      supabase.from("asset_inventory" as any).select("*").order("asset_type"),
      supabase.from("risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }),
      supabase.from("internal_audits" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("permit_expiry_alerts" as any).select("*").neq("status", "resolved").order("expires_at"),
      supabase.from("security_policies_repository" as any).select("*").order("policy_type"),
      supabase.from("security_readiness_checks" as any).select("*").in("category", ["iso_27001", "iso_27017", "iso_27701", "rls", "audit_logging", "encryption"]).order("severity")
    ]);
    [controlsRes, assetsRes, risksRes, auditsRes, permitAlertsRes, policiesRes, securityChecksRes].forEach((query, index) => logSupabaseError(`iso readiness query ${index}`, (query as any).error));
    const summary = buildIsoReadinessSummary({
      controls: controlsRes.data ?? [],
      assets: assetsRes.data ?? [],
      risks: risksRes.data ?? [],
      audits: auditsRes.data ?? [],
      permitAlerts: permitAlertsRes.data ?? []
    });
    return {
      controls: controlsRes.data ?? [],
      assets: assetsRes.data ?? [],
      risks: risksRes.data ?? [],
      audits: auditsRes.data ?? [],
      permitAlerts: permitAlertsRes.data ?? [],
      policies: policiesRes.data ?? [],
      securityChecks: securityChecksRes.data ?? [],
      summary,
      queryError: [controlsRes.error, assetsRes.error, risksRes.error, auditsRes.error, permitAlertsRes.error].some(Boolean)
        ? "חלק מנתוני ISO לא נטענו. ייתכן שמיגרציית PHASE 150 עדיין לא הורצה."
        : null
    };
  }, {
    controls: [] as any[],
    assets: [] as any[],
    risks: [] as any[],
    audits: [] as any[],
    permitAlerts: [] as any[],
    policies: [] as any[],
    securityChecks: [] as any[],
    summary: buildIsoReadinessSummary(),
    queryError: null as string | null
  });

  const { summary } = result.data;
  const openRisks = result.data.risks.filter((risk: any) => !["verified", "accepted_risk", "closed"].includes(String(risk.remediation_status)));
  const missingEvidence = result.data.controls.filter((control: any) => ["missing", "expired", "partial"].includes(String(control.evidence_status)));
  const cloudAssets = result.data.assets.filter((asset: any) => ["Vercel", "Supabase", "GitHub"].includes(String(asset.provider)));

  return (
    <DashboardShell role="admin" title="ISO Readiness">
      <PremiumDashboardHero
        eyebrow="ISO Certification Readiness"
        title="מרכז מוכנות ISO 27001, 27017 ו-27701"
        subtitle="בקרות, ראיות, נכסי ענן, סיכונים, ביקורות פנימיות ואישורי חובה לגני ילדים בישראל."
        badge={`${summary.isoReadinessScore}/100`}
        badgeTone={toneForScore(summary.isoReadinessScore)}
        actions={<Link className="button secondary" href="/api/admin/iso-readiness">API readiness</Link>}
      >
        <div className="mini-stack">
          <span>Controls {summary.counts.controls}</span>
          <span>Assets {summary.counts.assets}</span>
          <span>Open gaps {summary.openGaps.length}</span>
        </div>
      </PremiumDashboardHero>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="ISO 27001" value={`${summary.iso27001}%`} hint="Security controls" tone={toneForScore(summary.iso27001)} />
        <RoleMetricCard label="ISO 27017" value={`${summary.iso27017}%`} hint="Cloud controls" tone={toneForScore(summary.iso27017)} />
        <RoleMetricCard label="ISO 27701" value={`${summary.iso27701}%`} hint="Privacy controls" tone={toneForScore(summary.iso27701)} />
        <RoleMetricCard label="Open risks" value={openRisks.length} hint="Risk register" tone={openRisks.some((risk: any) => risk.severity === "critical" || risk.severity === "high") ? "bad" : openRisks.length ? "warn" : "good"} />
      </section>

      <CleanSection title="פערים פתוחים" subtitle="מחושב דינמית מתוך בקרות, ראיות, מדיניות וסיכונים.">
        {summary.openGaps.length === 0 ? <EmptyState title="אין פערים פתוחים" text="כאשר בקרת ISO או סיכון יהיו חסרים, הם יופיעו כאן." /> : (
          <div className="procedure-list compact-list">
            {summary.openGaps.map((gap) => (
              <div className="mini-row" key={gap.key}>
                <span>{gap.title}</span>
                <strong className={`pill ${toneForStatus(gap.severity)}`}>{gap.severity}</strong>
                <small>{standardLabel(gap.standard)} · {gap.recommendation}</small>
              </div>
            ))}
          </div>
        )}
      </CleanSection>

      <section className="grid cols-2 dashboard-panels">
        <CleanSection title="בקרות ISO" subtitle="סטטוס יישום, ראיות ומדיניות לכל תקן.">
          <div className="procedure-list compact-list">
            {result.data.controls.map((control: any) => (
              <div className="mini-row" key={control.id}>
                <span>{control.control_id} · {control.title}</span>
                <strong><StatusBadge tone={toneForStatus(control.implementation_status)}>{control.implementation_status}</StatusBadge></strong>
                <small>{standardLabel(control.standard)} · Evidence {control.evidence_status} · Policy {control.policy_status}</small>
              </div>
            ))}
          </div>
        </CleanSection>
        <CleanSection title="נכסי ענן ומידע" subtitle="Supabase, Vercel, GitHub, מצלמות ו-AI pipelines.">
          <div className="procedure-list compact-list">
            {result.data.assets.map((asset: any) => (
              <div className="mini-row" key={asset.id}>
                <span>{asset.asset_name}</span>
                <strong><StatusBadge tone={toneForStatus(asset.security_status)}>{asset.security_status}</StatusBadge></strong>
                <small>{asset.provider} · {asset.asset_type} · {asset.data_classification}</small>
              </div>
            ))}
          </div>
        </CleanSection>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <CleanSection title="Risk register" subtitle="סיכונים פתוחים לתיקון לפני הסמכה.">
          {openRisks.length === 0 ? <EmptyState title="אין סיכונים פתוחים" /> : (
            <div className="procedure-list compact-list">
              {openRisks.slice(0, 8).map((risk: any) => (
                <div className="mini-row" key={risk.id}>
                  <span>{risk.risk_description}</span>
                  <strong className={`pill ${toneForStatus(risk.severity)}`}>{risk.severity}</strong>
                  <small>{risk.risk_domain} · {risk.mitigation_strategy}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
        <CleanSection title="ביקורות פנימיות" subtitle="ממצאים, corrective actions וסגירה.">
          <div className="procedure-list compact-list">
            {result.data.audits.map((audit: any) => (
              <div className="mini-row" key={audit.id}>
                <span>{audit.audit_scope}</span>
                <strong><StatusBadge tone={toneForStatus(audit.closure_status)}>{audit.closure_status}</StatusBadge></strong>
                <small>{standardLabel(audit.standard)} · {audit.audit_status}</small>
              </div>
            ))}
          </div>
        </CleanSection>
        <CleanSection title="אישורי חובה בישראל" subtitle="התראות 6 חודשים לפני תוקף.">
          {result.data.permitAlerts.length === 0 ? <EmptyState title="אין אישורים קרובים לפקיעה" text="סריקת cron תוסיף התראות כאשר תוקף מתקרב." /> : (
            <div className="procedure-list compact-list">
              {result.data.permitAlerts.slice(0, 8).map((alert: any) => (
                <div className="mini-row" key={alert.id}>
                  <span>{alert.permit_label}</span>
                  <strong><StatusBadge tone={alert.alert_level === "expired" ? "bad" : "warn"}>{alert.alert_level}</StatusBadge></strong>
                  <small>{alert.expires_at ? new Date(alert.expires_at).toLocaleDateString("he-IL") : ""}</small>
                </div>
              ))}
            </div>
          )}
        </CleanSection>
      </section>

      <CleanSection title="מנגנוני ראיות הנדסיים" subtitle="הקישור בין דשבורד ISO לבין שכבות האבטחה בפועל.">
        <div className="premium-action-grid">
          <ActionCard title="RLS tenant isolation" text="JWT garden_id / room_uuid + can_access_garden" href="/dashboard/admin/security" icon={LockKeyhole} />
          <ActionCard title="Cloud assets" text={`${cloudAssets.length} נכסי Vercel/Supabase/GitHub`} href="/dashboard/admin/system-health" icon={Cloud} />
          <ActionCard title="Immutable audit" text="UPDATE/DELETE חסומים ב-trigger" href="/dashboard/admin/audit-logs" icon={Archive} />
          <ActionCard title="AI privacy" text="Skeleton-only, no face, no audio" href="/dashboard/admin/ai-governance" icon={ShieldCheck} />
          <ActionCard title="Camera compliance" text="WebRTC/token/watermark readiness" href="/dashboard/admin/camera-compliance" icon={Database} />
          <ActionCard title="Legal regulatory" text="Israel mode and policy matrix" href="/dashboard/admin/regulatory" icon={Scale} />
        </div>
      </CleanSection>

      <section className="grid cols-2 dashboard-panels">
        <CleanSection title="Security checks" subtitle="בדיקות שמזינות readiness בפועל.">
          <div className="procedure-list compact-list">
            {result.data.securityChecks.map((check: any) => (
              <div className="mini-row" key={check.id}>
                <span>{check.title}</span>
                <strong><StatusBadge tone={toneForStatus(check.status)}>{check.status}</StatusBadge></strong>
                <small>{check.category} · {check.recommended_action}</small>
              </div>
            ))}
          </div>
        </CleanSection>
        <CleanSection title="Evidence focus" subtitle="הפריטים הקריטיים לאיסוף לפני audit.">
          <div className="procedure-list compact-list">
            <div className="mini-row"><span>Missing/partial evidence</span><strong>{missingEvidence.length}</strong><small>בקרות שדורשות קובץ, בדיקה או אישור פורמלי</small></div>
            <div className="mini-row"><span>Approved policies</span><strong>{result.data.policies.filter((policy: any) => policy.status === "approved").length}</strong><small>מתוך {result.data.policies.length} מדיניות קיימות</small></div>
            <div className="mini-row"><span>Open internal audits</span><strong>{result.data.audits.filter((audit: any) => audit.closure_status !== "closed").length}</strong><small>נדרש closure לפני audit חיצוני</small></div>
            <div className="mini-row"><span>High cloud risks</span><strong>{openRisks.filter((risk: any) => risk.severity === "critical" || risk.severity === "high").length}</strong><small>צריכים בעלות ומועד סגירה</small></div>
          </div>
        </CleanSection>
      </section>
    </DashboardShell>
  );
}
