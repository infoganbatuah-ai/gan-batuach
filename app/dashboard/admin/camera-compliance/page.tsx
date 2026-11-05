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
    return { data: result.error ? [] : result.data ?? [], available: !result.error };
  } catch (error) {
    logSupabaseError(label, error);
    return { data: [] as T[], available: false };
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
    return {
      checks: checks.data, policies: policies.data, gateways: gateways.data, sessions: sessions.data,
      audit: audit.data, authChecks: authChecks.data, alerts: alerts.data, cameras: cameras.data,
      availability: [checks, policies, gateways, sessions, audit, authChecks, alerts, cameras].map((source) => source.available)
    };
  }, {
    checks: [] as Row[],
    policies: [] as Row[],
    gateways: [] as Row[],
    sessions: [] as Row[],
    audit: [] as Row[],
    authChecks: [] as Row[],
    alerts: [] as Row[],
    cameras: [] as Row[],
    availability: Array<boolean>(8).fill(false)
  });

  const data = result.data;
  const available = data.availability;
  const unavailable = "לא זמין";
  const queryError = result.error ?? (available.some((value) => !value) ? "לא ניתן לטעון חלק מהנתונים כרגע" : null);
  const aggregateAvailable = available[0] && available[2];
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
          subtitle="נתוני מוכנות ורישום של מדיניות, שערי שידור, טוקנים, Watermark וביקורת. אינם הוכחת ציות משפטי, חסימת חשיפה או אכיפה פעילה בפועל."
          badge={aggregateAvailable ? `${overallScore}/100` : unavailable}
          badgeTone={aggregateAvailable ? scoreTone(overallScore) : "default"}
          actions={<><Link className="button primary" href="/dashboard/admin/cameras">מרכז מצלמות</Link><Link className="button secondary" href="/dashboard/admin/security">אבטחה</Link></>}
        >
          <div className="setup-checklist"><span>דרישה: ללא RTSP ציבורי</span><span>דרישה: תיעוד צפייה</span><span>דרישה: בדיקת נוכחות ילד</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={queryError} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="מוכנות צפייה" value={available[0] ? `${viewingScore}/100` : unavailable} tone={available[0] ? scoreTone(viewingScore) : "default"} hint={available[1] ? `${activePolicies.length} מדיניות פעילות` : unavailable} />
          <RoleMetricCard label="מוכנות שידור" value={aggregateAvailable ? `${streamingScore}/100` : unavailable} tone={aggregateAvailable ? scoreTone(streamingScore) : "default"} hint={available[2] ? `${data.gateways.length} שערים` : unavailable} />
          <RoleMetricCard label="ניהול סשן" value={available[0] ? `${sessionScore}/100` : unavailable} tone={available[0] ? scoreTone(sessionScore) : "default"} hint="דרישות: טוקן, זמן ניתוק וסימון" />
          <RoleMetricCard label="מניעת דליפה" value={available[0] ? `${antiLeakScore}/100` : unavailable} tone={available[0] ? scoreTone(antiLeakScore) : "default"} hint="דרישות: Watermark ומוכנות Native" />
          <RoleMetricCard label="ביקורת גישה" value={available[0] ? `${auditScore}/100` : unavailable} tone={available[0] ? scoreTone(auditScore) : "default"} hint={available[4] ? `${data.audit.length} רשומות אחרונות` : unavailable} />
          <RoleMetricCard label="התראות פתוחות" value={available[6] ? openAlerts.length : unavailable} tone={available[6] ? openAlerts.length ? "bad" : "good" : "default"} hint={available[5] ? `${failedAuthChecks.length} חסימות הרשאה` : unavailable} />
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="מדיניות צפיית הורים" subtitle="צפייה נפתחת רק למדיניות פעילה עם שעות, מצלמות מאושרות, MFA ונוכחות ילד.">
            {!available[1] ? <EmptyState title="נתוני המדיניות לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : data.policies.length === 0 ? <EmptyState title="אין עדיין מדיניות צפייה" text="לפני פתיחת צפיית הורים יש להגדיר מדיניות לכל גן." /> : (
              <div className="camera-infra-list">{data.policies.slice(0, 10).map((policy) => (
                <article className="camera-infra-row" key={policy.id}>
                  <div><strong>{policy.gardens?.name ?? "גן"}</strong><span>{policy.viewing_enabled ? "צפייה מופעלת" : "צפייה כבויה"} · עד {policy.max_session_minutes} דקות · {policy.mfa_required ? "MFA נדרש" : "MFA לא נדרש"}</span></div>
                  <StatusBadge tone={statusTone(policy.status)}>{policy.status}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>

          <CleanSection title="שערי שידור מאובטחים" subtitle="כל השידורים חייבים לעבור דרך שכבת Gateway. אין חשיפה ישירה למצלמות או ל-RTSP.">
            {!available[2] ? <EmptyState title="נתוני שערי השידור לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : data.gateways.length === 0 ? <EmptyState title="אין רישום שערי שידור" text="הרצת המיגרציה מוסיפה מוכנות ל-MediaMTX, go2rtc, Janus וספקים עתידיים." /> : (
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
            {!available[0] ? <EmptyState title="נתוני בדיקות הציות לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : <div className="camera-infra-list">{data.checks.map((check) => (
              <article className="camera-infra-row" key={check.id}>
                <div><strong>{check.title}</strong><span>{check.evidence_summary}</span></div>
                <StatusBadge tone={statusTone(check.status)}>{check.status}</StatusBadge>
                <StatusBadge tone={scoreTone(Number(check.readiness_score ?? 0))}>{check.readiness_score}/100</StatusBadge>
              </article>
            ))}</div>}
          </CleanSection>

          <CleanSection title="גישה, חסימות והתראות" subtitle="רשומות אחרונות של טוקנים, חסימות הרשאה והתראות שימוש חריג.">
            {!available[6] && <EmptyState title="התראות: לא זמין" text="לא ניתן לטעון את הנתונים כרגע." />}
            {!available[5] && <EmptyState title="בדיקות הרשאה: לא זמין" text="לא ניתן לטעון את הנתונים כרגע." />}
            {!available[4] && <EmptyState title="ביקורת גישה: לא זמין" text="לא ניתן לטעון את הנתונים כרגע." />}
            {available[4] && available[5] && available[6] && [...openAlerts, ...failedAuthChecks, ...data.audit].length === 0 ? <EmptyState title="אין אירועי גישה חריגים" text="כל צפייה עתידית תירשם כאן עם מצלמה, משתמש, ילד וסיבה." /> : (
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
            <h2><ShieldCheck size={20} /> אינדיקציות הגנה מתועדות</h2>
            <p>נתוני רישום בלבד; אינם הוכחת חסימה או אכיפה בפועל.</p>
            <div className="list-item"><div><strong>חסימת חשיפה ישירה</strong><span>{available[7] ? `${directExposureBlocked} מתוך ${data.cameras.length} מצלמות מסומנות כחסומות לחשיפה ישירה` : unavailable}</span></div><StatusBadge tone={available[7] ? directExposureBlocked === data.cameras.length ? "good" : "warn" : "default"}>{available[7] ? "רישום חסימת RTSP" : unavailable}</StatusBadge></div>
            <div className="list-item"><div><strong>צפייה להורים</strong><span>{available[7] ? `${parentVisibleCameras.length} מצלמות מסומנות כפוטנציאליות לצפיית הורים` : unavailable}</span></div><StatusBadge tone={available[7] ? parentVisibleCameras.length ? "warn" : "default" : "default"}>{available[7] ? "דורש מדיניות" : unavailable}</StatusBadge></div>
            <div className="list-item"><div><strong>Watermark בסשנים</strong><span>{available[3] ? `${watermarkSessions.length} סשנים אחרונים ברישום כוללים חתימת Watermark` : unavailable}</span></div><StatusBadge tone={available[3] ? watermarkSessions.length === data.sessions.length || !data.sessions.length ? "good" : "warn" : "default"}>{available[3] ? "סימון מתועד" : unavailable}</StatusBadge></div>
          </article>
          <article className="card action-panel">
            <h2><Clock size={20} /> סשנים אחרונים</h2>
            {!available[3] ? <EmptyState title="נתוני הסשנים לא זמינים" text="לא ניתן לטעון את הנתונים כרגע." /> : data.sessions.length === 0 ? <div className="empty-mini">אין סשני צפייה אחרונים.</div> : data.sessions.slice(0, 8).map((session) => (
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
