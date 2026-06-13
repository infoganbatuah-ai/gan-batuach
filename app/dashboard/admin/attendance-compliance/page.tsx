import Link from "next/link";
import { ClipboardCheck, FileSignature, Fingerprint, MapPinned, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function average(rows: Row[], field = "readiness_score") {
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
  if (["ready", "approved", "passed", "completed", "success", "resolved"].includes(value)) return "good";
  if (["partial", "pending", "requires_review", "reviewing", "manual_override", "needs_legal_review"].includes(value)) return "warn";
  if (["blocked", "failed", "rejected", "revoked", "expired", "open"].includes(value)) return "bad";
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

export default async function AdminAttendanceCompliancePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("attendance compliance center", async () => {
    const supabase = await createClient();
    const [checks, scores, adults, authorizations, gps, signatures, audit, exceptions, attendance, pickup] = await Promise.all([
      safeQuery<Row>("attendance compliance checks", () => supabase.from("attendance_compliance_checks" as any).select("*").order("check_area").order("severity")),
      safeQuery<Row>("attendance compliance scores", () => supabase.from("attendance_compliance_scores" as any).select("*, gardens(id,name,city)").order("score_date", { ascending: false }).limit(120)),
      safeQuery<Row>("authorized adults", () => supabase.from("authorized_adults" as any).select("*, gardens(id,name,city), children(id,full_name)").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("pickup authorizations", () => supabase.from("pickup_authorizations" as any).select("*, gardens(id,name,city), children(id,full_name)").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("gps attendance validations", () => supabase.from("gps_attendance_validations" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("attendance digital signatures", () => supabase.from("attendance_digital_signatures" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("attendance audit trail", () => supabase.from("attendance_compliance_audit_trail" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("attendance exceptions", () => supabase.from("attendance_exceptions" as any).select("*, gardens(id,name,city), children(id,full_name)").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("attendance legal fields", () => supabase.from("attendance" as any).select("id,garden_id,child_id,status,attendance_date,gps_validation_status,gps_distance_meters,signature_id,legal_attendance_method,parent_identity_verified,biometric_identification_used,camera_based_attendance_used,created_at").gte("attendance_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).limit(500)),
      safeQuery<Row>("pickup legal fields", () => supabase.from("child_pickup_events" as any).select("id,kindergarten_id,child_id,status,authorization_type,gps_validation_status,gps_distance_meters,signature_id,identity_verification_status,legal_release_status,biometric_identification_used,camera_based_release_used,pickup_time,created_at").gte("pickup_time", new Date(Date.now() - 30 * 86400000).toISOString()).limit(500))
    ]);
    return { checks, scores, adults, authorizations, gps, signatures, audit, exceptions, attendance, pickup };
  }, {
    checks: [] as Row[],
    scores: [] as Row[],
    adults: [] as Row[],
    authorizations: [] as Row[],
    gps: [] as Row[],
    signatures: [] as Row[],
    audit: [] as Row[],
    exceptions: [] as Row[],
    attendance: [] as Row[],
    pickup: [] as Row[]
  });

  const data = result.data;
  const byArea = (area: string) => data.checks.filter((check) => check.check_area === area);
  const adultScore = average(byArea("authorized_adults"));
  const pickupScore = average(byArea("pickup_authorization"));
  const gpsScore = average(byArea("gps_validation"));
  const signatureScore = average(byArea("digital_signature"));
  const auditScore = average([...byArea("audit_trail"), ...byArea("exceptions")]);
  const privacyScore = average([...byArea("privacy"), ...byArea("parent_verification")]);
  const latestScore = data.scores[0]?.attendance_compliance_score;
  const overallScore = Number(latestScore ?? average(data.checks));
  const activeAdults = data.adults.filter((adult) => adult.authorization_status === "approved");
  const activeAuthorizations = data.authorizations.filter((auth) => auth.status === "approved");
  const failedGps = data.gps.filter((row) => row.validation_result === "failed");
  const openExceptions = data.exceptions.filter((row) => ["open", "reviewing"].includes(String(row.status)));
  const biometricUsage = [...data.attendance, ...data.pickup].filter((row) => row.biometric_identification_used || row.camera_based_attendance_used || row.camera_based_release_used);

  return (
    <DashboardShell role="admin" title="ציות נוכחות ואיסוף">
      <div className="commercial-dashboard camera-infra-center">
        <PremiumDashboardHero
          eyebrow="Legal Attendance"
          title="מרכז ציות לנוכחות, זהות הורים ואיסוף ילדים"
          subtitle="מערכת נוכחות רשמית ללא זיהוי פנים: מבוגרים מורשים, GPS, חתימה דיגיטלית, הרשאות איסוף, חריגים ולוג מלא."
          badge={`${overallScore}/100`}
          badgeTone={scoreTone(overallScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/regulatory">רגולציה</Link><Link className="button secondary" href="/dashboard/admin/security">אבטחה</Link></>}
        >
          <div className="setup-checklist"><span>ללא זיהוי פנים</span><span>GPS וחתימה</span><span>איסוף מורשה בלבד</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="מוכנות נוכחות" value={`${overallScore}/100`} tone={scoreTone(overallScore)} hint="ציון ציות כולל" />
          <RoleMetricCard label="מבוגרים מורשים" value={activeAdults.length} tone={activeAdults.length ? "good" : "warn"} hint={`${data.adults.length} ברשומות`} />
          <RoleMetricCard label="הרשאות איסוף" value={activeAuthorizations.length} tone={activeAuthorizations.length ? "good" : "warn"} hint="קבוע/זמני/חד-פעמי" />
          <RoleMetricCard label="GPS" value={`${gpsScore}/100`} tone={scoreTone(gpsScore)} hint={`${failedGps.length} כשלי GPS`} />
          <RoleMetricCard label="חתימות" value={`${signatureScore}/100`} tone={scoreTone(signatureScore)} hint={`${data.signatures.length} חתימות`} />
          <RoleMetricCard label="חריגים פתוחים" value={openExceptions.length} tone={openExceptions.length ? "bad" : "good"} hint="איסוף/נוכחות לבדיקה" />
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="בדיקות מוכנות" subtitle="הבקרות המשפטיות והתפעוליות שמחליפות כל תלות עתידית בזיהוי פנים.">
            <div className="camera-infra-list">{data.checks.map((check) => (
              <article className="camera-infra-row" key={check.id}>
                <div><strong>{check.title}</strong><span>{check.evidence_summary}</span></div>
                <StatusBadge tone={statusTone(check.status)}>{check.status}</StatusBadge>
                <StatusBadge tone={scoreTone(Number(check.readiness_score ?? 0))}>{check.readiness_score}/100</StatusBadge>
              </article>
            ))}</div>
          </CleanSection>

          <CleanSection title="מבוגרים מורשים" subtitle="זהות מבוגר, קרבה, סטטוס אישור ותוקף. אין זיהוי ביומטרי.">
            {data.adults.length === 0 ? <EmptyState title="אין מבוגרים מורשים" text="מורשי איסוף קיימים יועברו למרשם המבוגרים בהרצת המיגרציה." /> : (
              <div className="camera-infra-list">{data.adults.slice(0, 10).map((adult) => (
                <article className="camera-infra-row" key={adult.id}>
                  <div><strong>{adult.full_name}</strong><span>{adult.children?.full_name ?? "ילד"} · {adult.relationship} · {adult.gardens?.name ?? "גן"}</span></div>
                  <StatusBadge tone={statusTone(adult.authorization_status)}>{adult.authorization_status}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="הרשאות איסוף" subtitle="הרשאה קבועה, זמנית, חד-פעמית או חירום עם תוקף ואישור.">
            {data.authorizations.length === 0 ? <EmptyState title="אין הרשאות איסוף" text="המערכת תיצור הרשאות מתוך מורשי האיסוף הקיימים." /> : (
              <div className="camera-infra-list">{data.authorizations.slice(0, 10).map((authorization) => (
                <article className="camera-infra-row" key={authorization.id}>
                  <div><strong>{authorization.children?.full_name ?? "ילד/ה"}</strong><span>{authorization.authorization_type} · {authorization.valid_until ? `עד ${dateText(authorization.valid_until)}` : "ללא תוקף מוגדר"}</span></div>
                  <StatusBadge tone={statusTone(authorization.status)}>{authorization.status}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>

          <CleanSection title="GPS, חתימות וביקורת" subtitle="כל פעולה רגישה נשמרת עם מיקום, חתימה, מכשיר ולוג.">
            <div className="camera-infra-list">
              <article className="camera-infra-row"><div><strong>GPS validation</strong><span>{data.gps.length} בדיקות · {failedGps.length} כשלו</span></div><StatusBadge tone={failedGps.length ? "warn" : "good"}>{gpsScore}/100</StatusBadge></article>
              <article className="camera-infra-row"><div><strong>Digital signatures</strong><span>{data.signatures.length} חתימות אחרונות</span></div><StatusBadge tone={scoreTone(signatureScore)}>{signatureScore}/100</StatusBadge></article>
              <article className="camera-infra-row"><div><strong>Audit trail</strong><span>{data.audit.length} רשומות ביקורת אחרונות</span></div><StatusBadge tone={scoreTone(auditScore)}>{auditScore}/100</StatusBadge></article>
              <article className="camera-infra-row"><div><strong>Privacy boundary</strong><span>{biometricUsage.length ? "נמצא שימוש בעייתי לבדיקה" : "לא נמצא שימוש בזיהוי פנים/מצלמה"}</span></div><StatusBadge tone={biometricUsage.length ? "bad" : "good"}>{privacyScore}/100</StatusBadge></article>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldAlert size={20} /> חריגים פתוחים</h2>
            {openExceptions.length === 0 ? <div className="empty-mini">אין חריגי נוכחות או איסוף פתוחים.</div> : openExceptions.slice(0, 8).map((exception) => (
              <div className="list-item" key={exception.id}>
                <div><strong>{exception.title}</strong><span>{exception.children?.full_name ?? "ילד"} · {exception.gardens?.name ?? "גן"} · {exception.details ?? exception.exception_type}</span></div>
                <StatusBadge tone={statusTone(exception.severity)}>{exception.severity}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><ClipboardCheck size={20} /> ציוני גנים אחרונים</h2>
            {data.scores.length === 0 ? <div className="empty-mini">אין ציוני ציות עדיין.</div> : data.scores.slice(0, 8).map((score) => (
              <div className="list-item" key={score.id}>
                <div><strong>{score.gardens?.name ?? "גן"}</strong><span>GPS {score.gps_validation_rate}% · חתימה {score.signature_completion_rate}% · חריגים {score.exception_rate}%</span></div>
                <StatusBadge tone={scoreTone(Number(score.attendance_compliance_score ?? 0))}>{score.attendance_compliance_score}/100</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="quick-actions-grid">
          <ActionCard title="רגולציה" text="מצב ישראל ופרטיות" href="/dashboard/admin/regulatory" icon={ShieldCheck} />
          <ActionCard title="אבטחה" text="MFA וזהות" href="/dashboard/admin/security" icon={Fingerprint} />
          <ActionCard title="גנים" text="בדיקת גן ספציפי" href="/dashboard/admin/kindergartens" icon={MapPinned} />
          <ActionCard title="פיקוח" text="חריגים ובדיקות" href="/dashboard/admin/national-inspections" icon={FileSignature} />
          <ActionCard title="משימות" text="הסלמות ופעולות" href="/dashboard/tasks" icon={ClipboardCheck} />
          <ActionCard title="משתמשים" text="הורים וצוות" href="/dashboard/admin/users" icon={UserCheck} />
        </section>
      </div>
    </DashboardShell>
  );
}
