export type AiProviderMode =
  | "disabled"
  | "mock"
  | "readiness"
  | "shadow"
  | "test_inference"
  | "real_inference"
  | "production";

const allowedAiProviderModes: AiProviderMode[] = [
  "disabled",
  "mock",
  "readiness",
  "shadow",
  "test_inference",
  "real_inference",
  "production"
];

function hasAny(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

export function normalizeAiProviderMode(value?: string | null): AiProviderMode {
  return allowedAiProviderModes.includes(value as AiProviderMode) ? (value as AiProviderMode) : "mock";
}

export function getAiProviderGuardrails() {
  const mode = normalizeAiProviderMode(process.env.AI_PROVIDER_MODE);
  const provider = process.env.AI_PROVIDER || process.env.VISION_PROVIDER || process.env.LOCAL_VISION_PROVIDER || "local_mock";
  const providerConfigured = hasAny(["AI_INFERENCE_ENDPOINT", "LOCAL_VISION_ENDPOINT", "CUSTOM_VISION_ENDPOINT"]) || process.env.LOCAL_VISION_ENABLED === "true";
  const providerSecretConfigured = hasAny(["AI_PROVIDER_API_KEY", "AI_WEBHOOK_SECRET", "AI_PROVIDER_WEBHOOK_SECRET"]);
  const frameSourceConfigured = hasAny(["CAMERA_GATEWAY_PUBLIC_BASE_URL", "CAMERA_GATEWAY_URL", "VIDEO_GATEWAY_PUBLIC_URL", "DIGITAL_OBSERVER_CAMERA_GATEWAY_URL"]);
  const safeTestFrameConfigured = hasAny(["AI_SAFE_TEST_FRAME_PATH", "AI_TEST_FRAME_STORAGE_PATH"]);
  const frameSourceStatus = frameSourceConfigured ? "gateway_configured" : safeTestFrameConfigured ? "safe_test_frame" : "not_connected";
  const realInferenceRequested = mode === "test_inference" || mode === "real_inference" || mode === "production";
  const realInferenceAllowed = realInferenceRequested && providerConfigured && (frameSourceConfigured || safeTestFrameConfigured);
  const missingEnv = [
    ...(!providerConfigured && realInferenceRequested ? ["AI_INFERENCE_ENDPOINT or LOCAL_VISION_ENDPOINT or CUSTOM_VISION_ENDPOINT"] : []),
    ...(!providerSecretConfigured && mode === "production" ? ["AI_PROVIDER_API_KEY or AI_WEBHOOK_SECRET"] : []),
    ...(!frameSourceConfigured && !safeTestFrameConfigured && realInferenceRequested ? ["CAMERA_GATEWAY_PUBLIC_BASE_URL or AI_SAFE_TEST_FRAME_PATH"] : [])
  ];

  return {
    mode,
    provider,
    providerConfigured,
    providerSecretConfigured,
    frameSourceConfigured,
    safeTestFrameConfigured,
    frameSourceStatus,
    shadowModeRequired: true,
    humanReviewRequired: true,
    parentRawVisibilityAllowed: false,
    audioAllowedForGanBatuach: false,
    faceRecognitionAllowedForGanBatuach: false,
    automaticAccusationsAllowed: false,
    realInferenceRequested,
    realInferenceAllowed,
    productionBlocked: mode === "production" && (!realInferenceAllowed || missingEnv.length > 0),
    missingEnv,
    allowedGanBatuachCandidates: [
      "child_outside_allowed_zone_candidate",
      "crowding_candidate",
      "inactivity_candidate",
      "fall_suspected_candidate",
      "panic_movement_candidate",
      "restricted_area_candidate",
      "camera_health_event"
    ],
    restrictedGanBatuachCapabilities: [
      "audio_analytics",
      "face_recognition",
      "biometric_child_profile",
      "persistent_identity_tracking",
      "raw_ai_parent_alerts",
      "automatic_decisions",
      "automatic_accusations"
    ]
  };
}
