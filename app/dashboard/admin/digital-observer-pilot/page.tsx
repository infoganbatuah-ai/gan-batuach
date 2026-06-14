import Link from "next/link";
import { AlertTriangle, Bell, Camera, CheckCircle2, CreditCard, Gauge, HeartPulse, MessageSquare, Radar, ShieldCheck, SlidersHorizontal, Wrench } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DIGITAL_OBSERVER_PILOT_CAMERA_SYSTEMS,
  DIGITAL_OBSERVER_PILOT_PRIVACY_RULES,
  DIGITAL_OBSERVER_PILOT_REVIEW_LIFECYCLE,
  DIGITAL_OBSERVER_PILOT_SUPPORT_CATEGORIES
} from "@/lib/domain/digital-observer-product";

function tone(status?: string | null) {
  const value = String(status ?? "");
  if (["active_pilot", "completed", "healthy", "registered", "playback_ready", "success", "confirmed", "calibrated", "high", "committed"].includes(value)) return "pill good";
  if (["planned", "setup", "camera_testing", "observer_testing", "collecting_data", "needs_review", "warning", "medium", "unknown"].includes(value)) return "pill warn";
  if (["failed", "cancelled", "blocked", "degraded", "paused", "low", "open", "critical", "high"].includes(value)) return "pill bad";
  return "pill";
}

function date(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL").format(new Date(value));
}

function scoreTone(score: number) {
  if (score >= 80) return "pill good";
  if (score >= 55) return "pill warn";
  return "pill bad";
}

export default async function AdminDigitalObserverPilotPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer pilot", async () => {
    const supabase = await createClient();
    const [pilotSites, gatewayChecks, cameras, alertReviews, calibration, supportIssues, feedback, commercial, legalNotes, readiness] = await Promise.all([
      supabase.from("digital_observer_pilot_sites" as any).select("*, observer_sites(name, site_type)").order("created_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_pilot_gateway_checks" as any).select("*, digital_observer_pilot_sites(site_name, site_type)").order("created_at", { ascending: false }).limit(200),
      supabase.from("camera_streams" as any).select("id, name, observer_site_id, digital_observer_pilot_site_id, digital_observer_pilot_mode, site_owner_visible, status, health_status, stream_status, gateway_registration_status, last_health_check_at, last_seen, ai_enabled").eq("digital_observer_pilot_mode", true).order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_pilot_alert_reviews" as any).select("*, digital_observer_pilot_sites(site_name), camera_streams(name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_pilot_calibration_profiles" as any).select("*, digital_observer_pilot_sites(site_name), camera_streams(name)").order("updated_at", { ascending: false }).limit(160),
      supabase.from("digital_observer_pilot_support_issues" as any).select("*, digital_observer_pilot_sites(site_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_pilot_feedback" as any).select("*, digital_observer_pilot_sites(site_name)").order("created_at", { ascending: false }).limit(120),
      supabase.from("digital_observer_pilot_commercial_validation" as any).select("*, digital_observer_pilot_sites(site_name, site_type)").order("updated_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_pilot_legal_notes" as any).select("*, digital_observer_pilot_sites(site_name)").order("updated_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_pilot_readiness_snapshots" as any).select("*, digital_observer_pilot_sites(site_name, site_type)").order("calculated_at", { ascending: false }).limit(100)
    ]);
    [pilotSites, gatewayChecks, cameras, alertReviews, calibration, supportIssues, feedback, commercial, legalNotes, readiness].forEach((query, index) => logSupabaseError("digital observer pilot query " + index, query.error));
    return {
      pilotSites: pilotSites.data ?? [],
      gatewayChecks: gatewayChecks.data ?? [],
      cameras: cameras.data ?? [],
      alertReviews: alertReviews.data ?? [],
      calibration: calibration.data ?? [],
      supportIssues: supportIssues.data ?? [],
      feedback: feedback.data ?? [],
      commercial: commercial.data ?? [],
      legalNotes: legalNotes.data ?? [],
      readiness: readiness.data ?? [],
      queryError: pilotSites.error ? "לא ניתן לטעון פיילוטים של Digital Observer כרגע" : null
    };
  }, {
    pilotSites: [] as any[],
    gatewayChecks: [] as any[],
    cameras: [] as any[],
    alertReviews: [] as any[],
    calibration: [] as any[],
    supportIssues: [] as any[],
    feedback: [] as any[],
    commercial: [] as any[],
    legalNotes: [] as any[],
    readiness: [] as any[],
    queryError: null as string | null
  });
  const data = result.data;
  const activePilots = data.pilotSites.filter((site) => site.pilot_status === "active_pilot").length;
  const setupPilots = data.pilotSites.filter((site) => ["planned", "setup", "camera_testing", "observer_testing"].includes(site.pilot_status)).length;
  const openIssues = data.supportIssues.filter((issue) => !["fixed", "verified", "closed", "deferred"].includes(issue.status)).length;
  const latestScore = data.readiness[0]?.readiness_score ?? data.pilotSites[0]?.readiness_score ?? 0;
  const gatewayReady = data.gatewayChecks.filter((check) => check.status === "success" || check.playback_ready).length;
  const pendingReviews = data.alertReviews.filter((review) => ["detected", "pending_review", "needs_followup", "uncertain"].includes(review.lifecycle_status)).length;
  const falsePositive = data.alertReviews.filter((review) => review.outcome === "false_positive").length;
  const falseNegative = data.alertReviews.filter((review) => review.outcome === "false_negative" || review.outcome === "missed_event").length;

  return (
    <DashboardShell role="admin" title="Digital Observer Pilot">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Standalone pilot deployment</p>
          <h1>First home / business Digital Observer pilot.</h1>
          <p>ניהול פיילוט אמיתי לבית, עסק או אתר פרטי. אין שימוש בנתוני גנים, אין חשיפת RTSP, אין פעולות AI אוטומטיות.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard/admin/camera-gateway">Camera Gateway</Link>
          <Link className="button secondary" href="/dashboard/admin/digital-observer-leads">Observer Leads</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><ShieldCheck /><strong>{data.pilotSites.length}</strong><span>pilot sites</span></article>
        <article className="metric-card"><HeartPulse /><strong>{activePilots}</strong><span>active pilots</span></article>
        <article className="metric-card"><Camera /><strong>{data.cameras.length}</strong><span>pilot cameras</span></article>
        <article className="metric-card"><Gauge /><strong>{latestScore}/100</strong><span>readiness score</span></article>
        <article className="metric-card"><Wrench /><strong>{gatewayReady}</strong><span>gateway checks ready</span></article>
        <article className="metric-card"><Bell /><strong>{pendingReviews}</strong><span>reviews pending</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{openIssues}</strong><span>open support issues</span></article>
        <article className="metric-card"><CreditCard /><strong>{data.commercial.length}</strong><span>commercial validations</span></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Pilot sites</h2>
          <p>Home, business, office, warehouse, store, parking lot and custom pilots only.</p>
        </div>
        {data.pilotSites.length === 0 ? (
          <div className="empty-state"><strong>No Digital Observer pilots yet</strong><span>Create a pilot site after a qualified Digital Observer lead.</span></div>
        ) : (
          <div className="procedure-list">
            {data.pilotSites.map((site) => (
              <article className="card procedure-card" key={site.id}>
                <div>
                  <span className={tone(site.pilot_status)}>{site.pilot_status}</span>
                  <span className="pill">{site.site_type}</span>
                  <span className={scoreTone(Number(site.readiness_score ?? 0))}>{site.readiness_score}/100</span>
                  <h3>{site.site_name}</h3>
                  <p>{site.city ?? "city TBD"} · {site.number_of_cameras} cameras · {site.camera_system_type} · {site.package_interest ?? "package TBD"}</p>
                  <small>{date(site.pilot_start_date)} - {date(site.pilot_end_date)} · support {site.support_owner ?? "unassigned"}</small>
                </div>
                <div className="procedure-meta">
                  <span>Gateway: {site.gateway_provider} / {site.gateway_status}</span>
                  <span>{site.cameras_connected} connected · {site.observer_alerts_count} alerts</span>
                  <span>{site.open_issues_count} open issues · calibration {site.calibration_status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Secure pilot rules</h2><p>These are mandatory before any real-world pilot.</p></div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_PILOT_PRIVACY_RULES.map((rule) => <span key={rule}>{rule}</span>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Camera systems supported</h2><p>Readiness, not a promise that every model is production-ready today.</p></div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_PILOT_CAMERA_SYSTEMS.map((system) => <span key={system}>{system}</span>)}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Gateway validation</h2><p>MediaMTX, go2rtc and custom gateway readiness.</p></div>
          <div className="risk-list">
            {data.gatewayChecks.length === 0 ? <div>No gateway checks <b>planned</b></div> : data.gatewayChecks.slice(0, 10).map((check) => (
              <div key={check.id}>{check.digital_observer_pilot_sites?.site_name ?? "pilot"} · {check.check_type} <b>{check.status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Site owner camera cards</h2><p>Simple status cards; technical diagnostics stay advanced/admin.</p></div>
          <div className="risk-list">
            {data.cameras.length === 0 ? <div>No pilot cameras <b>waiting</b></div> : data.cameras.slice(0, 10).map((camera) => (
              <div key={camera.id}>{camera.name ?? "Camera"} · {camera.health_status ?? camera.status ?? "unknown"} <b>{camera.gateway_registration_status ?? "gateway pending"}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Alert review workflow</h2><p>Detected signals remain in shadow mode until reviewed.</p></div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_PILOT_REVIEW_LIFECYCLE.map((step) => <span key={step}>{step}</span>)}
          </div>
          <div className="risk-list">
            <div>False positives <b>{falsePositive}</b></div>
            <div>False negatives / missed events <b>{falseNegative}</b></div>
            <div>Pending review <b>{pendingReviews}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Calibration</h2><p>Motion sensitivity, after-hours sensitivity, restricted zones and thresholds.</p></div>
          <div className="risk-list">
            {data.calibration.length === 0 ? <div>No calibration profiles <b>missing</b></div> : data.calibration.slice(0, 10).map((profile) => (
              <div key={profile.id}>{profile.digital_observer_pilot_sites?.site_name ?? "pilot"} · {profile.event_type} <b>{profile.calibration_status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Support workflow</h2><p>Camera, gateway, playback, alert, billing, onboarding and UX issues.</p></div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_PILOT_SUPPORT_CATEGORIES.map((category) => <span key={category}>{category}</span>)}
          </div>
          <div className="risk-list">
            {data.supportIssues.slice(0, 6).map((issue) => <div key={issue.id}>{issue.title} <b>{issue.status}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Feedback</h2><p>Setup difficulty, alert usefulness, dashboard clarity and willingness to pay.</p></div>
          <div className="risk-list">
            {data.feedback.length === 0 ? <div>No feedback collected <b>waiting</b></div> : data.feedback.slice(0, 8).map((item) => (
              <div key={item.id}>{item.digital_observer_pilot_sites?.site_name ?? "pilot"} · clarity {item.dashboard_clarity ?? "?"}/5 <b>{item.preferred_package ?? "package TBD"}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Commercial validation</h2><p>Trial/subscription readiness without real charging unless payment mode is explicitly enabled.</p></div>
          <div className="risk-list">
            {data.commercial.map((item) => (
              <div key={item.id}>{item.digital_observer_pilot_sites?.site_name ?? "pilot"} · {item.package_interest ?? "package"} <b>{item.trial_to_paid_likelihood}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <SlidersHorizontal />
          <h2>Billing separation</h2>
          <p>Digital Observer payments remain separate from Gan Batuach kindergarten subscriptions, parent tuition and kindergarten payout configuration. No mixed invoices or mixed revenue reporting.</p>
        </article>
        <article className="card action-panel">
          <ShieldCheck />
          <h2>Privacy and legal notes</h2>
          <div className="risk-list">
            {data.legalNotes.length === 0 ? <div>No legal notes <b>missing</b></div> : data.legalNotes.slice(0, 8).map((note) => (
              <div key={note.id}>{note.digital_observer_pilot_sites?.site_name ?? "pilot"} · audio {note.audio_capability_status} · face {note.face_capability_status} <b>{note.external_review_required ? "review" : "approved"}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Pilot readiness snapshots</h2>
          <p>0-100 score based on camera stability, gateway stability, alert accuracy, review completion, owner engagement, package readiness and support issues.</p>
        </div>
        <div className="procedure-list">
          {data.readiness.map((snapshot) => (
            <article className="card procedure-card" key={snapshot.id}>
              <div>
                <span className={scoreTone(Number(snapshot.readiness_score ?? 0))}>{snapshot.readiness_score}/100</span>
                <h3>{snapshot.digital_observer_pilot_sites?.site_name ?? snapshot.snapshot_key}</h3>
                <p>{snapshot.blocker_reason ?? "No blocker reason recorded"}</p>
              </div>
              <div className="procedure-meta">
                <span>camera {snapshot.camera_stability_score}/100 · gateway {snapshot.gateway_stability_score}/100</span>
                <span>alert {snapshot.alert_accuracy_score}/100 · review {snapshot.review_completion_score}/100</span>
                <span>{snapshot.production_activation_blocked ? "Production blocked" : "Pilot can proceed after approval"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
