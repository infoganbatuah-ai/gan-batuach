import Link from "next/link";
import { Camera, CheckCircle2, Home, KeyRound, PlayCircle, RadioTower, ShieldCheck, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildCameraDeploymentSummary, cameraDeploymentSecurityPoints, deploymentTone } from "@/lib/domain/camera-deployment-readiness";

const safeCameraColumns = [
  "id",
  "garden_id",
  "kindergarten_id",
  "observer_site_id",
  "name",
  "area",
  "camera_type",
  "source_type",
  "system_type",
  "deployment_scope",
  "test_site_type",
  "camera_provider_key",
  "gateway_provider_preference",
  "live_preview_status",
  "permission_model",
  "stream_status",
  "health_status",
  "status",
  "active",
  "last_seen",
  "last_test_status",
  "last_test_message",
  "last_test_at",
  "gateway_registration_status",
  "gateway_provider",
  "gateway_latency_ms",
  "gateway_stream_count",
  "gateway_failed_stream_count",
  "parent_view_allowed",
  "playback_hls_ready",
  "playback_webrtc_ready",
  "recording_enabled",
  "retention_days",
  "created_at",
  "updated_at"
].join(",");

const flowIcons: Record<string, typeof Camera> = {
  dvr_nvr: Video,
  ip_camera: Camera,
  manual_rtsp: KeyRound,
  onvif: RadioTower,
  home_test: Home
};

function hebrewField(field: string) {
  const labels: Record<string, string> = {
    brand: "מותג",
    host_ip: "כתובת IP / דומיין",
    port: "פורט",
    username: "שם משתמש",
    password: "סיסמה",
    channel_number: "מספר ערוץ",
    stream_type: "איכות שידור",
    test_connection: "בדיקת חיבור",
    rtsp_support: "תמיכת RTSP",
    onvif_support: "תמיכת ONVIF",
    rtsp_url: "כתובת RTSP מלאה",
    camera_name: "שם מצלמה",
    location: "מיקום",
    connection_type: "סוג חיבור",
    rtsp_or_onvif_support: "RTSP או ONVIF"
  };
  return labels[field] ?? field;
}

function friendlyValidation(status: string) {
  if (status === "success") return "הבדיקה האחרונה הצליחה";
  if (status === "gateway_required") return "נדרש Video Gateway פעיל כדי להציג שידור חי";
  if (status === "failed") return "הבדיקה נכשלה ודורשת בדיקה";
  return "טרם בוצעה בדיקת חיבור";
}

