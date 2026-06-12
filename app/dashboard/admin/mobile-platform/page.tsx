import Link from "next/link";
import {
  Bell,
  Camera,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  ShieldCheck,
  Smartphone,
  Store,
  TabletSmartphone,
  WifiOff,
  Wrench
} from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { getPushProductionReadiness } from "@/lib/domain/push-provider";

export const dynamic = "force-dynamic";

type MobileData = {
  apps: any[];
  checks: any[];
  deepLinks: any[];
  securityPolicies: any[];
  offlineCapabilities: any[];
  crashReports: any[];
  analytics: any[];
  devices: any[];
  pushLogs: any[];
  pushProviders: any[];
  pushTemplates: any[];
};

const emptyData: MobileData = {
  apps: [],
  checks: [],
  deepLinks: [],
  securityPolicies: [],
  offlineCapabilities: [],
  crashReports: [],
  analytics: [],
  devices: [],
  pushLogs: [],
  pushProviders: [],
  pushTemplates: []
};

const statusLabels: Record<string, string> = {
  not_ready: "לא מוכן",
  in_progress: "בתהליך",
  ready_for_internal_test: "בדיקה פנימית",
  ready_for_store_review: "מוכן לחנות",
  approved: "אושר",
  released: "פורסם",
  blocked: "חסום",
  ready: "מוכן",
  prepared: "מוכן לתשתית",
  pending: "ממתין",
  needs_review: "דורש בדיקה",
  draft: "טיוטה",
  submitted: "נשלח",
  active: "פעיל",
  failed: "נכשל",
  new: "חדש",
  resolved: "טופל",
  queued_mock: "בדיקה",
  sent_mock: "נשלח בבדיקה",
  opened: "נפתח",
  delivered: "נמסר"
};

const platformLabels: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  web_pwa: "Web App",
  all: "כל הפלטפורמות"
};

function toneFor(status?: string | null) {
  if (["ready", "ready_for_internal_test", "ready_for_store_review", "approved", "released", "active", "resolved", "delivered", "opened", "sent_mock"].includes(String(status))) return "good" as const;
  if (["blocked", "failed", "not_ready"].includes(String(status))) return "bad" as const;
  if (["in_progress", "prepared", "pending", "needs_review", "draft", "submitted", "queued_mock"].includes(String(status))) return "warn" as const;
  return "default" as const;
}

