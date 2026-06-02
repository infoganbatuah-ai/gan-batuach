"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Gauge, PackageCheck, Save, ShieldCheck } from "lucide-react";

type ObserverPackage = {
  id: string;
  name: string;
  package_key?: string | null;
  description?: string | null;
  package_type: string;
  camera_limit?: number | null;
  monitoring_mode: string;
  monitoring_hours?: Record<string, unknown>;
  event_retention_days: number;
  recording_retention_days: number;
  ai_event_types_enabled?: string[] | unknown;
  feature_flags?: Record<string, boolean>;
  sms_alerts_enabled: boolean;
  whatsapp_alerts_enabled: boolean;
  human_review_required: boolean;
  monthly_price: number;
  annual_price: number;
  active: boolean;
};

type ObserverSite = {
  id: string;
  name: string;
  site_type: string;
  active?: boolean;
};

type ObserverSubscription = {
  id: string;
  status: string;
  renewal_date?: string | null;
  observer_sites?: { name?: string | null; site_type?: string | null } | null;
  observer_monitoring_packages?: { name?: string | null; package_type?: string | null } | null;
};

type UsageSnapshot = {
  id: string;
  period_start: string;
  period_end: string;
  active_cameras: number;
  ai_events_count: number;
  monitoring_hours_used: number;
  sms_alerts_sent: number;
  whatsapp_alerts_sent: number;
  playback_sessions: number;
  observer_sites?: { name?: string | null; site_type?: string | null } | null;
};

function parseJson(value: string, fallback: Record<string, unknown>) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return fallback;
  }
}

function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function siteTypeLabel(type?: string | null) {
  return ({
    kindergarten: "גן בטוח - כלול",
    home: "בית",
    office: "משרד",
    business: "עסק",
    warehouse: "מחסן",
    store: "חנות",
    parking_lot: "חניה",
    custom: "מותאם"
  } as Record<string, string>)[type ?? ""] ?? "מותאם";
}

