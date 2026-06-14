import Link from "next/link";
import { Activity, Camera, CheckCircle2, Eye, Home, RadioTower, ShieldCheck, TriangleAlert, Video } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { checkGatewayHealth, getGatewayDiagnostics, getGatewayProvider } from "@/lib/domain/camera-gateway";
import { createClient } from "@/lib/supabase/server";

type GatewayConfig = {
  id: string;
  provider: string;
  status?: string | null;
  health_status?: string | null;
  active_stream_count?: number | null;
  failed_stream_count?: number | null;
  latency_ms?: number | null;
  last_heartbeat_at?: string | null;
  notes?: string | null;
};

type CameraRow = {
  id: string;
  name?: string | null;
  garden_id?: string | null;
  kindergarten_id?: string | null;
  area?: string | null;
  source_type?: string | null;
  source_category?: string | null;
  system_type?: string | null;
  brand?: string | null;
  status?: string | null;
  stream_status?: string | null;
  health_status?: string | null;
  gateway_provider?: string | null;
  gateway_registration_status?: string | null;
  gateway_latency_ms?: number | null;
  gateway_failed_stream_count?: number | null;
  last_test_at?: string | null;
  last_test_status?: string | null;
  last_health_check_at?: string | null;
  parent_viewing_allowed?: boolean | null;
  recording_enabled?: boolean | null;
  observer_enabled?: boolean | null;
  observer_shadow_mode?: boolean | null;
  audio_disabled?: boolean | null;
  face_recognition_disabled?: boolean | null;
  deployment_scope?: string | null;
  test_site_type?: string | null;
  gardens?: { name?: string | null } | null;
};

type HomeSite = {
  id: string;
  site_key: string;
  display_name: string;
  location_label?: string | null;
  connection_type?: string | null;
  status?: string | null;
  isolation_status?: string | null;
  camera_count?: number | null;
  gateway_provider?: string | null;
  playback_test_status?: string | null;
  observer_shadow_mode?: boolean | null;
};

type ReadinessCheck = {
  id: string;
  check_key: string;
  category: string;
  title: string;
  status?: string | null;
  score?: number | null;
  evidence_summary?: string | null;
  recommended_action?: string | null;
};

type ValidationRow = {
  id: string;
  provider_key?: string | null;
  status?: string | null;
  message?: string | null;
  latency_ms?: number | null;
  candidates_tried_count?: number | null;
  created_at?: string | null;
  camera_streams?: { name?: string | null } | null;
};

async function safeQuery<T>(promise: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>, label: string): Promise<{ rows: T[]; error: string | null }> {
  const result = await promise;
  if (result.error) {
    console.error(`[camera-gateway] ${label}`, result.error.message);
    return { rows: [], error: result.error.message ?? label };
  }
  return { rows: result.data ?? [], error: null };
}

function tone(status?: string | null): "good" | "warn" | "bad" | "default" {
  if (["healthy", "registered", "connected", "active", "ready", "success", "configured"].includes(status ?? "")) return "good";
  if (["failed", "offline", "disabled", "blocked", "unauthorized", "gateway_unavailable"].includes(status ?? "")) return "bad";
  if (["pending_gateway", "testing", "registering", "partial", "degraded", "not_configured"].includes(status ?? "")) return "warn";
  return "default";
}