function averageScore(rows: any[], fallback = 0) {
  const values = rows.map((row) => Number(row.readiness_score ?? 0)).filter((value) => Number.isFinite(value));
  if (!values.length) return fallback;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default async function AdminMobilePlatformPage() {
  await requireRole(["admin"]);
  const pushReadiness = getPushProductionReadiness();
  const result = await safeAdminData("mobile platform", async () => {
    const supabase = await createClient();
    const [
      appsRes,
      checksRes,
      linksRes,
      securityRes,
      offlineRes,
      crashesRes,
      analyticsRes,
      devicesRes,
      logsRes,
      providersRes,
      templatesRes
    ] = await Promise.all([
      supabase.from("mobile_app_readiness" as any).select("*").order("platform"),
      supabase.from("mobile_platform_checks" as any).select("*").order("category").order("platform"),
      supabase.from("mobile_deep_links" as any).select("*").order("target_role").order("link_type"),
      supabase.from("mobile_security_policies" as any).select("*").order("role_key"),
      supabase.from("mobile_offline_capabilities" as any).select("*").order("role_key").order("workflow"),
      supabase.from("mobile_crash_reports" as any).select("*").order("occurred_at", { ascending: false }).limit(80),
      supabase.from("mobile_analytics_snapshots" as any).select("*").order("snapshot_date", { ascending: false }).limit(30),
      supabase.from("push_device_tokens" as any).select("*").order("last_seen_at", { ascending: false }).limit(300),
      supabase.from("push_notification_logs" as any).select("*").order("created_at", { ascending: false }).limit(180),
      supabase.from("push_provider_configs" as any).select("*").order("provider"),
      supabase.from("push_templates" as any).select("*").order("category")
    ]);

    [appsRes, checksRes, linksRes, securityRes, offlineRes, crashesRes, analyticsRes, devicesRes, logsRes, providersRes, templatesRes]
      .forEach((query, index) => logSupabaseError(`mobile platform query ${index}`, (query as any).error));

    return {
      apps: (appsRes.data ?? []) as any[],
      checks: (checksRes.data ?? []) as any[],
      deepLinks: (linksRes.data ?? []) as any[],
      securityPolicies: (securityRes.data ?? []) as any[],
      offlineCapabilities: (offlineRes.data ?? []) as any[],
      crashReports: (crashesRes.data ?? []) as any[],
      analytics: (analyticsRes.data ?? []) as any[],
      devices: (devicesRes.data ?? []) as any[],
      pushLogs: (logsRes.data ?? []) as any[],
      pushProviders: (providersRes.data ?? []) as any[],
      pushTemplates: (templatesRes.data ?? []) as any[]
    };
  }, emptyData);

  const data = result.data;
  const mobileReadiness = averageScore(data.apps, averageScore(data.checks, 0));
  const requiredChecks = data.checks.filter((check) => check.required_for_release);
  const readyRequired = requiredChecks.filter((check) => ["ready", "prepared"].includes(String(check.status))).length;
  const activeDevices = data.devices.filter((device) => device.is_active).length;
  const iosDevices = data.devices.filter((device) => device.platform === "ios" && device.is_active).length;
  const androidDevices = data.devices.filter((device) => device.platform === "android" && device.is_active).length;
  const webDevices = data.devices.filter((device) => device.platform === "web" && device.is_active).length;
  const pushOpened = data.pushLogs.filter((log) => log.status === "opened" || log.opened_at).length;
  const pushFailures = data.pushLogs.filter((log) => ["failed", "dead_letter", "no_active_device"].includes(String(log.status))).length;
  const crashCritical = data.crashReports.filter((report) => ["high", "critical"].includes(String(report.severity)) && report.status !== "resolved").length;
  const storeReady = data.apps.filter((app) => ["ready", "submitted", "approved"].includes(String(app.store_listing_status))).length;
  const deepLinkReady = data.deepLinks.filter((link) => link.status === "ready").length;
  const offlineReady = data.offlineCapabilities.filter((item) => ["ready", "prepared"].includes(String(item.status))).length;

  return (
    <DashboardShell role="admin" title="אפליקציות מובייל">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Mobile Platform"
          title="מוכנות iOS, Android, Push וחנויות"
          subtitle="מרכז אחד למוכנות אפליקציות, התראות, קישורים עמוקים, אבטחת מכשירים, אופליין, מצלמות וקריסות."
          badge={`${mobileReadiness}/100`}
          badgeTone={mobileReadiness >= 80 ? "good" : mobileReadiness >= 60 ? "warn" : "bad"}
          actions={<Link className="button secondary" href="/dashboard/admin/push-production"><Bell size={16} /> מרכז Push</Link>}
        >
          <div className="setup-checklist">
            <span>Real Push כבוי עד אישור</span>
            <span>אין סודות במכשיר</span>
            <span>Deep Links עוברים הרשאות</span>
          </div>
        </PremiumDashboardHero>

        <AdminDataError message={result.error} />

        <section className="grid cols-5 dashboard-kpis">
          <RoleMetricCard label="מוכנות מובייל" value={`${mobileReadiness}/100`} hint={`${readyRequired}/${requiredChecks.length || 0} בדיקות חובה מוכנות`} tone={mobileReadiness >= 80 ? "good" : "warn"} />
          <RoleMetricCard label="מכשירים פעילים" value={activeDevices} hint={`iOS ${iosDevices} · Android ${androidDevices} · Web ${webDevices}`} tone={activeDevices ? "good" : "warn"} />
          <RoleMetricCard label="Push readiness" value={pushReadiness.configured ? "מוגדר" : "בדיקה"} hint={pushReadiness.realSendEnabled ? "שליחה אמיתית פעילה" : "Mock / dry-run"} tone={pushReadiness.realSendEnabled ? "good" : "warn"} />
          <RoleMetricCard label="Deep Links" value={deepLinkReady} hint={`${data.deepLinks.length} קישורים רשומים`} tone={deepLinkReady ? "good" : "warn"} />
          <RoleMetricCard label="קריסות פתוחות" value={crashCritical} hint="High / Critical" tone={crashCritical ? "bad" : "good"} />
        </section>

        <section className="grid cols-4 action-grid">
          <ActionCard title="iOS" text="iPhone, iPad, APNs ו-App Store" href="/dashboard/admin/mobile-platform#apps" icon={Smartphone} tone="good" />
          <ActionCard title="Android" text="טלפונים, טאבלטים, FCM ו-Google Play" href="/dashboard/admin/mobile-platform#apps" icon={TabletSmartphone} />
          <ActionCard title="Push" text="קטגוריות, מכשירים והעדפות" href="/dashboard/admin/push-production" icon={Bell} />
          <ActionCard title="אבטחה" text="MFA, ביומטריה וניהול מכשיר" href="/dashboard/admin/mobile-platform#security" icon={ShieldCheck} />
        </section>

        <section className="grid cols-3 dashboard-panels" id="apps">
          {data.apps.length ? data.apps.map((app) => (
            <CleanSection title={platformLabels[app.platform] ?? app.platform} subtitle={app.notes ?? "מוכנות אפליקציה"} key={app.id}>
              <div className="risk-list">
                <div>ציון מוכנות <b>{app.readiness_score}/100</b></div>
                <div>Store listing <b>{statusLabels[app.store_listing_status] ?? app.store_listing_status}</b></div>
                <div>Privacy <b>{statusLabels[app.privacy_disclosure_status] ?? app.privacy_disclosure_status}</b></div>
                <div>Permissions <b>{statusLabels[app.permissions_status] ?? app.permissions_status}</b></div>
                <div>Identifier <b>{app.bundle_identifier ?? app.package_identifier ?? "לא נדרש"}</b></div>
              </div>
              <StatusBadge tone={toneFor(app.status)}>{statusLabels[app.status] ?? app.status}</StatusBadge>
            </CleanSection>
          )) : <EmptyState title="אין נתוני מוכנות אפליקציה" text="לאחר הרצת המיגרציה יופיעו iOS, Android ו-Web App." />}
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="בדיקות שחרור" subtitle="מה חייב להיות מוכן לפני App Store / Google Play.">
            {data.checks.length ? (
              <div className="stack-list">
                {data.checks.map((check) => (
                  <article className="list-item" key={check.id}>
                    <div>
                      <strong>{check.title}</strong>
                      <span>{platformLabels[check.platform] ?? check.platform} · {check.category}</span>
                      <small>{check.notes ?? "אין הערה"}</small>
                    </div>
                    <StatusBadge tone={toneFor(check.status)}>{statusLabels[check.status] ?? check.status}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין בדיקות מובייל" text="בדיקות Push, אבטחה, אופליין וחנויות יופיעו כאן." />
            )}
          </CleanSection>

          <CleanSection title="Push והתראות" subtitle="FCM, APNs, Web Push והעדפות לפי קטגוריה.">
            <div className="risk-list">
              <div><Bell /> תבניות <b>{data.pushTemplates.length}</b></div>
              <div><Smartphone /> מכשירים פעילים <b>{activeDevices}</b></div>
              <div><CheckCircle2 /> פתיחות Push <b>{pushOpened}</b></div>
              <div><Wrench /> כשלונות <b>{pushFailures}</b></div>
              <div><ShieldCheck /> Real Send <b>{pushReadiness.realSendEnabled ? "פעיל" : "כבוי בכוונה"}</b></div>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels" id="security">
          <CleanSection title="אבטחת מובייל" subtitle="מדיניות לפי תפקיד.">
            <div className="stack-list">
              {data.securityPolicies.map((policy) => (
                <article className="list-item" key={policy.id}>
                  <div>
                    <strong>{policy.role_key}</strong>
                    <span>MFA: {policy.mfa_required ? "נדרש" : "לא חובה"} · ביומטריה: {policy.biometric_unlock_allowed ? "מותר" : "כבוי"}</span>
                    <small>Session {policy.session_timeout_minutes} דקות · מכשיר מאומת: {policy.device_validation_required ? "כן" : "לא"}</small>
                  </div>
                  <StatusBadge tone={toneFor(policy.status)}>{statusLabels[policy.status] ?? policy.status}</StatusBadge>
                </article>
              ))}
              {!data.securityPolicies.length ? <EmptyState title="אין מדיניות מובייל" text="מדיניות MFA, ביומטריה וסשן תופיע אחרי המיגרציה." /> : null}
            </div>
          </CleanSection>

          <CleanSection title="אופליין וסנכרון" subtitle="עבודה בשטח גם בלי חיבור יציב.">
            <div className="risk-list">
              <div><WifiOff /> יכולות אופליין <b>{offlineReady}/{data.offlineCapabilities.length}</b></div>
              <div>צוות <b>{data.offlineCapabilities.filter((item) => item.role_key === "staff").length}</b></div>
              <div>מפקח <b>{data.offlineCapabilities.filter((item) => item.role_key === "inspector").length}</b></div>
              <div>מנהלת <b>{data.offlineCapabilities.filter((item) => item.role_key === "manager").length}</b></div>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Deep Links" subtitle="התראה פותחת מסך מדויק, אבל ההרשאות עדיין נבדקות בשרת.">
            <div className="stack-list">
              {data.deepLinks.slice(0, 12).map((link) => (
                <article className="list-item" key={link.id}>
                  <div>
                    <strong>{link.link_key}</strong>
                    <span>{link.link_type} · {link.target_role}</span>
                    <small>{link.web_route}</small>
                  </div>
                  <StatusBadge tone={toneFor(link.status)}>{statusLabels[link.status] ?? link.status}</StatusBadge>
                </article>
              ))}
              {!data.deepLinks.length ? <EmptyState title="אין Deep Links" text="קישורי התראות, מסמכים, מצלמות ותשלומים יופיעו כאן." /> : null}
            </div>
          </CleanSection>

          <CleanSection title="מצלמות במובייל" subtitle="צפייה מאובטחת, סימון מים והרשאות.">
            <div className="risk-list">
              <div><Camera /> Token צפייה קצר <b>קיים</b></div>
              <div><ShieldCheck /> בדיקת הרשאה <b>חובה</b></div>
              <div><Fingerprint /> Watermark <b>מוכן למדיניות</b></div>
              <div><ExternalLink /> Replay חופשי <b>חסום</b></div>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Store Readiness" subtitle="App Store ו-Google Play לפני הגשה.">
            <div className="risk-list">
              <div><Store /> אפליקציות מוכנות לחנות <b>{storeReady}/{data.apps.length}</b></div>
              <div>Privacy labels <b>{data.apps.filter((app) => ["ready", "submitted", "approved"].includes(String(app.privacy_disclosure_status))).length}</b></div>
              <div>Permissions text <b>{data.apps.filter((app) => ["ready", "submitted", "approved"].includes(String(app.permissions_status))).length}</b></div>
              <div>Screenshots <b>{data.apps.filter((app) => ["ready", "submitted", "approved"].includes(String(app.screenshots_status))).length}</b></div>
            </div>
          </CleanSection>

          <CleanSection title="Crash & Analytics" subtitle="מודל מוכן. SDK חיצוני עדיין לא מחובר.">
            <div className="risk-list">
              <div>Crash reports <b>{data.crashReports.length}</b></div>
              <div>High/Critical פתוחים <b>{crashCritical}</b></div>
              <div>Analytics snapshots <b>{data.analytics.length}</b></div>
              <div>Push open rate <b>{data.analytics[0]?.push_open_rate ?? percent(pushOpened, data.pushLogs.length)}%</b></div>
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-4 action-grid">
          <ActionCard title="Push Production" text="ספקים, טוקנים ולוגים" href="/dashboard/admin/push-production" icon={Bell} />
          <ActionCard title="אינטגרציות" text="FCM, APNs ו-Web Push" href="/dashboard/admin/integrations" icon={Wrench} />
          <ActionCard title="בדיקת מובייל" text="חוויית 360/390/414" href="/dashboard/admin/mobile-audit" icon={TabletSmartphone} />
          <ActionCard title="המשכיות" text="אופליין והתאוששות" href="/dashboard/admin/business-continuity" icon={WifiOff} />
        </section>
      </div>
    </DashboardShell>
  );
}
