export type CommunicationsSendMode = "mock" | "test" | "production";
export type ProviderMode = "disabled" | "mock" | "sandbox" | "test" | "production" | "live";
export type PaymentMode = ProviderMode;
export type InvoiceMode = ProviderMode;
export type PushMode = "disabled" | "test" | "production";
export type CameraGatewayMode = "disabled" | "test" | "production";
export type AiProviderMode = "mock" | "shadow" | "production";
export type IntegrationType =
  | "email"
  | "whatsapp"
  | "sms"
  | "push"
  | "payment"
  | "invoice"
  | "supabase"
  | "vercel"
  | "camera_gateway"
  | "ai_provider";

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function hasAny(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

export function normalizeProviderMode(value: string | undefined, fallback: ProviderMode = "disabled"): ProviderMode {
  return oneOf(value, ["disabled", "mock", "sandbox", "test", "production", "live"] as const, fallback);
}

export function getIntegrationSafetyModes() {
  const communications = oneOf(process.env.COMMUNICATIONS_SEND_MODE, ["mock", "test", "production"] as const, "mock");
  const payment = normalizeProviderMode(process.env.PAYMENT_MODE, "disabled");
  const invoice = normalizeProviderMode(process.env.INVOICE_MODE, "mock");
  const push = oneOf(process.env.PUSH_MODE, ["disabled", "test", "production"] as const, "disabled");
  const cameraGateway = oneOf(process.env.CAMERA_GATEWAY_MODE, ["disabled", "test", "production"] as const, "disabled");
  const aiProvider = oneOf(process.env.AI_PROVIDER_MODE, ["mock", "shadow", "production"] as const, "mock");

  return {
    communications,
    payment,
    invoice,
    push,
    cameraGateway,
    aiProvider,
    productionCommunicationsAllowed: communications === "production",
    livePaymentsAllowed: payment === "live" || payment === "production",
    productionInvoicesAllowed: invoice === "production" || invoice === "live",
    productionPushAllowed: push === "production",
    productionCameraGatewayAllowed: cameraGateway === "production",
    productionAiProviderAllowed: aiProvider === "production"
  };
}

export function getProviderMissingConfiguration(type: IntegrationType, provider?: string | null) {
  const key = `${type}:${provider ?? ""}`;

  if (key.startsWith("email:resend")) {
    return [["RESEND_API_KEY", "EMAIL_API_KEY"], ["EMAIL_FROM_ADDRESS"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (key.startsWith("email:sendgrid")) {
    return [["SENDGRID_API_KEY", "EMAIL_API_KEY"], ["EMAIL_FROM_ADDRESS"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (key.startsWith("email:amazon_ses")) {
    return [["SES_REGION", "AWS_SES_REGION"], ["AWS_SES_ACCESS_KEY_ID"], ["AWS_SES_SECRET_ACCESS_KEY"], ["EMAIL_FROM_ADDRESS"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (key.startsWith("whatsapp:meta")) {
    return [
      ["META_WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN"],
      ["META_WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_PHONE_NUMBER_ID"],
      ["META_WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID"]
    ].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (key.startsWith("whatsapp:twilio")) {
    return [["TWILIO_WHATSAPP_SID", "TWILIO_ACCOUNT_SID"], ["TWILIO_WHATSAPP_TOKEN", "TWILIO_AUTH_TOKEN"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (key.startsWith("sms:twilio")) {
    return [["TWILIO_ACCOUNT_SID"], ["TWILIO_AUTH_TOKEN"], ["SMS_SENDER_ID", "SMS_FROM_NUMBER"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (type === "push") {
    return [["FCM_PROJECT_ID", "FCM_SERVER_KEY", "APNS_KEY_ID", "VAPID_PUBLIC_KEY"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (type === "payment") {
    return [["PAYMENT_PROVIDER"], ["TRANZILA_TERMINAL", "MESHULAM_API_KEY", "CARDCOM_TERMINAL", "PELECARD_TERMINAL"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (type === "invoice") {
    return [["INVOICE_PROVIDER"], ["INVOICE_API_KEY"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (type === "camera_gateway") {
    return [["VIDEO_GATEWAY_URL"], ["VIDEO_GATEWAY_API_KEY", "VIDEO_GATEWAY_SIGNING_SECRET"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  if (type === "ai_provider") {
    return [["LOCAL_VISION_ENDPOINT", "CUSTOM_VISION_ENDPOINT"]].filter((group) => !hasAny(group)).map((group) => group.join(" or "));
  }
  return [];
}

export function getSafeIntegrationStatus(type: IntegrationType, provider?: string | null) {
  const modes = getIntegrationSafetyModes();
  const missing = getProviderMissingConfiguration(type, provider);

  if (type === "payment") {
    if (modes.payment === "disabled") return "disabled";
    return missing.length ? "not_configured" : modes.livePaymentsAllowed ? "production_ready" : "test_mode";
  }
  if (type === "invoice") {
    if (modes.invoice === "disabled") return "disabled";
    return missing.length ? "not_configured" : modes.productionInvoicesAllowed ? "production_ready" : "test_mode";
  }
  if (["email", "whatsapp", "sms", "push"].includes(type)) {
    if (type === "push") {
      if (modes.push === "disabled") return "disabled";
      return missing.length ? "not_configured" : modes.push === "production" ? "production_ready" : "test_mode";
    }
    return missing.length ? "not_configured" : modes.communications === "production" ? "production_ready" : "test_mode";
  }
  if (type === "camera_gateway") {
    if (modes.cameraGateway === "disabled") return "disabled";
    return missing.length ? "not_configured" : modes.cameraGateway === "production" ? "production_ready" : "test_mode";
  }
  if (type === "ai_provider") {
    return missing.length ? "not_configured" : modes.aiProvider === "production" ? "production_ready" : "test_mode";
  }
  return missing.length ? "not_configured" : "configured";
}
