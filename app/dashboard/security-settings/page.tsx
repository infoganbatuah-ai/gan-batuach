import Link from "next/link";
import { Fingerprint, KeyRound, LockKeyhole, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { PasskeyEnrollmentPrompt } from "@/components/passkey-enrollment-prompt";
import { RoleAppShell } from "@/components/role-app-shell";
import {
  AccountVerificationSummary,
  SettingsLinkList,
  SettingsPlatformHeader,
  SettingsPlatformLayout,
  SettingsPlatformNavigation,
  SettingsSection,
  SettingsStatusCard,
  SettingsStatusGrid
} from "@/components/settings-platform-ui";
import { requireUser } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

function stateLabel(value: unknown) {
  const state = String(value ?? "");
  if (["enrolled", "trusted", "ready"].includes(state)) return "פעיל";
  if (["blocked", "suspicious", "revoked"].includes(state)) return "חסום";
  return state ? "דורש בדיקה" : "לא הוגדר";
}

export default async function UserSecuritySettingsPage() {
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const [mfaRes, passkeysRes, devicesRes, sessionsRes, eventsRes] = await Promise.all([
    supabase.from("mfa_enrollment_status" as never).select("enrollment_status,authenticator_app_enabled,supabase_totp_enrolled,sms_otp_enabled,backup_codes_generated,backup_codes_ready,mfa_grace_until" as never).eq("profile_id", profile.id).maybeSingle(),
    supabase.from("passkey_credentials" as never).select("id,label,device_type,backed_up,created_at,last_used_at" as never).eq("user_id", profile.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("trusted_devices" as never).select("id,device_name,device_label,risk_status,trust_status,last_seen_at" as never).or(`profile_id.eq.${profile.id},user_id.eq.${profile.id}`).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("security_sessions" as never).select("id,role,risk_level,last_seen_at,revoked_at" as never).eq("profile_id", profile.id).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("security_events" as never).select("id,event_type,severity,status,description,created_at" as never).eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(20)
  ]);
  const mfa = mfaRes.data as any;
  const passkeys = (passkeysRes.data ?? []) as any[];
  const devices = (devicesRes.data ?? []) as any[];
  const sessions = (sessionsRes.data ?? []) as any[];
  const events = (eventsRes.data ?? []) as any[];
  const role = isRole(profile.role) ? profile.role : "parent";
  const settingsRole = role === "network_manager" ? "admin" : role;
  const enrolled = mfa?.enrollment_status === "enrolled";
  const activeSessions = sessions.filter((session) => !session.revoked_at);
  const verification = managementContactVerification(user, profile);

  return <RoleAppShell role={role} activeHref={role === "admin" ? "/dashboard/admin/settings" : role === "owner" || role === "manager" ? "/dashboard/garden/settings" : `/dashboard/${role}/settings`} title="אבטחת החשבון" subtitle="MFA, Passkey, מכשירים וסשנים" profile={profile}>
    <SettingsPlatformHeader role={settingsRole} title="אבטחה וכניסה" description="מצב אבטחה אמיתי מהשרת. אסימונים, סודות ופרטי תשתית אינם מוצגים." eyebrow="ACCOUNT SECURITY" />
    <SettingsPlatformLayout navigation={<SettingsPlatformNavigation role={settingsRole} activeHref="/dashboard/security-settings" />}>
      <SettingsStatusGrid>
        <SettingsStatusCard label="MFA" value={enrolled ? "פעיל" : "לא הושלם"} detail={mfa?.mfa_grace_until ? `תקופת חסד עד ${new Date(mfa.mfa_grace_until).toLocaleDateString("he-IL")}` : "לפי מדיניות התפקיד"} icon={ShieldCheck} tone={enrolled ? "green" : "orange"} />
        <SettingsStatusCard label="Passkey" value={passkeys.length ? `${passkeys.length} רשומים` : "לא נרשם"} detail="השרת אינו שומר נתונים ביומטריים" icon={Fingerprint} tone={passkeys.length ? "green" : "blue"} />
        <SettingsStatusCard label="סשנים" value={`${activeSessions.length} פעילים`} detail={`${devices.length} מכשירים מוכרים`} icon={Smartphone} tone="blue" />
      </SettingsStatusGrid>
      <SettingsSection id="verification" title="אימות פרטי קשר" description="דוא״ל מאומת מספיק להפעלה רגילה; טלפון אינו תנאי" icon={ShieldCheck}>
        <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone} phoneVerified={verification.phoneVerified} />
      </SettingsSection>
      <SettingsSection id="mfa-passkey" title="MFA וכניסה מהירה" description="הצגה והפעלה רק כאשר המימוש הקנוני זמין" icon={Fingerprint} action={<Link className="button secondary" href="/forgot-password">שינוי סיסמה מאובטח</Link>}>
        <div className="ux18-security-grid">
          <article><h4>אימות נוסף</h4><dl><div><dt>אפליקציית Authenticator</dt><dd>{mfa?.authenticator_app_enabled || mfa?.supabase_totp_enrolled ? "פעיל" : "לא הוגדר"}</dd></div><div><dt>SMS OTP</dt><dd>{mfa?.sms_otp_enabled ? "פעיל" : "לא פעיל"}</dd></div><div><dt>קודי גיבוי</dt><dd>{mfa?.backup_codes_generated || mfa?.backup_codes_ready ? "מוכנים" : "לא הוגדרו"}</dd></div></dl></article>
          <article><h4>Passkey</h4>{passkeys.length ? <div className="ux18-security-list">{passkeys.map((passkey) => <span key={passkey.id}><Fingerprint /><b>{passkey.label ?? "המכשיר האישי"}</b><small>{passkey.last_used_at ? `שימוש אחרון ${new Date(passkey.last_used_at).toLocaleDateString("he-IL")}` : "טרם נעשה שימוש"}</small></span>)}</div> : <PasskeyEnrollmentPrompt />}</article>
        </div>
      </SettingsSection>
      <SettingsSection id="sessions" title="מכשירים וסשנים" description="תוויות בטוחות ומועד אחרון בלבד; ללא token או כתובת תשתית" icon={Smartphone}>
        <div className="ux18-security-grid">
          <article><h4>מכשירים מוכרים</h4><div className="ux18-security-list">{devices.length ? devices.map((device) => <span key={device.id}><Smartphone /><b>{device.device_name ?? device.device_label ?? "מכשיר"}</b><small>{stateLabel(device.risk_status ?? device.trust_status)} · {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString("he-IL") : "ללא זמן"}</small></span>) : <p>אין מכשירים מוכרים להצגה.</p>}</div></article>
          <article><h4>סשנים</h4><div className="ux18-security-list">{sessions.length ? sessions.map((session) => <span key={session.id}><LockKeyhole /><b>{session.revoked_at ? "מנותק" : "פעיל"}</b><small>{stateLabel(session.risk_level)} · {session.last_seen_at ? new Date(session.last_seen_at).toLocaleString("he-IL") : "ללא זמן"}</small></span>) : <p>אין סשנים נוספים להצגה.</p>}</div></article>
        </div>
      </SettingsSection>
      <SettingsSection id="security-events" title="אירועי אבטחה" description="אירועים קנוניים בלבד" icon={ShieldAlert}>
        {events.length ? <div className="ux18-security-list">{events.map((event) => <span key={event.id}><ShieldAlert /><b>{event.description ?? event.event_type}</b><small>{event.status ?? "לבדיקה"} · {event.created_at ? new Date(event.created_at).toLocaleString("he-IL") : ""}</small></span>)}</div> : <p className="settings-truth-note">אין אירועי אבטחה פתוחים להצגה.</p>}
      </SettingsSection>
      <SettingsSection id="security-actions" title="פעולות חשבון" description="פעולות רגישות עוברות אימות מתאים" icon={KeyRound}>
        <SettingsLinkList items={[{ title: "שינוי סיסמה", detail: "שליחת קישור שחזור מאובטח לדוא״ל", href: "/forgot-password", status: "דורש אימות", icon: KeyRound }]} />
      </SettingsSection>
    </SettingsPlatformLayout>
  </RoleAppShell>;
}
