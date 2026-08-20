import Link from "next/link";
import { Activity, AlertTriangle, Camera, Eye, RadioTower, ShieldCheck, Video, Workflow } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { buildCameraAuditSummary } from "@/lib/domain/camera-diagnostics";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;

function healthTone(value?: string | null): "default" | "good" | "warn" | "bad" {
  const status = String(value ?? "");
  if (["healthy", "connected", "online", "active", "allowed"].includes(status)) return "good";
  if (["unknown", "pending", "pending_gateway", "testing", "degraded", "outside_hours"].includes(status)) return "warn";
  if (["failed", "offline", "error", "disabled", "blocked", "no_signal", "unauthorized"].includes(status)) return "bad";
  return "default";
}

function healthLabel(value?: string | null) {
  const labels: Record<string, string> = {
    healthy: "תקין",
    connected: "מחובר",
    online: "מחובר",
    active: "פעיל",
    allowed: "מאושר",
    configured: "מוגדר",
    testing: "בבדיקה",
    unknown: "לא ידוע",
    pending: "ממתין",
    pending_gateway: "ממתין ל-Gateway",
    degraded: "ירידה באיכות",
    outside_hours: "מחוץ לשעות",
    failed: "נכשל",
    offline: "לא מחובר",
    error: "שגיאה",
    disabled: "מושבת",
    blocked: "חסום",
    no_signal: "אין אות",
    unauthorized: "לא מורשה"
  };
  return labels[String(value ?? "").toLowerCase()] ?? "לא ידוע";
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

export default async function AdminCamerasPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("camera operations center", async () => {
    const supabase = await createClient();
    const cameraColumns = "id,garden_id,kindergarten_id,name,area,camera_type,source_type,source_category,camera_zone_label,system_type,deployment_scope,test_site_type,camera_provider_key,gateway_provider_preference,stream_status,health_status,last_seen,connection_method,protocol,status,active,parent_view_allowed,parent_viewing_allowed,parent_visibility_status,parent_blocked_reason,staff_view_allowed,inspector_view_allowed,observer_enabled,observer_review_required,observer_confidence_threshold,last_health_check_at,last_test_status,last_test_message,last_test_at,gateway_registration_status,gateway_last_error,masked_connection_summary,live_preview_status,playback_hls_ready,playback_webrtc_ready,video_gateway_stream_id,gateway_stream_id,viewing_hours,operating_hours,recording_enabled,retention_days,archive_policy";
    const camerasRes = await supabase.from("camera_streams" as any).select(cameraColumns).limit(220);
    logSupabaseError("admin camera operations cameras", camerasRes.error);
    const rawCameras = (camerasRes.data ?? []) as Row[];
    const gardenIds = Array.from(new Set(rawCameras.map((camera) => camera.garden_id ?? camera.kindergarten_id).filter(Boolean)));
    const [gardens, gateways, validations, health, sessions, audit, observerQueue] = await Promise.all([
      safeQuery<Row>("camera operations gardens", () => supabase.from("gardens" as any).select("id,name,city").limit(300)),
      safeQuery<Row>("camera gateway registry", () => supabase.from("camera_gateway_registry" as any).select("*").order("created_at", { ascending: false }).limit(50)),
      safeQuery<Row>("camera validations", () => supabase.from("camera_stream_validations" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("camera health history", () => supabase.from("camera_health_history" as any).select("*").order("checked_at", { ascending: false }).limit(120)),
      safeQuery<Row>("camera playback sessions", () => supabase.from("camera_playback_sessions" as any).select("id,camera_id,kindergarten_id,profile_id,playback_protocol,gateway_provider,started_at,metadata").order("started_at", { ascending: false }).limit(120)),
      safeQuery<Row>("camera infra audit", () => supabase.from("camera_infrastructure_audit_logs" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("observer processing queue", () => supabase.from("observer_processing_queue" as any).select("*").order("created_at", { ascending: false }).limit(120))
    ]);
    const gardenById = new Map(gardens.map((garden) => [garden.id, garden]));
    const cameras: Row[] = rawCameras.map((camera) => {
      const gardenId = camera.garden_id ?? camera.kindergarten_id;
      return {
        ...camera,
        gardens: gardenById.get(gardenId) ?? null,
        expected_parent_count: 0,
        visibility_status: camera.parent_visibility_status === "allowed" ? "גלויה להורים מורשים" : camera.parent_blocked_reason ?? "צפיית הורים חסומה"
      };
    });
    const summary = buildCameraAuditSummary(cameras);
    const failedStreams = cameras.filter((camera) => ["offline", "failed", "error", "no_signal", "unauthorized"].includes(String(camera.status ?? camera.health_status ?? camera.stream_status)));
    const pendingSetup = cameras.filter((camera) => ["pending_gateway", "pending", "not_configured"].includes(String(camera.gateway_registration_status ?? camera.status ?? camera.parent_visibility_status)));
    const parentExposure = cameras.filter((camera) => camera.parent_viewing_allowed === true || camera.parent_view_allowed === true);
    const observerEnabled = cameras.filter((camera) => camera.observer_enabled === true || camera.ai_enabled === true);
    const activeGateways = gateways.filter((gateway) => ["active", "configured", "testing"].includes(String(gateway.status)));
    return {
      cameras,
      gardens,
      gateways,
      validations,
      health,
      sessions,
      audit,
      observerQueue,
      summary,
      failedStreams,
      pendingSetup,
      parentExposure,
      observerEnabled,
      activeGateways,
      queryError: camerasRes.error ? "לא ניתן לטעון את כל נתוני המצלמות כרגע" : null
    };
  }, {
    cameras: [] as Row[],
    gardens: [] as Row[],
    gateways: [] as Row[],
    validations: [] as Row[],
    health: [] as Row[],
    sessions: [] as Row[],
    audit: [] as Row[],
    observerQueue: [] as Row[],
    summary: buildCameraAuditSummary([]),
    failedStreams: [] as Row[],
    pendingSetup: [] as Row[],
    parentExposure: [] as Row[],
    observerEnabled: [] as Row[],
    activeGateways: [] as Row[],
    queryError: null as string | null
  });

  const data = result.data;
  const gatewayConfigured = Boolean(process.env.VIDEO_GATEWAY_URL);

  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/cameras" title="תפעול מצלמות ו-AI" subtitle="בריאות מצלמות, Gateway, הרשאות צפייה ותור בדיקה אנושי." badge="מצלמות">
      <div className="commercial-dashboard camera-infra-center">
        <PremiumDashboardHero
          eyebrow="Camera Operations"
          title="מרכז תשתיות מצלמות ותצפיתן"
          subtitle="כל המצלמות, שערי הווידאו, הרשאות הצפייה, בריאות השידורים ותור הבדיקה האנושי במקום אחד."
          badge={gatewayConfigured ? "שרת וידאו מוגדר" : "ממתין לשרת וידאו"}
          badgeTone={gatewayConfigured ? "good" : "warn"}
          actions={<><Link className="button primary" href="/dashboard/admin/video-gateway">שרת וידאו</Link><Link className="button secondary" href="/dashboard/admin/camera-audit">בדיקת חשיפה</Link></>}
        >
          <div className="setup-checklist"><span>ללא חשיפת RTSP</span><span>צפייה מתועדת</span><span>בדיקה אנושית</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="מצלמות" value={data.cameras.length} hint={`${data.summary.online} מחוברות`} tone={data.failedStreams.length ? "warn" : "good"} />
          <RoleMetricCard label="תקלות שידור" value={data.failedStreams.length} tone={data.failedStreams.length ? "bad" : "good"} />
          <RoleMetricCard label="ממתינות לחיבור" value={data.pendingSetup.length} tone={data.pendingSetup.length ? "warn" : "good"} />
          <RoleMetricCard label="גלויות להורים" value={data.parentExposure.length} tone={data.parentExposure.length ? "warn" : "default"} />
          <RoleMetricCard label="תצפיתן מחובר" value={data.observerEnabled.length} tone={data.observerEnabled.length ? "good" : "default"} />
          <RoleMetricCard label="Gateway" value={data.activeGateways.length || (gatewayConfigured ? 1 : 0)} tone={gatewayConfigured || data.activeGateways.length ? "good" : "warn"} />
        </section>

        <section className="camera-infra-grid">
          <CleanSection title="שערי וידאו" subtitle="MediaMTX, go2rtc או שער מותאם. אין שמירת סודות במסד.">
            {data.gateways.length === 0 ? <EmptyState title="אין רישום שערים" text="לאחר הרצת המיגרציה יופיעו שערי וידאו מוכנים להגדרה." /> : (
              <div className="camera-infra-list">{data.gateways.map((gateway) => (
                <article className="camera-infra-row" key={gateway.id}>
                  <div><strong>{gateway.display_name}</strong><span>{gateway.provider} · {gateway.deployment_scope} · {gateway.active_streams} שידורים</span></div>
                  <StatusBadge tone={healthTone(gateway.status)}>{healthLabel(gateway.status)}</StatusBadge>
                  <StatusBadge tone={healthTone(gateway.health_status)}>{healthLabel(gateway.health_status)}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>

          <CleanSection title="תור תצפיתן" subtitle="אינדיקציות לבדיקה. הורים לא רואים חומר גולמי.">
            {data.observerQueue.length === 0 ? <EmptyState title="אין אירועים בתור" text="כאשר התצפיתן יזהה אינדיקציה, היא תמתין כאן לבדיקה אנושית." /> : (
              <div className="camera-infra-list">{data.observerQueue.slice(0, 8).map((item) => (
                <article className="camera-infra-row" key={item.id}>
                  <div><strong>{item.event_type}</strong><span>{healthLabel(item.status)} · ביטחון {item.confidence ?? "-"}</span></div>
                  <StatusBadge tone={item.parent_visible ? "warn" : "good"}>{item.parent_visible ? "מאושר להורה" : "פנימי"}</StatusBadge>
                </article>
              ))}</div>
            )}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><AlertTriangle size={20} /> דורש טיפול</h2>
            {[...data.failedStreams, ...data.pendingSetup].slice(0, 8).length === 0 ? <div className="empty-mini">אין מצלמות שדורשות טיפול.</div> : [...data.failedStreams, ...data.pendingSetup].slice(0, 8).map((camera) => (
              <div className="list-item" key={camera.id}><div><strong>{camera.name}</strong><span>{camera.gardens?.name ?? "גן"} · {camera.area ?? "אזור"} · {camera.gateway_last_error ?? camera.last_test_message ?? "נדרש חיבור"}</span></div><StatusBadge tone={healthTone(camera.status ?? camera.health_status)}>{healthLabel(camera.status ?? camera.health_status)}</StatusBadge></div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Activity size={20} /> צפיות ולוגים</h2>
            {data.sessions.length === 0 && data.audit.length === 0 ? <div className="empty-mini">אין פעילות צפייה עדיין.</div> : [...data.sessions, ...data.audit].slice(0, 8).map((item) => (
              <div className="list-item" key={item.id}><div><strong>{item.action ?? "צפייה מאובטחת"}</strong><span>{dateText(item.started_at ?? item.created_at)} · {healthLabel(item.status) || "מתועד"}</span></div><StatusBadge tone={item.no_secrets_exposed === false ? "bad" : "good"}>{item.no_secrets_exposed === false ? "בדיקה" : "מאובטח"}</StatusBadge></div>
            ))}
          </article>
        </section>

        <CameraAdminManager cameras={data.cameras as Row[]} gardens={data.gardens as Array<{ id: string; name: string; city?: string | null }>} gatewayConnected={gatewayConfigured} />

        <section className="quick-actions-grid">
          <ActionCard title="שרת וידאו" text="Gateway ובריאות" href="/dashboard/admin/video-gateway" icon={RadioTower} />
          <ActionCard title="פריסת מצלמות" text="בדיקות והתקנה" href="/dashboard/admin/camera-deployment" icon={Video} />
          <ActionCard title="בדיקת חשיפה" text="הורים והרשאות" href="/dashboard/admin/camera-audit" icon={ShieldCheck} />
          <ActionCard title="תצפיתן" text="תור בדיקה" href="/dashboard/admin/observer-network" icon={Eye} />
          <ActionCard title="אירועי תצפיתן" text="בדיקה אנושית" href="/dashboard/admin/ai-events" icon={Workflow} />
          <ActionCard title="אינטגרציות" text="הפעלת ספקים" href="/dashboard/admin/integrations" icon={Camera} />
        </section>
      </div>
    </AdminAppFrame>
  );
}
