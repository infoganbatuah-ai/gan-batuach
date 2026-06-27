import { buildMaskedConnectionSummary, buildRtspCandidates, cameraConnectionInputSchema, type CameraConnectionInput } from "@/lib/domain/camera-connection-builder";
import {
  checkGatewayHealth as checkVideoGatewayHealth,
  disableCameraSource as disableVideoCameraSource,
  getGatewayProvider,
  getPlaybackUrls as getVideoPlaybackUrls,
  registerCameraSource as registerVideoCameraSource,
  testCameraSource as testVideoCameraSource
} from "@/lib/domain/video-gateway-client";

export type CameraGatewayActionResult = Awaited<ReturnType<typeof checkVideoGatewayHealth>> & {
  candidatesTried?: number;
  sourceSummary?: ReturnType<typeof buildMaskedConnectionSummary>;
  nextAction?: string;
};

export async function checkGatewayHealth() {
  return checkVideoGatewayHealth();
}

export async function testCameraSource(input: CameraConnectionInput): Promise<CameraGatewayActionResult> {
  const parsed = cameraConnectionInputSchema.parse(input);
  const result = await testVideoCameraSource(parsed);
  return {
    ...result,
    sourceSummary: buildMaskedConnectionSummary(parsed),
    nextAction: result.status === "healthy"
      ? "אפשר לרשום את המצלמה ל-Gateway."
      : result.status === "gateway_required"
        ? "להגדיר VIDEO_GATEWAY_URL ומפתח שרת לפני בדיקת מקור אמיתית."
        : "לבדוק כתובת, פורט, ערוץ והרשאות."
  };
}

export async function registerCameraSource(cameraId: string, input: CameraConnectionInput) {
  const parsed = cameraConnectionInputSchema.parse(input);
  const result = await registerVideoCameraSource(cameraId, parsed);
  return {
    ...result,
    sourceSummary: buildMaskedConnectionSummary(parsed),
    noRtspExposed: true,
    noGatewaySecretExposed: true
  };
}

export async function disableCameraSource(gatewayStreamId: string) {
  return disableVideoCameraSource(gatewayStreamId);
}

export async function getPlaybackUrls(gatewayStreamId: string, token?: string) {
  return getVideoPlaybackUrls(gatewayStreamId, token);
}

export function getGatewayDiagnostics(input?: Partial<CameraConnectionInput>) {
  const provider = getGatewayProvider();
  const configured = Boolean(
    (process.env.CAMERA_GATEWAY_URL ?? process.env.VIDEO_GATEWAY_URL) &&
    (process.env.CAMERA_GATEWAY_SECRET ?? process.env.VIDEO_GATEWAY_API_KEY ?? process.env.VIDEO_GATEWAY_SIGNING_SECRET)
  );
  const requiredEnv = ["CAMERA_GATEWAY_URL", "CAMERA_GATEWAY_SECRET", "CAMERA_GATEWAY_PUBLIC_BASE_URL"];
  if (!input) {
    return {
      provider,
      configured,
      requiredEnv,
      noRtspBrowserExposure: true,
      audioDisabledForGanBatuach: true,
      faceRecognitionDisabledForGanBatuach: true
    };
  }

  const parsed = cameraConnectionInputSchema.partial().parse(input);
  const candidates = parsed.system_type ? buildRtspCandidates(parsed as CameraConnectionInput) : [];
  return {
    provider,
    configured,
    candidatesTried: candidates.length,
    sourceSummary: parsed.system_type ? buildMaskedConnectionSummary(parsed as CameraConnectionInput) : null,
    candidateTemplates: candidates.map((candidate) => ({ vendor: candidate.vendor, template: candidate.template })),
    noRtspBrowserExposure: true,
    noCredentialsBrowserExposure: true,
    noGatewaySecretBrowserExposure: true
  };
}

export { getGatewayProvider };