export default async function AdminCameraDeploymentPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin camera deployment", async () => {
    const supabase = await createClient();
    const [camerasRes, gatewaysRes, testSitesRes, homeSitesRes, flowsRes, checksRes, validationsRes, sessionsRes] = await Promise.all([
      supabase.from("camera_streams" as any).select(safeCameraColumns).order("created_at", { ascending: false }).limit(300),
      supabase.from("camera_gateway_deployments" as any).select("*").order("provider"),
      supabase.from("camera_deployment_test_sites" as any).select("*").order("site_key"),
      supabase.from("home_test_sites" as any).select("*").order("site_key"),
      supabase.from("camera_connection_flow_catalog" as any).select("*").order("created_at"),
      supabase.from("camera_deployment_readiness_checks" as any).select("*").order("category"),
      supabase.from("camera_stream_validations" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("camera_playback_sessions" as any).select("*").order("started_at", { ascending: false }).limit(100)
    ]);
    [camerasRes, gatewaysRes, testSitesRes, homeSitesRes, flowsRes, checksRes, validationsRes, sessionsRes].forEach((query, index) => logSupabaseError(`camera deployment query ${index}`, (query as any).error));
    const cameras = (camerasRes.data ?? []) as any[];
    const gateways = (gatewaysRes.data ?? []) as any[];
    const testSites = (testSitesRes.data ?? []) as any[];
    const homeTestSites = (homeSitesRes.data ?? []) as any[];
    const readinessChecks = (checksRes.data ?? []) as any[];
    const validations = (validationsRes.data ?? []) as any[];
    const playbackSessions = (sessionsRes.data ?? []) as any[];
    return {
      cameras,
      gateways,
      testSites,
      homeTestSites,
      flows: (flowsRes.data ?? []) as any[],
      readinessChecks,
      validations,
      playbackSessions,
      summary: buildCameraDeploymentSummary({ cameras, gateways, testSites, homeTestSites, readinessChecks, validations, playbackSessions }),
      queryError: [camerasRes.error, gatewaysRes.error, testSitesRes.error, homeSitesRes.error, flowsRes.error, checksRes.error, validationsRes.error, sessionsRes.error].some(Boolean) ? "חלק מנתוני פריסת המצלמות לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, {
    cameras: [] as any[],
    gateways: [] as any[],
    testSites: [] as any[],
    homeTestSites: [] as any[],
    flows: [] as any[],
    readinessChecks: [] as any[],
    validations: [] as any[],
    playbackSessions: [] as any[],
    summary: buildCameraDeploymentSummary({ cameras: [], gateways: [], testSites: [], homeTestSites: [], readinessChecks: [], validations: [], playbackSessions: [] }),
    queryError: null as string | null
  });
  const { summary } = result.data;
  const primaryFlows = result.data.flows.filter((flow: any) => ["dvr_nvr", "ip_camera", "manual_rtsp", "onvif", "home_test"].includes(flow.flow_key));
  const latestValidation = result.data.validations[0];

  return (
    <DashboardShell role="admin" title="פריסת מצלמות">
      <PremiumDashboardHero
        eyebrow="Camera Deployment Center"
        title="פריסת מצלמות ו-Gateway"
        subtitle="תמונת מוכנות אחת לחיבור DVR/NVR, מצלמות IP, RTSP, ONVIF, Gateway ופיילוט ביתי מבודד."
        badge={`${summary.readinessScore}/100`}
        badgeTone={summary.productionReady ? "good" : "warn"}
        actions={<><Link className="button primary" href="/dashboard/admin/cameras">ניהול מצלמות</Link><Link className="button secondary" href="/dashboard/admin/video-gateway">שרת וידאו</Link></>}
      >
        <div className="setup-checklist">
          <span>Gateway: {summary.gatewayHealth === "pending" ? "ממתין" : "מוכן לבדיקה"}</span>
          <span>Playback: HLS / WebRTC / Token</span>
          <span>סודות: צד שרת בלבד</span>
        </div>
      </PremiumDashboardHero>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <RoleMetricCard label="אתרים מחוברים" value={summary.connectedSites} hint="גנים, אתרי תצפיתן ובדיקות" tone="good" />
        <RoleMetricCard label="אתרי בדיקה" value={summary.testSites} hint="מבודדים מנתוני ייצור" tone={summary.testSites ? "good" : "warn"} />
        <RoleMetricCard label="מצלמות פעילות" value={summary.activeCameras} hint={`${summary.totalCameras} במלאי`} tone={summary.activeCameras ? "good" : "warn"} />
        <RoleMetricCard label="מנותקות" value={summary.disconnectedCameras} hint="Offline / failed" tone={summary.disconnectedCameras ? "bad" : "good"} />
        <RoleMetricCard label="Gateway" value={`${summary.gatewayOnlineCount}/${summary.gatewayCount}`} hint={summary.gatewayHealth === "pending" ? "נדרש חיבור" : "מוכן לבדיקה"} tone={summary.gatewayHealth === "pending" ? "warn" : "good"} />
        <RoleMetricCard label="שידורים פעילים" value={summary.activeStreams} hint={`${summary.failedStreams} נכשלים`} tone={summary.failedStreams ? "bad" : "good"} />
        <RoleMetricCard label="Latency" value={summary.averageLatency ? `${summary.averageLatency}ms` : "-"} hint="לפי Gateway" tone="default" />
        <RoleMetricCard label="בדיקה אחרונה" value={latestValidation?.status ?? "אין"} hint={friendlyValidation(latestValidation?.status)} tone={deploymentTone(latestValidation?.status)} />
      </section>

      <CleanSection title="אשפי חיבור" subtitle="כל סוג מצלמה מקבל זרימה משלו, עם הסבר קצר ושדות רלוונטיים בלבד.">
        {primaryFlows.length === 0 ? (
          <EmptyState title="קטלוג זרימות עדיין לא נטען" text="לאחר הרצת המיגרציה יופיעו כאן זרימות DVR/NVR, IP, RTSP, ONVIF ובדיקת בית." />
        ) : (
          <section className="quick-actions-grid">
            {primaryFlows.map((flow: any) => {
              const Icon = flowIcons[flow.flow_key] ?? Camera;
              const fields = Array.isArray(flow.required_fields) ? flow.required_fields : [];
              return (
                <article className="card action-panel" key={flow.flow_key}>
                  <Icon size={24} />
                  <h2>{flow.display_name}</h2>
                  <p>{flow.explanation_he}</p>
                  <div className="tag-cloud">{fields.slice(0, 8).map((field: string) => <span key={field}>{hebrewField(field)}</span>)}</div>
                  <StatusBadge tone={flow.gateway_required ? "warn" : "good"}>{flow.gateway_required ? "דורש Gateway" : "ללא Gateway"}</StatusBadge>
                </article>
              );
            })}
          </section>
        )}
      </CleanSection>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><RadioTower size={20} /> Gateway</h2><p>MediaMTX, go2rtc או Gateway מותאם. אין שמירת סודות במסך הזה.</p></div>
          {result.data.gateways.length === 0 ? <EmptyState title="אין Gateway רשום" text="המערכת מוכנה, אבל נדרש Gateway פעיל כדי להציג שידור חי." /> : <div className="procedure-list compact-list">{result.data.gateways.map((gateway: any) => (
            <div className="mini-row" key={`${gateway.provider}-${gateway.environment}`}>
              <span>{gateway.provider} · {gateway.environment}</span>
              <strong>{gateway.status} · {gateway.health_status}</strong>
              <small>{gateway.active_streams ?? 0} פעילים · {gateway.failed_streams ?? 0} נכשלים · HLS {gateway.hls_ready ? "כן" : "לא"} · WebRTC {gateway.webrtc_ready ? "כן" : "לא"}</small>
            </div>
          ))}</div>}
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><PlayCircle size={20} /> בדיקת חיבור</h2><p>התוצאה מוצגת בעברית, בלי לחשוף RTSP, משתמש, סיסמה או מפתח Gateway.</p></div>
          {latestValidation ? (
            <div className="risk-list">
              <div><CheckCircle2 /> Host reachable <b>{latestValidation.connection_valid ? "נגיש" : "ממתין"}</b></div>
              <div><KeyRound /> Authentication <b>{latestValidation.credentials_valid ? "נבדק" : "חסר"}</b></div>
              <div><Video /> Stream exists <b>{latestValidation.stream_available ? "כן" : "לא אומת"}</b></div>
              <div><RadioTower /> Gateway reachable <b>{latestValidation.gateway_required ? "נדרש" : "נבדק"}</b></div>
              <div><ShieldCheck /> Secrets <b>{latestValidation.no_secrets_exposed ? "לא נחשפו" : "דורש בדיקה"}</b></div>
            </div>
          ) : <EmptyState title="אין בדיקות חיבור עדיין" text="בדיקות יירשמו אחרי לחיצה על בדיקת חיבור באשף המצלמות." />}
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Home size={20} /> Home Camera Pilot</h2><p>בדיקות פרטיות מבודדות מנתוני גן פעיל.</p></div>
          {result.data.homeTestSites.length === 0 ? <EmptyState title="אין אתר ביתי עדיין" text="לאחר הרצת המיגרציה ייווצר אתר daniel_home_camera מבודד." /> : <div className="procedure-list compact-list">{result.data.homeTestSites.map((site: any) => (
            <div className="mini-row" key={site.site_key}>
              <span>{site.display_name}</span>
              <strong>{site.status} · {site.isolation_status}</strong>
              <small>{site.location_label ?? "ללא מיקום"} · {site.connection_type} · {site.camera_count ?? 0} מצלמות</small>
            </div>
          ))}</div>}
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> אבטחה וצפייה</h2><p>Playback עובר דרך הרשאות, Token זמני ו-Audit.</p></div>
          <div className="setup-checklist">
            {cameraDeploymentSecurityPoints.map((point) => <span key={point}>{point}</span>)}
          </div>
        </article>
      </section>

      <CleanSection title="מוכנות פריסה" subtitle="מה מוכן ומה עדיין דורש תשתית חיצונית.">
        {result.data.readinessChecks.length === 0 ? <EmptyState title="אין בדיקות מוכנות" text="לאחר הרצת המיגרציה יופיעו בדיקות פריסה." /> : <div className="procedure-list">{result.data.readinessChecks.map((check: any) => (
          <article className="card procedure-card" key={check.check_key}>
            <div>
              <StatusBadge tone={deploymentTone(check.status)}>{check.status}</StatusBadge>
              <h3>{check.title}</h3>
              <p>{check.evidence_summary}</p>
              <small>פעולה הבאה: {check.recommended_action}</small>
            </div>
            <div className="procedure-meta"><strong>{check.score}/100</strong><span>{check.category}</span></div>
          </article>
        ))}</div>}
      </CleanSection>

      <section className="quick-actions-grid">
        <ActionCard title="ניהול מצלמות" text="הוספה, בדיקה ורישום Gateway" href="/dashboard/admin/cameras" icon={Camera} tone="good" />
        <ActionCard title="תשתית מצלמות" text="בריאות, ספקים, הקלטה ואחסון" href="/dashboard/admin/camera-infrastructure" icon={Video} />
        <ActionCard title="שרת וידאו" text="MediaMTX, go2rtc או Gateway מותאם" href="/dashboard/admin/video-gateway" icon={RadioTower} />
        <ActionCard title="בדיקות תצפיתן" text="Shadow, כיול ואירועים לבדיקה" href="/dashboard/admin/observer-test-center" icon={ShieldCheck} />
      </section>
    </DashboardShell>
  );
}
