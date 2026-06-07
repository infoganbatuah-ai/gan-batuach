import { getCameraHealthStatus } from "@/lib/domain/camera-health";
import { isGatewayConfigured } from "@/lib/domain/video-gateway-client";

type CameraRow = Record<string, any>;
type GatewayRow = Record<string, any>;
type ReadinessCheck = Record<string, any>;

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter(Boolean)).size;
}

function checkScore(checks: ReadinessCheck[]) {
  if (!checks.length) return 0;
  const total = checks.reduce((sum, check) => sum + Number(check.score ?? 0), 0);
  return Math.round(total / checks.length);
}

export function buildCameraDeploymentSummary({
  cameras,
  gateways,
  testSites,
  homeTestSites,
  readinessChecks,
  validations,
  playbackSessions
}: {
  cameras: CameraRow[];
  gateways: GatewayRow[];
  testSites: Array<Record<string, any>>;
  homeTestSites: Array<Record<string, any>>;
  readinessChecks: ReadinessCheck[];
  validations: Array<Record<string, any>>;
  playbackSessions: Array<Record<string, any>>;
}) {
  const activeCameras = cameras.filter((camera) => camera.active !== false && ["online", "connected", "healthy"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status ?? "").toLowerCase())).length;
  const disconnectedCameras = cameras.filter((camera) => ["offline", "failed", "error", "disconnected"].includes(getCameraHealthStatus(camera)) || ["offline", "failed", "error", "disconnected"].includes(String(camera.status ?? camera.stream_status ?? "").toLowerCase())).length;
  const testCameraCount = cameras.filter((camera) => String(camera.deployment_scope ?? camera.test_site_type ?? "").includes("test")).length;
  const connectedSites = uniqueCount([
    ...cameras.map((camera) => camera.garden_id ?? camera.kindergarten_id),
    ...cameras.map((camera) => camera.observer_site_id),
    ...homeTestSites.map((site) => site.site_key)
  ]);
  const onlineGateways = gateways.filter((gateway) => ["active", "configured", "testing"].includes(String(gateway.status ?? "").toLowerCase()) || ["healthy", "degraded"].includes(String(gateway.health_status ?? "").toLowerCase()));
  const activeStreams = gateways.reduce((sum, gateway) => sum + Number(gateway.active_streams ?? 0), 0);
  const failedStreams = gateways.reduce((sum, gateway) => sum + Number(gateway.failed_streams ?? 0), 0);
  const latencyValues = gateways.map((gateway) => Number(gateway.latency_ms ?? gateway.metadata?.latency_ms ?? 0)).filter((value) => value > 0);
  const averageLatency = latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null;
  const baseScore = checkScore(readinessChecks);
  const gatewayBonus = isGatewayConfigured() ? 8 : 0;
  const score = Math.min(100, Math.max(0, baseScore + gatewayBonus));

  return {
    connectedSites,
    testSites: testSites.length + homeTestSites.length,
    testCameraCount,
    activeCameras,
    disconnectedCameras,
    totalCameras: cameras.length,
    gatewayHealth: onlineGateways.length > 0 ? "configured" : isGatewayConfigured() ? "env_configured" : "pending",
    gatewayOnlineCount: onlineGateways.length,
    gatewayCount: gateways.length,
    activeStreams,
    failedStreams,
    averageLatency,
    readinessScore: score,
    latestValidationStatus: validations[0]?.status ?? "not_tested",
    playbackSessions: playbackSessions.length,
    productionReady: score >= 85 && disconnectedCameras === 0 && onlineGateways.length > 0
  };
}

export function deploymentTone(status?: string | null): "default" | "good" | "warn" | "bad" {
  const value = String(status ?? "").toLowerCase();
  if (["ready", "active", "active_test", "configured", "healthy", "success", "online"].includes(value)) return "good";
  if (["blocked", "failed", "offline", "disabled"].includes(value)) return "bad";
  if (["partial", "testing", "pending", "not_configured", "gateway_required", "needs_review"].includes(value)) return "warn";
  return "default";
}

export const cameraDeploymentSecurityPoints = [
  "RTSP לא מוצג בדפדפן",
  "שם משתמש וסיסמה נשמרים בצד שרת בלבד",
  "מפתחות Gateway נשארים במשתני סביבה",
  "צפייה דורשת הרשאה ו-Token זמני",
  "בדיקות וחיבורי Gateway נרשמים ביומן Audit"
];