export function ObserverPackagesAdmin({
  packages,
  sites,
  subscriptions,
  usage
}: {
  packages: ObserverPackage[];
  sites: ObserverSite[];
  subscriptions: ObserverSubscription[];
  usage: UsageSnapshot[];
}) {
  const router = useRouter();
  const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id ?? "");
  const [selectedSiteId, setSelectedSiteId] = useState(sites.find((site) => site.site_type !== "kindergarten")?.id ?? sites[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedPackage = packages.find((item) => item.id === selectedPackageId);
  const standaloneSites = sites.filter((site) => site.site_type !== "kindergarten");
  const packageStats = useMemo(() => ({
    active: packages.filter((item) => item.active).length,
    homes: packages.filter((item) => item.package_type === "home").length,
    businesses: packages.filter((item) => item.package_type === "business").length,
    enterprise: packages.filter((item) => item.package_type === "enterprise").length
  }), [packages]);

  async function post(payload: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch("/api/admin/observer-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "הפעולה נכשלה");
      return;
    }
    setMessage("הפעולה נשמרה בהצלחה");
    router.refresh();
  }

  function savePackage(formData: FormData) {
    startTransition(() => {
      void post({
        action: "save_package",
        id: formData.get("id") || undefined,
        name: formData.get("name"),
        package_key: formData.get("package_key"),
        description: formData.get("description"),
        package_type: formData.get("package_type"),
        camera_limit: formData.get("camera_limit") || null,
        monitoring_mode: formData.get("monitoring_mode"),
        monitoring_hours: parseJson(String(formData.get("monitoring_hours") ?? "{}"), {}),
        event_retention_days: formData.get("event_retention_days"),
        recording_retention_days: formData.get("recording_retention_days"),
        ai_event_types_enabled: parseList(String(formData.get("ai_event_types_enabled") ?? "")),
        feature_flags: parseJson(String(formData.get("feature_flags") ?? "{}"), {}),
        sms_alerts_enabled: formData.get("sms_alerts_enabled") === "on",
        whatsapp_alerts_enabled: formData.get("whatsapp_alerts_enabled") === "on",
        human_review_required: true,
        monthly_price: formData.get("monthly_price"),
        annual_price: formData.get("annual_price"),
        active: formData.get("active") === "on",
        sort_order: formData.get("sort_order") || 100
      });
    });
  }

  function assignPackage(formData: FormData) {
    startTransition(() => {
      void post({
        action: "assign_package",
        observer_site_id: formData.get("observer_site_id"),
        package_id: formData.get("package_id"),
        status: formData.get("status"),
        trial_start: formData.get("trial_start") || null,
        trial_end: formData.get("trial_end") || null,
        renewal_date: formData.get("renewal_date") || null,
        monitoring_schedule: parseJson(String(formData.get("monitoring_schedule") ?? "{}"), {}),
        timezone: formData.get("timezone") || "Asia/Jerusalem",
        active_days: parseList(String(formData.get("active_days") ?? "")),
        active_hours: parseJson(String(formData.get("active_hours") ?? "{}"), {}),
        override_limits: parseJson(String(formData.get("override_limits") ?? "{}"), {})
      });
    });
  }

  function snapshotUsage() {
    if (!selectedSiteId) return;
    startTransition(() => {
      void post({ action: "snapshot_usage", observer_site_id: selectedSiteId });
    });
  }

  return (
    <div className="stack">
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><PackageCheck /><strong>{packages.length}</strong><span>חבילות</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{packageStats.active}</strong><span>פעילות</span></article>
        <article className="metric-card"><Bot /><strong>{standaloneSites.length}</strong><span>Standalone sites</span></article>
        <article className="metric-card"><Gauge /><strong>{usage.length}</strong><span>Usage snapshots</span></article>
      </section>

      {message ? <div className={message.includes("נכשלה") || message.includes("לא ") ? "notice warning" : "notice success"}>{message}</div> : null}

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading">
            <h2>חבילת Digital Observer</h2>
            <p>Standalone future product בלבד. בגני ילדים התצפיתן הדיגיטלי כלול במנוי גן בטוח.</p>
          </div>
          <label className="form-field">
            <span>עריכת חבילה קיימת</span>
            <select value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)}>
              <option value="">חבילה חדשה</option>
              {packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <form key={selectedPackage?.id ?? "new-package"} action={savePackage} className="form-grid compact-form">
            <input type="hidden" name="id" value={selectedPackage?.id ?? ""} />
            <label className="form-field"><span>שם חבילה</span><input name="name" defaultValue={selectedPackage?.name ?? ""} required /></label>
            <label className="form-field"><span>Package key</span><input name="package_key" defaultValue={selectedPackage?.package_key ?? ""} placeholder="home_basic" required /></label>
            <label className="form-field"><span>סוג</span><select name="package_type" defaultValue={selectedPackage?.package_type ?? "home"}><option value="home">Home</option><option value="business">Business</option><option value="enterprise">Enterprise</option><option value="custom">Custom</option></select></label>
            <label className="form-field"><span>מגבלת מצלמות</span><input name="camera_limit" type="number" min="0" defaultValue={selectedPackage?.camera_limit ?? ""} /></label>
            <label className="form-field"><span>מצב ניטור</span><select name="monitoring_mode" defaultValue={selectedPackage?.monitoring_mode ?? "event_only"}><option value="always_on">24/7</option><option value="custom_schedule">Custom schedule</option><option value="night_only">Night only</option><option value="business_hours">Business hours</option><option value="event_only">Event only</option></select></label>
            <label className="form-field"><span>Retention אירועים</span><input name="event_retention_days" type="number" min="1" defaultValue={selectedPackage?.event_retention_days ?? 30} /></label>
            <label className="form-field"><span>Retention הקלטות</span><input name="recording_retention_days" type="number" min="0" defaultValue={selectedPackage?.recording_retention_days ?? 0} /></label>
            <label className="form-field"><span>מחיר חודשי</span><input name="monthly_price" type="number" min="0" defaultValue={selectedPackage?.monthly_price ?? 0} /></label>
            <label className="form-field"><span>מחיר שנתי</span><input name="annual_price" type="number" min="0" defaultValue={selectedPackage?.annual_price ?? 0} /></label>
            <label className="form-field full"><span>תיאור</span><textarea name="description" defaultValue={selectedPackage?.description ?? ""} rows={2} /></label>
            <label className="form-field full"><span>AI event types</span><textarea name="ai_event_types_enabled" defaultValue={Array.isArray(selectedPackage?.ai_event_types_enabled) ? selectedPackage?.ai_event_types_enabled.join(", ") : ""} rows={2} /></label>
            <label className="form-field full"><span>Monitoring hours JSON</span><textarea name="monitoring_hours" defaultValue={JSON.stringify(selectedPackage?.monitoring_hours ?? {}, null, 2)} rows={3} /></label>
            <label className="form-field full"><span>Feature flags JSON</span><textarea name="feature_flags" defaultValue={JSON.stringify(selectedPackage?.feature_flags ?? {}, null, 2)} rows={3} /></label>
            <label className="check-row"><input name="sms_alerts_enabled" type="checkbox" defaultChecked={selectedPackage?.sms_alerts_enabled ?? false} /> SMS alerts</label>
            <label className="check-row"><input name="whatsapp_alerts_enabled" type="checkbox" defaultChecked={selectedPackage?.whatsapp_alerts_enabled ?? false} /> WhatsApp alerts</label>
            <label className="check-row"><input name="active" type="checkbox" defaultChecked={selectedPackage?.active ?? true} /> פעילה</label>
            <input type="hidden" name="sort_order" value="100" />
            <button className="button primary full" type="submit" disabled={isPending}><Save size={18} /> שמירת חבילה</button>
          </form>
        </article>

        <article className="card action-panel">
          <div className="section-heading">
            <h2>שיוך לאתר standalone</h2>
            <p>אתרי גן ילדים חסומים לשיוך חבילת standalone כדי לא לפגוע במנוי גן בטוח.</p>
          </div>
          <form action={assignPackage} className="form-grid compact-form">
            <label className="form-field full"><span>אתר</span><select name="observer_site_id" value={selectedSiteId} onChange={(event) => setSelectedSiteId(event.target.value)} required>{sites.map((site) => <option key={site.id} value={site.id}>{site.name} · {siteTypeLabel(site.site_type)}</option>)}</select></label>
            <label className="form-field"><span>חבילה</span><select name="package_id" required>{packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="form-field"><span>סטטוס</span><select name="status" defaultValue="trial"><option value="trial">trial</option><option value="active">active</option><option value="pending_payment">pending_payment</option><option value="expired">expired</option><option value="suspended">suspended</option><option value="cancelled">cancelled</option></select></label>
            <label className="form-field"><span>Trial start</span><input name="trial_start" type="datetime-local" /></label>
            <label className="form-field"><span>Trial end</span><input name="trial_end" type="datetime-local" /></label>
            <label className="form-field"><span>Renewal date</span><input name="renewal_date" type="date" /></label>
            <label className="form-field"><span>Timezone</span><input name="timezone" defaultValue="Asia/Jerusalem" /></label>
            <label className="form-field full"><span>Active days</span><input name="active_days" placeholder="sun, mon, tue" /></label>
            <label className="form-field full"><span>Monitoring schedule JSON</span><textarea name="monitoring_schedule" defaultValue={'{"mode":"event_only"}'} rows={3} /></label>
            <label className="form-field full"><span>Active hours JSON</span><textarea name="active_hours" defaultValue="{}" rows={3} /></label>
            <label className="form-field full"><span>Override limits JSON</span><textarea name="override_limits" defaultValue="{}" rows={3} /></label>
            <button className="button primary full" type="submit" disabled={isPending}>שיוך חבילה</button>
          </form>
          <button className="button secondary full" type="button" onClick={snapshotUsage} disabled={isPending || !selectedSiteId}>חישוב שימוש חודשי</button>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>חבילות קיימות</h2><p>מחירים הם placeholders למוצר standalone עתידי, לא למחיר גן בטוח.</p></div>
        <div className="procedure-list">
          {packages.map((item) => (
            <article className="card procedure-card" key={item.id}>
              <div>
                <span className={item.active ? "pill good" : "pill bad"}>{item.active ? "active" : "disabled"}</span>
                <span className="pill">{item.package_type}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <small>מצלמות: {item.camera_limit ?? "ללא הגבלה"} · ניטור: {item.monitoring_mode} · Human review required</small>
              </div>
              <div className="procedure-meta">
                <span>{item.monthly_price} {item.monthly_price ? "ILS/month" : "custom/placeholder"}</span>
                <span>{item.event_retention_days} days event retention</span>
                <span>{item.recording_retention_days} days recording</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>מנויי אתרים</h2><p>Standalone only.</p></div>
          <div className="risk-list">
            {subscriptions.length === 0 ? <div>אין שיוכים עדיין <b>future only</b></div> : subscriptions.map((item) => (
              <div key={item.id}>{item.observer_sites?.name ?? "אתר"} · {item.observer_monitoring_packages?.name ?? "חבילה"} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Usage tracking</h2><p>בסיס לחיוב עתידי, לא חסימה לגני ילדים.</p></div>
          <div className="risk-list">
            {usage.length === 0 ? <div>אין snapshots עדיין <b>חשב שימוש</b></div> : usage.slice(0, 8).map((item) => (
              <div key={item.id}>{item.observer_sites?.name ?? "אתר"} · {item.period_start} עד {item.period_end} <b>{item.active_cameras} מצלמות · {item.ai_events_count} אירועים</b></div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
