import Link from "next/link";
import { Clock, Eye, FileCheck2, RadioTower, ShieldAlert, ShieldCheck, Video, Waves } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function averageScore(rows: Row[], field = "readiness_score") {
  const values = rows.map((row) => Number(row[field] ?? 0)).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function statusTone(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["ready", "success", "active", "configured", "testing", "passed"].includes(value)) return "good";
  if (["partial", "warning", "planned", "draft", "reviewing", "needs_legal_review"].includes(value)) return "warn";
  if (["blocked", "failed", "disabled", "open"].includes(value)) return "bad";
  return "default";
}

function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "לא עודכן";
}

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = await run() as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

export default async function AdminCameraCompliancePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("camera compliance center", async () => {
    const supabase = await createClient();
    const [
      checks,
      policies,
      gateways,
      sessions,
      audit,
      authChecks,
      alerts,
      cameras
    ] = await Promise.all([
      safeQuery<Row>("camera compliance checks", () => supabase.from("camera_compliance_checks" as any).select("*").order("check_area").order("severity")),
      safeQuery<Row>("parent camera policies", () => supabase.from("parent_camera_policies" as any).select("*, gardens(id,name,city)").order("updated_at", { ascending: false }).limit(80)),
      safeQuery<Row>("camera gateway compliance", () => supabase.from("camera_streaming_gateway_compliance" as any).select("*").order("readiness_score", { ascending: false })),
      safeQuery<Row>("legal camera sessions", () => supabase.from("camera_playback_sessions" as any).select("id,camera_id,kindergarten_id,profile_id,parent_id,child_id,playback_protocol,gateway_provider,watermark_hash,compliance_status,capture_detected,suspicious_score,started_at,created_at,metadata").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("camera access audit trail", () => supabase.from("camera_access_audit_trail" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("camera authorization checks", () => supabase.from("camera_viewing_authorization_checks" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("camera security alerts", () => supabase.from("camera_security_alerts" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery<Row>("camera legal streaming status", () => supabase.from("camera_streams" as any).select("id,name,garden_id,kindergarten_id,status,stream_status,health_status,parent_view_allowed,parent_viewing_allowed,legal_streaming_status,direct_rtsp_exposure_blocked,watermark_required,anti_screenshot_required,max_parent_session_minutes").limit(220))
    ]);
    return { checks, policies, gateways, sessions, audit, authChecks, alerts, cameras };
  }, {
    checks: [] as Row[],
    policies: [] as Row[],
    gateways: [] as Row[],
    sessions: [] as Row[],
    audit: [] as Row[],
    authChecks: [] as Row[],
    alerts: [] as Row[],
    cameras: [] as Row[]
  });

  const data = result.data;
  const byArea = (area: string) => data.checks.filter((check) => check.check_area === area);
  const viewingScore = averageScore([...byArea("parent_access"), ...byArea("viewing_tokens")]);
  const streamingScore = averageScore([...byArea("streaming_gateway"), ...data.gateways]);
  const sessionScore = averageScore([...byArea("session_controls"), ...byArea("watermark")]);
  const antiLeakScore = averageScore(byArea("anti_leak"));
  const auditScore = averageScore(byArea("audit"));
  const overallScore = averageScore([...(data.checks as Row[]), ...(data.gateways as Row[])]);
  const activePolicies = data.policies.filter((policy) => policy.status === "active" && policy.viewing_enabled === true);
  const openAlerts = data.alerts.filter((alert) => ["open", "reviewing"].includes(String(alert.status)));
  const failedAuthChecks = data.authChecks.filter((check) => check.status === "failed");
  const directExposureBlocked = data.cameras.filter((camera) => camera.direct_rtsp_exposure_blocked !== false).length;
  const parentVisibleCameras = data.cameras.filter((camera) => camera.parent_view_allowed === true || camera.parent_viewing_allowed === true);
  const watermarkSessions = data.sessions.filter((session) => session.watermark_hash);

  return (
    <DashboardShell role="admin" title="ציות מצלמות">
      <div className="commercial-dashboard camera-infra-center">
        <PremiumDashboardHero
          eyebrow="Legal Camera Streaming"
          title="מרכז ציות לצפיית הורים במצלמות"
          subtitle="בקרת צפייה חוקית: מדיניות הורים, שערי שידור, טוקנים זמניים, Watermark, חסימת חשיפה ישירה ולוג מלא לכל פעולה."
          badge={`${overallScore}/100`}
          badgeTone={scoreTone(overallScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/cameras">מרכז מצלמות</Link><Link className="button secondary" href="/dashboard/admin/security">אבטחה</Link></>}
        >
          <div className="setup-checklist"><span>אין RTSP ציבורי</span><span>צפייה מתועדת</span><span>בדיקת נוכחות ילד</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="מוכנות צפייה" value={`${viewingScore}/100`} tone={scoreTone(viewingScore)} hint={`${activePolicies.length} מדיניות פעילות`} />
          <RoleMetricCard label="מוכנות שידור" value={`${streamingScore}/100`} tone={scoreTone(streamingScore)} hint={`${data.gateways.length} שערים`} />
          <RoleMetricCard label="ניהול סשן" value={`${sessionScore}/100`} tone={scoreTone(sessionScore)} hint="טוקן, זמן ניתוק וסימון" />
          <RoleMetricCard label="מניעת דליפה" value={`${antiLeakScore}/100`} tone={scoreTone(antiLeakScore)} hint="Watermark ומוכנות Native" />
          <RoleMetricCard label="ביקורת גישה" value={`${auditScore}/100`} tone={scoreTone(auditScore)} hint={`${data.audit.length} רשומות אחרונות`} />
          <RoleMetricCard label="התראות פתוחות" value={openAlerts.length} tone={openAlerts.length ? "bad" : "good"} hint={`${failedAuthChecks.length} חסימות הרשאה`} />
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="מדיניות צפיית הורים" subtitle="צפייה נפתחת רק למדיניות פעילה עם שעות, מצלמות מאושרות, MFA ונוכחות ילד.">
            {data.policies.length === 0 ? <EmptyState title="אין עדיין מדיניות צפייה" text="לפני פתיחת צפיית הורים יש להגדיר מדיניות לכל גן." /> : (
              <div className="camera-infra-list">{data.policies.slice(0, 10).map((policy) => (
                <article className="camera-infra-row" key={policy.id}>
                  <div><strong>{policy.gardens?.name ?? "גן"}</strong><span>{policy.viewing_enabled ? "צפייה מופעלת" : "צפייה כבויה"} · עד {policy.max_session_minutes} דקות · {policy.mfa_required ? "MFA נדרש" : "MFA לא נדרש"}</span></div>
                  <StatusBadge tone={statusTone(policy.status)}>{policy.status}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>

          <CleanSection title="שערי שידור מאובטחים" subtitle="כל השידורים חייבים לעבור דרך שכבת Gateway. אין חשיפה ישירה למצלמות או ל-RTSP.">
            {data.gateways.length === 0 ? <EmptyState title="אין רישום שערי שידור" text="הרצת המיגרציה מוסיפה מוכנות ל-MediaMTX, go2rtc, Janus וספקים עתידיים." /> : (
              <div className="camera-infra-list">{data.gateways.map((gateway) => (
                <article className="camera-infra-row" key={gateway.id}>
                  <div><strong>{gateway.provider}</strong><span>{gateway.gateway_mode} · WebRTC {gateway.supports_webrtc ? "כן" : "בהמשך"} · Watermark {gateway.supports_watermark ? "כן" : "UI"}</span></div>
                  <StatusBadge tone={scoreTone(Number(gateway.readiness_score ?? 0))}>{gateway.readiness_score}/100</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="בדיקות ציות" subtitle="כללי הצפייה, הטוקן, הסשן והביקורת שמחזיקים את שכבת המצלמות תחת שליטה.">
            <div className="camera-infra-list">{data.checks.map((check) => (
              <article className="camera-infra-row" key={check.id}>
                <div><strong>{check.title}</strong><span>{check.evidence_summary}</span></div>
                <StatusBadge tone={statusTone(check.status)}>{check.status}</StatusBadge>
                <StatusBadge tone={scoreTone(Number(check.readiness_score ?? 0))}>{check.readiness_score}/100</StatusBadge>
              </article>
            ))}</div>
          </CleanSection>

          <CleanSection title="גישה, חסימות והתראות" subtitle="רשומות אחרונות של טוקנים, חסימות הרשאה והתראות שימוש חריג.">
            {[...openAlerts, ...failedAuthChecks, ...data.audit].length === 0 ? <EmptyState title="אין אירועי גישה חריגים" text="כל צפייה עתידית תירשם כאן עם מצלמה, משתמש, ילד וסיבה." /> : (
              <div className="camera-infra-list">{[...openAlerts, ...failedAuthChecks, ...data.audit].slice(0, 10).map((item) => (
                <article className="camera-infra-row" key={`${item.id}-${item.created_at}`}>
                  <div><strong>{item.title ?? item.check_type ?? item.action}</strong><span>{item.reason ?? item.evidence_summary ?? item.status ?? "מתועד"} · {dateText(item.created_at)}</span></div>
                  <StatusBadge tone={statusTone(item.severity ?? item.status)}>{item.severity ?? item.status}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> כללי הגנה פעילים</h2>
            <div className="list-item"><div><strong>חסימת חשיפה ישירה</strong><span>{directExposureBlocked} מתוך {data.cameras.length} מצלמות מסומנות כחסומות לחשיפה ישירה</span></div><StatusBadge tone={directExposureBlocked === data.cameras.length ? "good" : "warn"}>RTSP חסום</StatusBadge></div>
            <div className="list-item"><div><strong>צפייה להורים</strong><span>{parentVisibleCameras.length} מצלמות מסומנות כפוטנציאליות לצפיית הורים</span></div><StatusBadge tone={parentVisibleCameras.length ? "warn" : "default"}>דורש מדיניות</StatusBadge></div>
            <div className="list-item"><div><strong>Watermark בסשנים</strong><span>{watermarkSessions.length} סשנים אחרונים נשמרו עם חתימת Watermark</span></div><StatusBadge tone={watermarkSessions.length === data.sessions.length || !data.sessions.length ? "good" : "warn"}>מסומן</StatusBadge></div>
          </article>
          <article className="card action-panel">
            <h2><Clock size={20} /> סשנים אחרונים</h2>
            {data.sessions.length === 0 ? <div className="empty-mini">אין סשני צפייה אחרונים.</div> : data.sessions.slice(0, 8).map((session) => (
              <div className="list-item" key={session.id}>
                <div><strong>{session.playback_protocol ?? "צפייה"}</strong><span>{session.gateway_provider ?? "Gateway"} · {dateText(session.created_at ?? session.started_at)}</span></div>
                <StatusBadge tone={session.capture_detected ? "bad" : statusTone(session.compliance_status)}>{session.capture_detected ? "חשד צילום" : session.compliance_status}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="מצלמות" text="ניהול חיבור והרשאות" href="/dashboard/admin/cameras" icon={Video} />
          <ActionCard title="שרת וידאו" text="Gateway ושידורים" href="/dashboard/admin/video-gateway" icon={RadioTower} />
          <ActionCard title="בדיקת מצלמות" text="חשיפה והרשאות" href="/dashboard/admin/camera-audit" icon={FileCheck2} />
          <ActionCard title="אבטחה" text="MFA וביקורת" href="/dashboard/admin/security" icon={ShieldAlert} />
          <ActionCard title="רגולציה" text="מדיניות ישראל" href="/dashboard/admin/regulatory" icon={Waves} />
          <ActionCard title="תצפיתן" text="אירועים לבדיקה" href="/dashboard/admin/ai-events" icon={Eye} />
        </section>
      </div>
    </DashboardShell>
  );
}