function formatDate(value?: string | null) {
  if (!value) return "טרם";
  return new Date(value).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function cameraKind(camera: CameraRow) {
  return camera.source_category ?? camera.system_type ?? camera.source_type ?? "camera";
}

export default async function AdminCameraGatewayPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [gatewayHealth, gatewayConfigs, cameras, homeSites, checks, validations, sessions] = await Promise.all([
    checkGatewayHealth().catch((error) => ({ configured: false, status: "error" as const, message: error instanceof Error ? error.message : "Gateway health failed" })),
    safeQuery<GatewayConfig>(supabase.from("camera_gateway_configs" as any).select("*").order("provider"), "gateway configs"),
    safeQuery<CameraRow>(supabase.from("camera_streams" as any).select("id, garden_id, kindergarten_id, name, area, source_type, source_category, system_type, brand, status, stream_status, health_status, gateway_provider, gateway_registration_status, gateway_latency_ms, gateway_failed_stream_count, last_test_at, last_test_status, last_health_check_at, parent_viewing_allowed, recording_enabled, observer_enabled, observer_shadow_mode, audio_disabled, face_recognition_disabled, deployment_scope, test_site_type, gardens(name)").order("created_at", { ascending: false }).limit(300), "cameras"),
    safeQuery<HomeSite>(supabase.from("home_camera_test_sites" as any).select("*").order("created_at", { ascending: false }).limit(20), "home camera test sites"),
    safeQuery<ReadinessCheck>(supabase.from("camera_deployment_readiness_checks" as any).select("*").order("category").order("score", { ascending: false }), "camera readiness checks"),
    safeQuery<ValidationRow>(supabase.from("camera_stream_validations" as any).select("id, provider_key, status, message, latency_ms, candidates_tried_count, created_at, camera_streams(name)").order("created_at", { ascending: false }).limit(12), "camera validations"),
    safeQuery<any>(supabase.from("camera_playback_sessions" as any).select("id, camera_id, gateway_provider, compliance_status, started_at, ended_at, camera_streams(name), profiles(full_name)").order("started_at", { ascending: false }).limit(12), "camera playback sessions")
  ]);

  const diagnostics = getGatewayDiagnostics();
  const queryError = [gatewayConfigs.error, cameras.error, homeSites.error, checks.error, validations.error, sessions.error].filter(Boolean).join(" · ") || null;
  const requiredGatewayEnv = "requiredEnv" in diagnostics && Array.isArray(diagnostics.requiredEnv) ? diagnostics.requiredEnv : ["VIDEO_GATEWAY_URL", "VIDEO_GATEWAY_API_KEY or VIDEO_GATEWAY_SIGNING_SECRET"];
  const cameraRows = cameras.rows;
  const registered = cameraRows.filter((camera) => camera.gateway_registration_status === "registered" || camera.status === "connected").length;
  const failed = cameraRows.filter((camera) => ["failed", "offline", "error", "gateway_unavailable", "no_signal"].includes(camera.gateway_registration_status ?? camera.health_status ?? "")).length;
  const pending = cameraRows.filter((camera) => !camera.gateway_registration_status || ["pending_gateway", "testing", "registering", "pending"].includes(camera.gateway_registration_status)).length;
  const homeCameraCount = cameraRows.filter((camera) => camera.deployment_scope === "home_test" || camera.test_site_type === "home_test").length + homeSites.rows.reduce((sum, site) => sum + (site.camera_count ?? 0), 0);
  const kindergartenCameraCount = cameraRows.length - homeCameraCount;
  const recordingReady = cameraRows.filter((camera) => camera.recording_enabled).length;
  const observerReady = cameraRows.filter((camera) => camera.observer_enabled || camera.observer_shadow_mode).length;
  const privacySafe = cameraRows.filter((camera) => camera.audio_disabled !== false && camera.face_recognition_disabled !== false).length;

  return (
    <DashboardShell role="admin" title="Camera Gateway">
      <div className="commercial-dashboard communications-dashboard">
        <PremiumDashboardHero
          eyebrow="Real Camera Gateway"
          title="מרכז חיבור מצלמות אמיתי"
          subtitle="DVR/NVR, מצלמות IP, RTSP, ONVIF ופיילוט מצלמת בית דרך Gateway בלבד. אין RTSP, סיסמאות או מפתחות בדפדפן."
          badge={gatewayHealth.configured ? getGatewayProvider() : "Gateway missing"}
          badgeTone={gatewayHealth.configured ? "good" : "warn"}
          actions={<><Link className="button primary" href="/dashboard/admin/cameras">ניהול מצלמות</Link><Link className="button secondary" href="/dashboard/admin/video-gateway">שרת וידאו קיים</Link></>}
        />
        <AdminDataError message={queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="Gateway" value={gatewayHealth.status} hint={gatewayHealth.message} tone={tone(gatewayHealth.status)} />
          <RoleMetricCard label="שידורים פעילים" value={(gatewayHealth as any).streamCount ?? registered} hint={`${failed} כשלו`} tone={failed ? "warn" : "good"} />
          <RoleMetricCard label="מצלמות גן" value={kindergartenCameraCount} hint={`${pending} ממתינות`} tone={pending ? "warn" : "good"} />
          <RoleMetricCard label="פיילוט בית" value={homeCameraCount} hint={`${homeSites.rows.length} אתרי בדיקה`} tone={homeSites.rows.length ? "good" : "warn"} />
        </div>

        <CleanSection title="תצורת Gateway" subtitle="סודות נשארים ב-env בלבד. הטבלה מחזיקה סטטוס ותיאור, לא מפתחות.">
          <div className="communication-template-grid">
            {gatewayConfigs.rows.length ? gatewayConfigs.rows.map((config) => (
              <article className="communication-template-card" key={config.id}>
                <div><strong>{config.provider}</strong><span>{config.notes ?? "Gateway readiness"} · heartbeat {formatDate(config.last_heartbeat_at)}</span></div>
                <StatusBadge tone={tone(config.health_status ?? config.status)}>{config.health_status ?? config.status}</StatusBadge>
              </article>
            )) : (
              <article className="communication-template-card">
                <div><strong>{diagnostics.provider}</strong><span>{requiredGatewayEnv.join(" · ")}</span></div>
                <StatusBadge tone={diagnostics.configured ? "good" : "warn"}>{diagnostics.configured ? "configured" : "not_configured"}</StatusBadge>
              </article>
            )}
          </div>
        </CleanSection>

        <CleanSection title="מצלמות ושידורים" subtitle="רישום מקור, בריאות, הקלטה ותצפיתן ללא חשיפת מקור.">
          <div className="premium-metric-grid">
            <RoleMetricCard label="מחוברות" value={registered} hint="registered / connected" tone={registered ? "good" : "warn"} />
            <RoleMetricCard label="ממתינות Gateway" value={pending} hint="pending/testing/registering" tone={pending ? "warn" : "good"} />
            <RoleMetricCard label="הקלטה מוכנה" value={recordingReady} hint="metadata בלבד עד בחירת אחסון" tone={recordingReady ? "warn" : "default"} />
            <RoleMetricCard label="Observer shadow" value={observerReady} hint="סקלטון/תנועה ללא פעולה אוטומטית" tone={observerReady ? "good" : "warn"} />
          </div>
          {cameraRows.length ? (
            <div className="communication-log-list">
              {cameraRows.slice(0, 12).map((camera) => (
                <article className="communication-log-row" key={camera.id}>
                  <div>
                    <strong>{camera.name ?? "מצלמה"} · {camera.gardens?.name ?? "בדיקה/ללא גן"}</strong>
                    <span>{cameraKind(camera)} · {camera.area ?? "אזור לא מוגדר"} · בדיקה אחרונה {formatDate(camera.last_test_at)}</span>
                  </div>
                  <StatusBadge tone={tone(camera.gateway_registration_status ?? camera.health_status ?? camera.status)}>{camera.gateway_registration_status ?? camera.health_status ?? camera.status ?? "pending"}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין מצלמות מחוברות" text="אחרי הוספת DVR/NVR/IP/RTSP/ONVIF, הן יופיעו כאן." />}
        </CleanSection>

        <CleanSection title="פיילוט מצלמת בית" subtitle="בדיקת מצלמה פרטית לפני גן אמיתי. מבודד מנתוני הורים, ילדים וציות גן.">
          {homeSites.rows.length ? (
            <div className="communication-log-list">
              {homeSites.rows.map((site) => (
                <article className="communication-log-row" key={site.id}>
                  <div>
                    <strong><Home size={16} /> {site.display_name}</strong>
                    <span>{site.location_label ?? "ללא מיקום"} · {site.connection_type} · parent access blocked · observer shadow {site.observer_shadow_mode ? "on" : "off"}</span>
                  </div>
                  <StatusBadge tone={site.isolation_status === "isolated" ? "good" : "warn"}>{site.status}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין אתר פיילוט בית" text="מיגרציית PHASE 164 יוצרת אתר בדיקה מבודד עבור Daniel." />}
        </CleanSection>

        <CleanSection title="בדיקות חיבור אחרונות" subtitle="בדיקות source/gateway בלי החזרת RTSP או פרטי התחברות ללקוח.">
          {validations.rows.length ? (
            <div className="communication-log-list">
              {validations.rows.map((validation) => (
                <article className="communication-log-row" key={validation.id}>
                  <div>
                    <strong>{validation.camera_streams?.name ?? validation.provider_key ?? "בדיקת מצלמה"}</strong>
                    <span>{validation.message ?? "בדיקה"} · {validation.candidates_tried_count ?? 0} candidates · {validation.latency_ms ?? "-"}ms</span>
                  </div>
                  <StatusBadge tone={tone(validation.status)}>{validation.status}</StatusBadge>
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין בדיקות חיבור" text="בדיקות DVR/NVR/RTSP יירשמו כאן אחרי הרצה מהאשף." />}
        </CleanSection>

        <CleanSection title="פרטיות ואבטחה" subtitle="ב-Gan Batuach Israel mode אין שמע, אין זיהוי פנים ואין צפייה ללא הרשאה וטוקן.">
          <div className="communication-template-grid">
            <article className="communication-template-card"><div><strong>RTSP חסום לדפדפן</strong><span>Gateway בלבד, playback token קצר חיים</span></div><StatusBadge tone="good">חסום</StatusBadge></article>
            <article className="communication-template-card"><div><strong>Audio / Face</strong><span>{privacySafe}/{cameraRows.length} מצלמות מסומנות ללא שמע וללא פנים</span></div><StatusBadge tone={privacySafe === cameraRows.length ? "good" : "warn"}>Israel mode</StatusBadge></article>
            <article className="communication-template-card"><div><strong>Parent viewing</strong><span>נוכחות ילד, MFA, שעות צפייה ומדיניות הורים</span></div><StatusBadge tone="good">policy gate</StatusBadge></article>
            <article className="communication-template-card"><div><strong>Inspector viewing</strong><span>גישה רק עם שיוך וסיבת פיקוח</span></div><StatusBadge tone="good">scoped</StatusBadge></article>
          </div>
        </CleanSection>

        <CleanSection title="מוכנות פריסה" subtitle="מה כבר מוכן ומה דורש בדיקת Gateway אמיתית.">
          <div className="communication-template-grid">
            {checks.rows.filter((check) => check.category === "gateway" || check.category === "home_test" || check.category === "playback" || check.category === "health").slice(0, 8).map((check) => (
              <article className="communication-template-card" key={check.id}>
                <div><strong>{check.title}</strong><span>{check.evidence_summary}</span></div>
                <StatusBadge tone={tone(check.status)}>{check.score ?? 0}/100</StatusBadge>
              </article>
            ))}
          </div>
        </CleanSection>

        <CleanSection title="פעולות קשורות" subtitle="מסכים קיימים נשארים נקודת הניהול המפורטת.">
          <div className="premium-action-grid">
            <ActionCard title="פריסת מצלמות" text="DVR/NVR, IP, RTSP, ONVIF ופיילוט ביתי" href="/dashboard/admin/camera-deployment" icon={Video} />
            <ActionCard title="תשתית מצלמות" text="בריאות, ספקים, הקלטה ואחסון" href="/dashboard/admin/camera-infrastructure" icon={RadioTower} />
            <ActionCard title="ציות מצלמות" text="צפיית הורים, watermark ו-session controls" href="/dashboard/admin/camera-compliance" icon={ShieldCheck} />
            <ActionCard title="Audit מצלמות" text="בדיקות חשיפה והרשאות" href="/dashboard/admin/camera-audit" icon={Eye} />
            <ActionCard title="שרת וידאו ישן" text="פעולות register/retest/disable" href="/dashboard/admin/video-gateway" icon={Activity} />
            <ActionCard title="מצלמות" text="כל המצלמות וההרשאות" href="/dashboard/admin/cameras" icon={Camera} />
          </div>
        </CleanSection>

        {!gatewayHealth.configured ? <div className="error-banner"><TriangleAlert size={16} /> יש להגדיר VIDEO_GATEWAY_URL ומפתח שרת כדי לבצע בדיקת מצלמה אמיתית.</div> : <div className="success-banner"><CheckCircle2 size={16} /> Gateway מוגדר. ניתן לבצע smoke test מול מצלמת בית.</div>}
      </div>
    </DashboardShell>
  );
}
