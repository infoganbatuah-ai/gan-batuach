export type AiFrameSourceKind = "camera_gateway_snapshot" | "secure_test_frame" | "uploaded_test_clip" | "digital_observer_site_stream" | "mock_frame";

export type AiFrameSourceStatus = "not_connected" | "mock_only" | "secure_test_frame_ready" | "gateway_ready" | "blocked";

export type AiFrameSourceReadiness = {
  status: AiFrameSourceStatus;
  sourceKind: AiFrameSourceKind;
  frameSourceConnected: boolean;
  realStreamConnected: boolean;
  rawStreamExposed: false;
  rtspExposed: false;
  credentialsExposed: false;
  storageRequired: boolean;
  retentionPolicyRequired: boolean;
  missingEnv: string[];
};

function hasAny(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

export function getAiFrameSourceReadiness(productContext: "gan_batuach" | "digital_observer" = "gan_batuach"): AiFrameSourceReadiness {
  const gatewayConfigured = productContext === "digital_observer"
    ? hasAny(["DIGITAL_OBSERVER_CAMERA_GATEWAY_URL", "CAMERA_GATEWAY_PUBLIC_BASE_URL", "VIDEO_GATEWAY_PUBLIC_URL"])
    : hasAny(["CAMERA_GATEWAY_PUBLIC_BASE_URL", "VIDEO_GATEWAY_PUBLIC_URL"]);
  const secureTestFrameReady = hasAny(["AI_SAFE_TEST_FRAME_PATH", "AI_TEST_FRAME_STORAGE_PATH"]);
  if (gatewayConfigured) {
    return {
      status: "gateway_ready",
      sourceKind: productContext === "digital_observer" ? "digital_observer_site_stream" : "camera_gateway_snapshot",
      frameSourceConnected: true,
      realStreamConnected: false,
      rawStreamExposed: false,
      rtspExposed: false,
      credentialsExposed: false,
      storageRequired: false,
      retentionPolicyRequired: true,
      missingEnv: []
    };
  }
  if (secureTestFrameReady) {
    return {
      status: "secure_test_frame_ready",
      sourceKind: "secure_test_frame",
      frameSourceConnected: true,
      realStreamConnected: false,
      rawStreamExposed: false,
      rtspExposed: false,
      credentialsExposed: false,
      storageRequired: false,
      retentionPolicyRequired: true,
      missingEnv: []
    };
  }
  return {
    status: "not_connected",
    sourceKind: "mock_frame",
    frameSourceConnected: false,
    realStreamConnected: false,
    rawStreamExposed: false,
    rtspExposed: false,
    credentialsExposed: false,
    storageRequired: false,
    retentionPolicyRequired: true,
    missingEnv: productContext === "digital_observer"
      ? ["DIGITAL_OBSERVER_CAMERA_GATEWAY_URL or AI_SAFE_TEST_FRAME_PATH"]
      : ["CAMERA_GATEWAY_PUBLIC_BASE_URL or AI_SAFE_TEST_FRAME_PATH"]
  };
}
