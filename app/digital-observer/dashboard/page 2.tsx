import Link from "next/link";
import { AlertTriangle, BarChart3, Bell, Camera, CheckCircle2, CreditCard, HeartPulse, PackageCheck, Radar, ShieldCheck, UserRound } from "lucide-react";
import { AppHomeGrid, AppHomeHero, AppHomeShell, AppQuickAction, AppStatusCard } from "@/components/premium-dashboard";
import { RoleAppShell } from "@/components/role-app-shell";
import { requireUser } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { createClient } from "@/lib/supabase/server";
import { DIGITAL_OBSERVER_ADMIN_OVERVIEW, DIGITAL_OBSERVER_SETUP_ACTIONS } from "@/lib/domain/digital-observer-product";

type Row = Record<string, any>;

type QueryResult<T> = {
  data: T[];
  count: number;
  available: boolean;
  issue?: "rls_policy_update_required" | "data_source_unavailable";
};

async function safeQuery<T>(label: string, run: () => any): Promise<QueryResult<T>> {
  try {
    const result = (await run()) as { data: T[] | null; error: any; count?: number | null };
    if (result.error) {
      console.warn("Digital Observer data source unavailable:", label);
      return {
        data: [],
        count: 0,
        available: false,
        issue: result.error.code === "42P17" ? "rls_policy_update_required" : "data_source_unavailable"
      };
    }
    return { data: result.data ?? [], count: result.count ?? result.data?.length ?? 0, available: true };
  } catch (error) {
    console.warn("Digital Observer data source unavailable:", label);
    return { data: [], count: 0, available: false, issue: "data_source_unavailable" };
  }
}

function statusTone(status?: string | null) {
  if (["active", "resolved", "confirmed", "ready", "healthy"].includes(String(status))) return "pill good";
  if (["trial", "needs_review", "reviewing", "pending_payment", "degraded"].includes(String(status))) return "pill warn";
  return "pill";
}

function statusLabel(status?: string | null) {
  if (!status) return "";
  const map: Record<string, string> = {
    active: "פעיל",
    inactive: "לא פעיל",
    resolved: "נסגר",
    confirmed: "מאושר",
    ready: "מוכן",
    healthy: "בריא",
    trial: "נסיון",
    needs_review: "דורש בדיקה",
    reviewing: "בבדיקה",
    pending_payment: "ממתין לתשלום",
    degraded: "מורד איכות",
    pending: "ממתין",
    setup: "בתהליך הגדרה",
    online: "מחובר",
    ready_status: "מוכן",
    camera_offline: "מנותק",
    monitoring_enabled: "מופעל",
    monitoring_waiting: "ממתין",
    "not_checked_yet": "טרם נבדק",
    setup_waiting: "ממתין להגדרה",
  };
  return map[String(status)] ?? String(status);
}

function siteTypeLabel(siteType?: string | null) {
  const map: Record<string, string> = {
    home: "בית",
    office: "משרד",
    business: "עסק",
    warehouse: "מחסן",
    store: "חנות",
    parking_lot: "חניון",
    custom: "אתר מותאם"
  };
  return map[String(siteType)] ?? "אתר";
}

export default async function DigitalObserverOwnerDashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const [ownedSitesRes, membershipsRes, packagesRes] = await Promise.all([
    safeQuery<Row>("observer owned sites", () => supabase.from("observer_sites" as any).select("id, name, site_type, active, monitoring_enabled, observer_subscription_status, camera_limit, event_retention_days, created_at").eq("owner_profile_id", profile.id).neq("site_type", "kindergarten").limit(50)),
    safeQuery<Row>("observer memberships", () => supabase.from("observer_site_memberships" as any).select("observer_site_id, member_role, observer_sites(id, name, site_type, active, monitoring_enabled, observer_subscription_status, camera_limit, event_retention_days, created_at)").eq("profile_id", profile.id).eq("active", true).limit(50)),
    safeQuery<Row>("observer packages", () => supabase.from("observer_monitoring_packages" as any).select("id, name, package_type, camera_limit, monthly_price, annual_price, monitoring_mode, event_retention_days, ai_event_types_enabled").eq("active", true).order("sort_order").limit(20))
  ]);
  const memberSites = membershipsRes.data.map((membership) => membership.observer_sites).filter(Boolean);
  const siteMap = new Map<string, Row>();
  [...ownedSitesRes.data, ...memberSites].forEach((site) => {
    if (site?.id && site.site_type !== "kindergarten") siteMap.set(site.id, site);
  });
  const sites = Array.from(siteMap.values());
  const siteIds = sites.map((site) => site.id).filter(Boolean);

  const [camerasRes, signalsRes, subscriptionsRes, usageRes, billingUsageRes] = siteIds.length
    ? await Promise.all([
        safeQuery<Row>("observer cameras", () => supabase.from("camera_streams" as any).select("id, name, observer_site_id, status, health_status, stream_status, gateway_registration_status, digital_observer_pilot_mode, site_owner_visible, ai_enabled, last_health_check_at, last_seen").in("observer_site_id", siteIds).limit(200)),
        safeQuery<Row>("observer signals", () => supabase.from("observer_intelligence_signals" as any).select("id, observer_site_id, signal_type, severity, review_status, risk_score, recommended_action, created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(80)),
        safeQuery<Row>("observer subscriptions", () => supabase.from("observer_site_subscriptions" as any).select("id, observer_site_id, status, subscription_status, renewal_date, trial_start, trial_end, billing_cycle, monthly_price, annual_price, timezone, package_id").in("observer_site_id", siteIds).limit(80)),
        safeQuery<Row>("observer usage", () => supabase.from("observer_site_usage_snapshots" as any).select("id, observer_site_id, active_cameras, ai_events_count, playback_sessions, alerts_sent, users_invited, failed_camera_checks, period_start, period_end").in("observer_site_id", siteIds).order("period_start", { ascending: false }).limit(80)),
        safeQuery<Row>("observer billing usage", () => supabase.from("observer_usage_tracking" as any).select("id, observer_site_id, active_cameras, ai_events_count, storage_used_mb, monitoring_hours_used, alerts_sent, playback_sessions, users_invited, failed_camera_checks, package_limit_status, period_start, period_end").in("observer_site_id", siteIds).order("period_start", { ascending: false }).limit(80))
      ])
    : [
        { data: [], count: 0, available: true },
        { data: [], count: 0, available: true },
        { data: [], count: 0, available: true },
        { data: [], count: 0, available: true },
        { data: [], count: 0, available: true }
      ];

  const activeSites = sites.filter((site) => site.active).length;
  const cameras = camerasRes.data;
  const signals = signalsRes.data;
  const openSignals = signals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const unhealthyCameras = cameras.filter((camera) => !["online", "active", "ready"].includes(String(camera.status)));
  const subscriptions = subscriptionsRes.data;
  const latestUsage = usageRes.data[0];
  const latestBillingUsage = billingUsageRes.data[0] ?? latestUsage ?? {};
  const activeSubscriptions = subscriptions.filter((item) => ["active", "trial"].includes(String(item.subscription_status ?? item.status))).length;
  const billingIssues = subscriptions.filter((item) => ["pending_payment", "overdue", "expired", "suspended"].includes(String(item.subscription_status ?? item.status))).length;
  const setupProgress = sites.length ? Math.round(((sites.filter((site) => site.monitoring_enabled).length + (cameras.length ? 1 : 0) + (subscriptions.length ? 1 : 0)) / (sites.length + 2)) * 100) : 0;
  const [analyticsRes, leadsRes] = await Promise.all([
    safeQuery<Row>("digital observer analytics readiness", () => supabase.from("digital_observer_analytics_events" as any).select("event_type, count_value, status, source, site_type, package_key").order("occurred_at", { ascending: false }).limit(40)),
    safeQuery<Row>("digital observer leads readiness", () => supabase.from("digital_observer_leads" as any).select("source, status, site_type, package_interest, estimated_cameras").order("created_at", { ascending: false }).limit(40))
  ]);
  const dataSourcesReady = [ownedSitesRes, membershipsRes, packagesRes, analyticsRes, leadsRes].every((result) => result.available);
  const operationalDataReady = dataSourcesReady && [camerasRes, signalsRes, subscriptionsRes, usageRes, billingUsageRes].every((result) => result.available);
  const accessPolicyUpdateRequired = [ownedSitesRes, membershipsRes].some((result) => result.issue === "rls_policy_update_required");
  const displayName = cleanSyntheticLabel(profile.full_name, "בעל האתר");

  return (
    <RoleAppShell
      role="digital-observer"
      activeHref="/digital-observer/dashboard"
      title="Digital Observer"
      subtitle="אתרים, מצלמות ואירועים בבדיקה אנושית"
      profile={profile}
      className="digital-observer-runtime-shell"
    >
      <main className="digital-observer-app digital-observer-dashboard-app dashboard-runtime-content">
        <AppHomeShell className="observer-app-home">
          <AppHomeHero
            eyebrow="Digital Observer App"
            title={`שלום, ${displayName}`}
            subtitle="מסך בית לאתרים, מצלמות והתראות. נתוני Gan Batuach נשארים בנפרד, והחלטות AI דורשות בדיקה אנושית."
            badge={operationalDataReady ? (activeSites ? "פעיל" : "נתוני בדיקה") : "מקור נתונים בהגדרה"}
            badgeTone={operationalDataReady && activeSites ? "good" : "warn"}
            actions={<><Link className="button primary" href="/digital-observer/onboarding">יצירת אתר תצפית</Link><Link className="button secondary" href="/dashboard/security-settings">הגדרות אבטחה</Link></>}
          />

          {!operationalDataReady ? (
            <div className="dashboard-source-notice" role="status">
              <AlertTriangle size={20} />
              <div>
                <strong>{accessPolicyUpdateRequired ? "מדיניות הגישה של Digital Observer דורשת עדכון" : "מקור הנתונים של Digital Observer עדיין לא הוגדר במלואו"}</strong>
                <span>{accessPolicyUpdateRequired ? "לא מוצגים נתונים חלופיים. לאחר החלת עדכון ה-RLS המוכן ב-Supabase, הכרטיסים ייטענו לפי המשתמש והאתר המשויך." : "לא מוצגים נתונים חיים או מספרי דמו חלופיים. לאחר החלת סכמת התצפיתן וחיבור משתמש בדיקה, הכרטיסים יתעדכנו אוטומטית."}</span>
              </div>
            </div>
          ) : null}

          <AppHomeGrid compact>
            <AppStatusCard label="אתרים" value={operationalDataReady ? sites.length : "—"} hint={operationalDataReady ? "אתרי Digital Observer" : "ממתין לחיבור נתונים"} tone={operationalDataReady && sites.length ? "good" : "warn"} href="#sites" />
            <AppStatusCard label="מצלמות" value={operationalDataReady ? cameras.length : "—"} hint={operationalDataReady ? `${unhealthyCameras.length} דורשות בדיקה` : "ממתין לחיבור נתונים"} tone={!operationalDataReady || unhealthyCameras.length ? "warn" : cameras.length ? "good" : "default"} href="#cameras" />
            <AppStatusCard label="התראות פתוחות" value={operationalDataReady ? openSignals.length : "—"} hint={operationalDataReady ? "בדיקה אנושית" : "ממתין לחיבור נתונים"} tone={!operationalDataReady || openSignals.length ? "warn" : "good"} href="#alerts" />
            <AppStatusCard label="חיוב" value={operationalDataReady ? (billingIssues ? "לטיפול" : "תקין") : "—"} hint={operationalDataReady ? `${activeSubscriptions} מנויים פעילים/ניסיון` : "ממתין לחיבור ספק"} tone={!operationalDataReady || billingIssues ? "warn" : "good"} href="/digital-observer/billing" />
            <AppStatusCard label="הגדרה" value={operationalDataReady ? `${setupProgress}%` : "—"} hint={operationalDataReady ? "אתר, מצלמות ומנוי" : "ממתין לחיבור נתונים"} tone={operationalDataReady && setupProgress >= 80 ? "good" : "warn"} href="#setup" />
            <AppStatusCard label="AI החודש" value={operationalDataReady ? (latestBillingUsage.ai_events_count ?? 0) : "—"} hint={operationalDataReady ? "ללא החלטה אוטומטית" : "Shadow אינו מחובר"} tone="default" />
          </AppHomeGrid>

          <section className="app-home-section">
            <div className="app-home-section-head">
              <div><h2>פעולות מהירות</h2><p>התחלה, מצלמות, חיוב ואבטחה בלי לעבור במסכי ניהול ארוכים.</p></div>
            </div>
            <AppHomeGrid>
              <AppQuickAction title="הוספת אתר" text="הקמה מודרכת" href="/digital-observer/onboarding" icon={UserRound} tone="good" />
              <AppQuickAction title="הוספת מצלמות" text="דרך שער מאובטח" href="/digital-observer/onboarding#cameras" icon={Camera} />
              <AppQuickAction title="התראות" text="תור בדיקה אנושית" href="#alerts" icon={Bell} tone={openSignals.length ? "warn" : "default"} />
              <AppQuickAction title="סקירת חיוב" text="חבילות, ניסיון וחשבוניות" href="/digital-observer/billing" icon={CreditCard} tone={billingIssues ? "warn" : "default"} />
            </AppHomeGrid>
          </section>

        <section className="grid cols-2 dashboard-panels" id="setup">
          <article className="card action-panel">
            <div className="section-heading">
              <h2>פעולות הגדרה</h2>
              <p>הקמת Digital Observer מופרדת מזרימת הגדרת גן.</p>
            </div>
            <div className="procedure-list">
              {DIGITAL_OBSERVER_SETUP_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <div className="procedure-card" key={action.title}>
                    <Icon />
                    <div><h3>{action.title}</h3><p>{action.text}</p></div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card action-panel">
            <div className="section-heading">
              <h2>מצב מוכנות</h2>
              <p>מבוסס על נתוני Digital Observer לאתרים עצמיים בלבד.</p>
            </div>
            <div className="setup-checklist">
              <span>{operationalDataReady ? subscriptions.length : "—"} רשומות מנוי</span>
              <span>{operationalDataReady ? unhealthyCameras.length : "—"} מצלמות דורשות בדיקה</span>
              <span>{operationalDataReady ? signals.length : "—"} אותות אחרונים</span>
              <span>{operationalDataReady ? (latestBillingUsage.active_cameras ?? latestUsage?.active_cameras ?? 0) : "—"} מצלמות פעילות החודש</span>
              <span>{operationalDataReady ? (latestBillingUsage.monitoring_hours_used ?? 0) : "—"} שעות ניטור בשימוש</span>
              <span>{operationalDataReady ? (latestBillingUsage.alerts_sent ?? 0) : "—"} התראות שנשלחו</span>
              <span>נדרשת בדיקה אנושית</span>
              <span>אין זרימות הורים/ילדים</span>
            </div>
          </article>
        </section>

        <section className="dashboard-section" id="sites">
          <div className="section-heading">
            <h2>האתרים שלי</h2>
            <p>בתים, עסקים ומתחמים — לא כולל אתרי גן. ניהול הגנים נשאר בדשבורד Gan Batuach.</p>
            <Link className="button secondary" href="/digital-observer/onboarding">הוספת אתר</Link>
          </div>
          {sites.length === 0 ? (
            <div className="empty-state">
              <strong>עדיין אין אתרי Digital Observer</strong>
              <span>צור טיוטת הקמה, חבר מצלמות והפעל בדיקת תקינות.</span>
            </div>
          ) : (
            <div className="procedure-list">
              {sites.map((site) => {
                const siteCameras = cameras.filter((camera) => camera.observer_site_id === site.id);
                const siteSignals = openSignals.filter((signal) => signal.observer_site_id === site.id);
                const subscription = subscriptions.find((item) => item.observer_site_id === site.id);
                return (
                  <article className="card procedure-card" key={site.id}>
                    <div>
                    <span className={statusTone(site.active ? "active" : "inactive")}>{site.active ? "פעיל" : "לא פעיל"}</span>
                    <span className="pill">{siteTypeLabel(site.site_type)}</span>
                    <h3>{cleanSyntheticLabel(site.name, "אתר תצפית")}</h3>
                    <p>{site.monitoring_enabled ? "ניטור פעיל" : "ניטור ממתין להגדרה"} · סטטוס מנוי: {statusLabel(subscription?.subscription_status ?? subscription?.status ?? site.observer_subscription_status) || "ניסיוני"}</p>
                    <Link className="button secondary" href={`/digital-observer/sites/${site.id}`}>כניסה לאתר</Link>
                  </div>
                  <div className="procedure-meta">
                      <span>{siteCameras.length} מצלמות</span>
                      <span>{siteSignals.length} התראות פתוחות</span>
                      <span>{site.event_retention_days ?? 30} ימים שמירה</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid cols-2 dashboard-panels" id="alerts">
          <article className="card action-panel">
            <Radar />
            <h2>אירועים אחרונים</h2>
            {signals.length === 0 ? <p>אין אירועי מצלמה כרגע. האירועים יופיעו אחרי חיבור מצלמות והגדרת מצב shadow.</p> : (
              <div className="procedure-list compact-list">
                {signals.slice(0, 8).map((signal) => (
                  <div className="mini-row" key={signal.id}>
                    <span>{signal.signal_type}</span>
                    <strong><span className={statusTone(signal.review_status)}>{statusLabel(signal.review_status) || signal.review_status}</span></strong>
                    <small>{signal.recommended_action ?? "נדרשת בדיקה אנושית"} · סיכון {signal.risk_score ?? 0}/100</small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="card action-panel" id="billing">
            <PackageCheck />
            <h2>מוכנות חבילה</h2>
            {packagesRes.data.length === 0 ? <p>נתוני חבילות זמינים דרך הגדרות מנהל או בהמתנה.</p> : (
              <div className="procedure-list compact-list">
                {packagesRes.data.slice(0, 6).map((pkg) => (
                  <div className="mini-row" key={pkg.id}>
                    <span>{pkg.name}</span>
                    <strong>{pkg.camera_limit ?? "מותאם"} מצלמות</strong>
                    <small>{pkg.monitoring_mode} · {pkg.event_retention_days} ימים · {pkg.monthly_price ?? 0} ₪</small>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>פעולות מומלצות</h2>
            <p>פעולות Digital Observer מופרדות ממודול הגן ומכספי תשלום ההורים.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            <Link className="premium-action-card" href="/digital-observer/onboarding"><Camera /><strong>הוספת מצלמות</strong><span>הגדר דרך שער מאובטח ללא חשיפת RTSP/אישורי גישה.</span></Link>
            <Link className="premium-action-card" href="/digital-observer/billing"><CreditCard /><strong>סקירת חיוב</strong><span>חבילת שירות, ניסיון, שימוש, חשבוניות ושדרוג.</span></Link>
            <Link className="premium-action-card" href="/digital-observer/onboarding#goals"><Radar /><strong>מטרות ניטור</strong><span>בחירת יעדים לפי מדיניות יכולות.</span></Link>
            <Link className="premium-action-card" href="/dashboard/security-settings"><ShieldCheck /><strong>הגדרות אבטחה</strong><span>שמור את חשבונך והמכשירים מוגנים.</span></Link>
          </div>
        </section>

        <section className="dashboard-section" id="cameras">
          <div className="section-heading">
            <h2>מצלמות</h2>
            <p>תצוגה מהירה לבעל האתר. אבחונים טכניים מתקדמים נשארים בכלים ייעודיים.</p>
          </div>
          {cameras.length === 0 ? (
            <div className="empty-state">
              <strong>טרם חוברו מצלמות</strong>
              <span>הוסף מצלמה דרך תהליך שער מאובטח והפעל בדיקת חיבור.</span>
            </div>
          ) : (
            <div className="grid cols-3 dashboard-panels">
              {cameras.slice(0, 12).map((camera) => (
                <article className="card compact-card" key={camera.id}>
                  <Camera />
                  <span className={statusTone(camera.health_status ?? camera.status)}>{statusLabel(camera.health_status ?? camera.status) || "ממתין"}</span>
                  <h3>{camera.name ?? "מצלמה"}</h3>
                  <p>{camera.gateway_registration_status ?? camera.stream_status ?? "שער ממתין"} · {camera.digital_observer_pilot_mode ? "מצב פיילוט" : "מצב רגיל"}</p>
                  <small>נבדק לאחרונה: {camera.last_health_check_at ? new Date(camera.last_health_check_at).toLocaleString("he-IL") : camera.last_seen ? new Date(camera.last_seen).toLocaleString("he-IL") : "עדיין לא נבדק"}</small>
                  <div className="hero-actions">
                    <Link className="button secondary" href={`/digital-observer/sites/${camera.observer_site_id}`}>צפייה</Link>
                    <Link className="button secondary" href="/digital-observer/onboarding#cameras">בדיקת חיבור</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card compact-card"><CheckCircle2 /><h3>מוכנות AI</h3><p>יעדי הניטור אינם מחליטים על פעולה לבד; נדרש אישור אנושי.</p></article>
          <article className="card compact-card"><AlertTriangle /><h3>יכולות מוגבלות</h3><p>יכולות אודיו, פנים, ביומטריה וביקורות משפטיות נשלטות לפי מדיניות ההיתרים.</p></article>
          <article className="card compact-card"><HeartPulse /><h3>בריאות אתר</h3><p>מצב מצלמות, שער, התראות ומנויים פועלים על תשתית קיימת.</p></article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <BarChart3 />
            <h2>אנליטיקות</h2>
            <div className="procedure-list compact-list">
              {analyticsRes.data.length === 0 ? <p>אירועי אנליטיקה זמינים בהכנה בלבד עד לחיבור ניטור מלא.</p> : analyticsRes.data.map((event) => (
                <div className="mini-row" key={`${event.event_type}-${event.source}-${event.package_key}`}>
                  <span>{event.event_type}</span>
                  <strong>{event.count_value}</strong>
                  <small>{event.source ?? "מקור ממתין"} · {event.site_type ?? "כל האתרים"} · {statusLabel(event.status) || event.status}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card action-panel">
            <UserRound />
            <h2>מעקב פניות</h2>
            <div className="procedure-list compact-list">
              {leadsRes.data.length === 0 ? <p>פניות Digital Observer מופרדות מפניות הגן.</p> : leadsRes.data.map((lead, index) => (
                <div className="mini-row" key={`${lead.source}-${lead.site_type}-${index}`}>
                  <span>{lead.source}</span>
                  <strong><span className={statusTone(lead.status)}>{statusLabel(lead.status) || lead.status}</span></strong>
                  <small>{lead.site_type} · {lead.estimated_cameras} מצלמות · {lead.package_interest ?? "חבילה תוגדר"}</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>סקירת מוצר מנהל</h2>
            <p>מנהלים יכולים להבחין בין גני Gan Batuach לאתרי Digital Observer באותה תשתית.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            {DIGITAL_OBSERVER_ADMIN_OVERVIEW.map((item) => (
              <article className="card compact-card" key={item.label}>
                <ShieldCheck />
                <h3>{item.label}</h3>
                <p>{item.note}</p>
                <span className="pill">{item.source}</span>
              </article>
            ))}
          </div>
        </section>
        </AppHomeShell>
      </main>
    </RoleAppShell>
  );
}
