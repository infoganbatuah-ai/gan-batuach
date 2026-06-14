import { KeyRound, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function tone(status: string): "good" | "warn" | "bad" {
  if (["enrolled", "trusted", "ready"].includes(status)) return "good";
  if (["blocked", "suspicious", "active"].includes(status)) return "bad";
  return "warn";
}

export default async function UserSecuritySettingsPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const [mfaRes, devicesRes, sessionsRes, eventsRes] = await Promise.all([
    supabase.from("mfa_enrollment_status" as any).select("*").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("trusted_devices" as any).select("*").or(`profile_id.eq.${profile.id},user_id.eq.${profile.id}`).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("security_sessions" as any).select("*").eq("profile_id", profile.id).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("security_events" as any).select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(20)
  ]);
  const mfa = mfaRes.data as any;
  const devices = (devicesRes.data ?? []) as any[];
  const sessions = (sessionsRes.data ?? []) as any[];
  const events = (eventsRes.data ?? []) as any[];
  const role = isRole(profile.role) ? profile.role : "parent";
  const enrolled = mfa?.enrollment_status === "enrolled";

  return (
    <DashboardShell role={role} title="Security Settings">
      <div className="dashboard-hero-card">
        <div>
          <p className="eyebrow">אבטחת חשבון</p>
          <h1>הגדרות אבטחה אישיות.</h1>
          <p>כאן אפשר לראות אימות נוסף, מכשירים מוכרים, סשנים פעילים והתראות אבטחה. פעולות רגישות ידרשו אימות נוסף כדי להגן על מידע ילדים ומשפחה.</p>
        </div>
        <span className={enrolled ? "pill good" : "pill warn"}>{enrolled ? "MFA פעיל" : "נדרש להשלים MFA"}</span>
      </div>

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="MFA status" value={mfa?.enrollment_status ?? "not_enrolled"} tone={tone(mfa?.enrollment_status ?? "partial")} />
        <StatCard label="Trusted devices" value={devices.filter((device) => ["trusted"].includes(String(device.risk_status ?? device.trust_status))).length} tone="good" />
        <StatCard label="Active sessions" value={sessions.filter((session) => !session.revoked_at).length} tone="good" />
        <StatCard label="Security alerts" value={events.filter((event) => ["open", "reviewing"].includes(String(event.status))).length} tone={events.length ? "warn" : "good"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><KeyRound size={20} /> אימות נוסף</h2><p>מגן על צפייה במצלמות, מידע רפואי ומסמכים רגישים.</p></div>
          <div className="risk-list">
            <div>Authenticator <b>{mfa?.authenticator_app_enabled || mfa?.supabase_totp_enrolled ? "פעיל" : "לא הוגדר"}</b></div>
            <div>SMS OTP <b>{mfa?.sms_otp_enabled ? "פעיל" : "מוכן עתידית"}</b></div>
            <div>Backup codes <b>{mfa?.backup_codes_generated || mfa?.backup_codes_ready ? "מוכן" : "לא הוגדר"}</b></div>
            <div>Grace until <b>{mfa?.mfa_grace_until ? new Date(mfa.mfa_grace_until).toLocaleDateString("he-IL") : "-"}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Smartphone size={20} /> מכשירים מוכרים</h2><p>רק מידע טכני בטוח לצורכי אבטחה.</p></div>
          <div className="procedure-list compact-list">
            {devices.map((device) => (
              <div className="mini-row" key={device.id}>
                <span>{device.device_name ?? device.device_label ?? "מכשיר"}</span>
                <strong className={`pill ${tone(device.risk_status ?? device.trust_status)}`}>{device.risk_status ?? device.trust_status}</strong>
                <small>{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString("he-IL") : ""}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><LockKeyhole size={20} /> סשנים</h2><p>מוכנות לניתוק מכשירים ודרישת אימות מחדש.</p></div>
          <div className="procedure-list compact-list">
            {sessions.map((session) => (
              <div className="mini-row" key={session.id}>
                <span>{session.role ?? role}</span>
                <strong className={`pill ${tone(session.risk_level)}`}>{session.risk_level}</strong>
                <small>{session.revoked_at ? "נותק" : "פעיל"} · {session.last_seen_at ? new Date(session.last_seen_at).toLocaleString("he-IL") : ""}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><ShieldCheck size={20} /> התראות אבטחה</h2><p>כניסות ממכשיר חדש, MFA שנכשל, נעילות חשבון ופעולות חשודות.</p></div>
        {events.length === 0 ? <div className="empty-state"><strong>אין התראות אבטחה</strong><span>אם תזוהה פעילות חריגה, היא תופיע כאן.</span></div> : <div className="procedure-list">
          {events.map((event) => (
            <article className="card procedure-card" key={event.id}>
              <div><span className={`pill ${tone(event.severity)}`}>{event.severity}</span><h3>{event.event_type}</h3><p>{event.description ?? "אירוע אבטחה"}</p><small>{event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small></div>
            </article>
          ))}
        </div>}
      </section>
    </DashboardShell>
  );
}
