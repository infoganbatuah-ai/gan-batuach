import { AlertTriangle, KeyRound, LockKeyhole, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

function severityTone(value: string): "good" | "warn" | "bad" {
  if (["critical", "high", "active", "blocked", "suspicious"].includes(value)) return "bad";
  if (["medium", "new", "partial", "grace_period"].includes(value)) return "warn";
  return "good";
}

export default async function AdminIdentitySecurityPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("identity security", async () => {
    const supabase = await createClient();
    async function safeQuery<T>(index: number, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const query = await run();
        logSupabaseError(`identity security query ${index}`, query.error);
        return { data: query.error ? [] as T[] : query.data ?? [], available: !query.error };
      } catch (error) {
        logSupabaseError(`identity security query ${index}`, error);
        return { data: [] as T[], available: false };
      }
    }
    const [profilesRes, mfaRes, policiesRes, devicesRes, sessionsRes, locksRes, recoveryRes, securityEventsRes, actionRulesRes] = await Promise.all([
      safeQuery(0, () => supabase.from("profiles" as any).select("id,full_name,email,phone,role,garden_id,created_at").in("role", ["admin", "owner", "manager", "parent", "staff", "inspector", "network_manager"]).limit(5000)),
      safeQuery(1, () => supabase.from("mfa_enrollment_status" as any).select("*").order("role").limit(5000)),
      safeQuery(2, () => supabase.from("mfa_enforcement_policies" as any).select("*").order("role_key").limit(100)),
      safeQuery(3, () => supabase.from("trusted_devices" as any).select("*").order("last_seen_at", { ascending: false }).limit(500)),
      safeQuery(4, () => supabase.from("security_sessions" as any).select("*").order("last_seen_at", { ascending: false }).limit(500)),
      safeQuery(5, () => supabase.from("account_security_locks" as any).select("*").order("locked_at", { ascending: false }).limit(200)),
      safeQuery(6, () => supabase.from("identity_recovery_requests" as any).select("*").order("created_at", { ascending: false }).limit(200)),
      safeQuery(7, () => supabase.from("security_events" as any).select("*").order("created_at", { ascending: false }).limit(300)),
      safeQuery(8, () => supabase.from("sensitive_action_mfa_rules" as any).select("*").order("action_category").limit(120))
    ]);
    const available = [profilesRes, mfaRes, policiesRes, devicesRes, sessionsRes, locksRes, recoveryRes, securityEventsRes, actionRulesRes].map((query) => query.available);
    return {
      profiles: profilesRes.data ?? [],
      mfa: mfaRes.data ?? [],
      policies: policiesRes.data ?? [],
      devices: devicesRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      locks: locksRes.data ?? [],
      recovery: recoveryRes.data ?? [],
      securityEvents: securityEventsRes.data ?? [],
      actionRules: actionRulesRes.data ?? [],
      available,
      queryError: available.some((value) => !value)
        ? "חלק מנתוני אבטחת הזהות אינם זמינים. אין להסיק מכך שמצב האבטחה תקין."
        : null
    };
  }, { profiles: [] as any[], mfa: [] as any[], policies: [] as any[], devices: [] as any[], sessions: [] as any[], locks: [] as any[], recovery: [] as any[], securityEvents: [] as any[], actionRules: [] as any[], available: Array<boolean>(9).fill(false), queryError: null as string | null });

  const known = (...indices: number[]) => indices.every((index) => result.data.available[index]);
  const unavailable = "לא זמין";

  const profileCount = result.data.profiles.length;
  const enrolled = result.data.mfa.filter((item: any) => item.enrollment_status === "enrolled").length;
  const required = result.data.mfa.filter((item: any) => item.mfa_required === true || ["required", "enforced", "grace_period"].includes(String(item.enforcement_status))).length;
  const missing = Math.max(0, required - enrolled);
  const enrollmentRate = percent(enrolled, Math.max(profileCount, required));
  const suspiciousDevices = result.data.devices.filter((device: any) => ["suspicious", "blocked"].includes(String(device.risk_status ?? device.trust_status))).length;
  const activeLocks = result.data.locks.filter((lock: any) => lock.lock_status === "active").length;
  const failedLoginEvents = result.data.securityEvents.filter((event: any) => ["failed_login", "mfa_failed", "mfa_challenge_failure"].includes(String(event.event_type))).length;
  const suspiciousSessions = result.data.sessions.filter((session: any) => ["high", "critical"].includes(String(session.risk_level)) || session.sensitive_action_reauth_required).length;
  const securityScore = Math.round((enrollmentRate + (suspiciousDevices ? 45 : 90) + (activeLocks ? 55 : 95) + (failedLoginEvents ? 60 : 95) + (result.data.policies.length ? 85 : 25)) / 5);
  const mfaByRole = ["admin", "owner", "manager", "inspector", "staff", "parent", "network_manager"].map((role) => {
    const profiles = result.data.profiles.filter((profile: any) => profile.role === role).length;
    const rows = result.data.mfa.filter((item: any) => item.role === role);
    const roleEnrolled = rows.filter((item: any) => item.enrollment_status === "enrolled").length;
    return { role, profiles, enrolled: roleEnrolled, rate: percent(roleEnrolled, Math.max(profiles, rows.length)) };
  });

  return (
    <DashboardShell role="admin" title="Identity Security">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Authentication Hardening</p>
          <h1>מרכז אבטחת זהות ו-MFA.</h1>
          <p>ניהול הדרגתי של אימות נוסף, מכשירים מוכרים, סשנים, נעילות חשבון ופעולות רגישות בלי לנעול משתמשים קיימים.</p>
        </div>
        <div className="profile-actions">
          <span className={`pill ${known(0, 1, 2, 3, 5, 7) ? scoreTone(securityScore) : "default"}`}>{known(0, 1, 2, 3, 5, 7) ? `${securityScore}/100` : unavailable}</span>
          <span className="pill warn">Rollout gradual · כוונת מדיניות</span>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <p className="muted">תצוגת מטא־נתונים ודרישות בלבד; אינה הוכחה לאכיפת MFA, לתקינות אבטחה או להפעלת שחזור והתראות.</p>

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="MFA enrollment" value={known(0, 1) ? `${enrollmentRate}%` : unavailable} tone={known(0, 1) ? scoreTone(enrollmentRate) : "default"} />
        <StatCard label="Users missing MFA" value={known(1) ? missing : unavailable} tone={known(1) ? missing ? "warn" : "good" : "default"} />
        <StatCard label="Trusted devices" value={known(3) ? result.data.devices.length : unavailable} tone={known(3) ? "good" : "default"} />
        <StatCard label="Suspicious devices" value={known(3) ? suspiciousDevices : unavailable} tone={known(3) ? suspiciousDevices ? "bad" : "good" : "default"} />
        <StatCard label="Active sessions" value={known(4) ? result.data.sessions.filter((session: any) => !session.revoked_at).length : unavailable} tone={known(4) ? "good" : "default"} />
        <StatCard label="Suspicious sessions" value={known(4) ? suspiciousSessions : unavailable} tone={known(4) ? suspiciousSessions ? "bad" : "good" : "default"} />
        <StatCard label="Failed login trends" value={known(7) ? failedLoginEvents : unavailable} tone={known(7) ? failedLoginEvents ? "warn" : "good" : "default"} />
        <StatCard label="Account lockouts" value={known(5) ? activeLocks : unavailable} tone={known(5) ? activeLocks ? "bad" : "good" : "default"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><KeyRound size={20} /> MFA Rollout</h2><p>מדיניות לפי תפקיד.</p></div>
          <div className="procedure-list compact-list">
            {!known(2) && <p>{unavailable}</p>}
            {result.data.policies.map((policy: any) => (
              <div className="mini-row" key={policy.id ?? policy.role_key}>
                <span>{policy.role_key}</span>
                <strong className={`pill ${severityTone(policy.enforcement_status)}`}>{policy.enforcement_status}</strong>
                <small>{policy.grace_period_days} ימי חסד · {policy.required_for_sensitive_actions ? "פעולות רגישות" : "אופציונלי"}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><UserCheck size={20} /> Users Without MFA</h2><p>לפי תפקיד.</p></div>
          <div className="procedure-list compact-list">
            {mfaByRole.map((item) => (
              <div className="mini-row" key={item.role}>
                <span>{item.role}</span>
                <strong className={`pill ${known(0, 1) ? scoreTone(item.rate) : "default"}`}>{known(0, 1) ? `${item.rate}%` : unavailable}</strong>
                <small>{known(1) ? item.enrolled : unavailable}/{known(0) ? item.profiles : unavailable} enrolled</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Smartphone size={20} /> Trusted Devices</h2><p>מכשירים מוכרים וחשודים.</p></div>
          <div className="risk-list">
            <div>חדשים <b>{known(3) ? result.data.devices.filter((device: any) => ["new"].includes(String(device.risk_status ?? device.trust_status))).length : unavailable}</b></div>
            <div>מוכרים <b>{known(3) ? result.data.devices.filter((device: any) => ["trusted"].includes(String(device.risk_status ?? device.trust_status))).length : unavailable}</b></div>
            <div>נשללו <b>{known(3) ? result.data.devices.filter((device: any) => ["revoked"].includes(String(device.risk_status ?? device.trust_status))).length : unavailable}</b></div>
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><LockKeyhole size={20} /> Sensitive Action Gates</h2><p>פעולות שדורשות אימות נוסף טרי.</p></div>
          <div className="procedure-list compact-list">
            {!known(8) && <p>{unavailable}</p>}
            {result.data.actionRules.map((rule: any) => (
              <div className="mini-row" key={rule.id ?? rule.action_key}>
                <span>{rule.title_he}</span>
                <strong className={`pill ${severityTone(rule.enforcement_status)}`}>{rule.enforcement_status}</strong>
                <small>{rule.fresh_challenge_minutes} דקות · {(rule.required_roles ?? []).join(", ")}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> Security Events</h2><p>אירועי זהות אחרונים.</p></div>
          <div className="procedure-list compact-list">
            {!known(7) && <p>{unavailable}</p>}
            {result.data.securityEvents.slice(0, 10).map((event: any) => (
              <div className="mini-row" key={event.id}>
                <span>{event.event_type}</span>
                <strong className={`pill ${severityTone(event.severity)}`}>{event.severity}</strong>
                <small>{event.status} · {event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><ShieldCheck size={20} /> Recovery & Lockouts</h2><p>נעילות זמניות ושחזור גישה בפיקוח אדמין.</p></div>
        <div className="grid cols-3">
          <article className="card compact-card"><span className={known(5) ? activeLocks ? "pill bad" : "pill good" : "pill default"}>Locks</span><h3>{known(5) ? activeLocks : unavailable} חשבונות נעולים</h3><p>דרישה: נעילה זמנית בלבד, עם אפשרות שחזור אדמין.</p></article>
          <article className="card compact-card"><span className={known(6) ? "pill warn" : "pill default"}>Recovery</span><h3>{known(6) ? result.data.recovery.length : unavailable} בקשות שחזור</h3><p>דרישה: פעולות שחזור רגישות דורשות אימות אדמין.</p></article>
          <article className="card compact-card"><span className="pill default">Templates</span><h3>כוונת תבניות הודעה</h3><p>MFA נדרש, מכשיר חדש, נעילת חשבון ושחזור גישה.</p></article>
        </div>
      </section>
    </DashboardShell>
  );
}
