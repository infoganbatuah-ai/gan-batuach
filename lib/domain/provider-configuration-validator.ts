import { getEmailProductionReadiness } from "@/lib/domain/email-provider";
import { getPushProductionReadiness } from "@/lib/domain/push-provider";
import { getSmsProductionReadiness } from "@/lib/domain/sms-provider";
import { getWhatsAppProductionReadiness } from "@/lib/domain/whatsapp-provider";
import { getIntegrationSafetyModes, getProviderMissingConfiguration, normalizeProviderMode, type IntegrationType, type ProviderMode } from "@/lib/domain/provider-integration-safety";

export type ProviderReadinessStatus =
  | "configured"
  | "missing_env"
  | "sandbox_ready"
  | "production_blocked"
  | "disabled"
  | "invalid_mode";

export type ProviderConfigurationStatus = {
  type: IntegrationType;
  provider: string;
  mode: string;
  supportedModes: ProviderMode[];
  requiredEnv: string[];
  missingEnv: string[];
  webhookUrl: string | null;
  callbackUrl: string | null;
  sandboxSupported: boolean;
  productionSupported: boolean;
  testActionAvailable: boolean;
  healthCheckAvailable: boolean;
  logsAvailable: boolean;
  status: ProviderReadinessStatus;
  blockers: string[];
};

const supportedModes: ProviderMode[] = ["disabled", "mock", "sandbox", "test", "production", "live"];

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL || "";
}

function url(path: string) {
  const base = appUrl();
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

function hasAny(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

function flattenMissing(groups: string[]) {
  return groups.flatMap((group) => group.split(" or ").map((name) => name.trim()));
}

function statusFrom(mode: string, missingEnv: string[], liveBlocked: boolean): ProviderReadinessStatus {
  if (mode === "disabled") return "disabled";
  if (!supportedModes.includes(mode as ProviderMode) && !["production", "live"].includes(mode)) return "invalid_mode";
  if (liveBlocked) return "production_blocked";
  if (missingEnv.length) return "missing_env";
  if (mode === "sandbox" || mode === "test" || mode === "mock") return "sandbox_ready";
  return "configured";
}

function paymentStatus(): ProviderConfigurationStatus {
  const mode = normalizeProviderMode(process.env.PAYMENT_MODE, "disabled");
  const provider = process.env.PAYMENT_PROVIDER || "not_selected";
  const missing = flattenMissing(getProviderMissingConfiguration("payment", provider));
  const required = ["PAYMENT_PROVIDER", "PAYMENT_WEBHOOK_SECRET", "PAYMENT_SUCCESS_URL", "PAYMENT_CANCEL_URL"];
  const missingEnv = Array.from(new Set([...missing, ...required.filter((name) => !process.env[name])]));
  const modeRequiresSecret = mode === "production" || mode === "live";
  const liveBlocked = modeRequiresSecret && (!process.env.PAYMENT_WEBHOOK_SECRET || missingEnv.length > 0);
  return {
    type: "payment",
    provider,
    mode,
    supportedModes,
    requiredEnv: Array.from(new Set([...required, "PAYMENT_API_KEY", "PAYMENT_PUBLIC_KEY", "TRANZILA_TERMINAL", "MESHULAM_API_KEY", "CARDCOM_TERMINAL", "PELECARD_TERMINAL"])),
    missingEnv,
    webhookUrl: url("/api/webhooks/payment"),
    callbackUrl: url("/dashboard/garden/subscription"),
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: true,
    healthCheckAvailable: true,
    logsAvailable: true,
    status: statusFrom(mode, missingEnv, liveBlocked),
    blockers: liveBlocked ? ["Live payment mode requires provider credentials and PAYMENT_WEBHOOK_SECRET."] : missingEnv.length ? ["Payment provider is not fully configured."] : []
  };
}

function invoiceStatus(): ProviderConfigurationStatus {
  const mode = normalizeProviderMode(process.env.INVOICE_MODE, "mock");
  const provider = process.env.INVOICE_PROVIDER || "not_selected";
  const missing = flattenMissing(getProviderMissingConfiguration("invoice", provider));
  const required = ["INVOICE_PROVIDER", "INVOICE_API_KEY", "INVOICE_WEBHOOK_SECRET"];
  const missingEnv = Array.from(new Set([...missing, ...required.filter((name) => !process.env[name])]));
  const liveBlocked = (mode === "production" || mode === "live") && (!process.env.INVOICE_WEBHOOK_SECRET || missingEnv.length > 0);
  return {
    type: "invoice",
    provider,
    mode,
    supportedModes,
    requiredEnv: required,
    missingEnv,
    webhookUrl: url("/api/webhooks/invoice"),
    callbackUrl: null,
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: true,
    healthCheckAvailable: true,
    logsAvailable: true,
    status: statusFrom(mode, missingEnv, liveBlocked),
    blockers: liveBlocked ? ["Production invoice mode requires provider credentials and INVOICE_WEBHOOK_SECRET."] : missingEnv.length ? ["Invoice provider is not fully configured."] : []
  };
}

function emailStatus(): ProviderConfigurationStatus {
  const readiness = getEmailProductionReadiness();
  const mode = normalizeProviderMode(process.env.EMAIL_MODE || process.env.COMMUNICATIONS_SEND_MODE, "mock");
  const missing = readiness.missing;
  return {
    type: "email",
    provider: readiness.provider,
    mode,
    supportedModes,
    requiredEnv: ["EMAIL_PROVIDER", "EMAIL_API_KEY", "EMAIL_FROM", "EMAIL_FROM_ADDRESS", "EMAIL_REPLY_TO", "RESEND_API_KEY", "SENDGRID_API_KEY"],
    missingEnv: missing,
    webhookUrl: process.env.EMAIL_PROVIDER === "sendgrid" ? url("/api/webhooks/email/sendgrid") : process.env.EMAIL_PROVIDER === "resend" ? url("/api/webhooks/email/resend") : null,
    callbackUrl: null,
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: true,
    healthCheckAvailable: true,
    logsAvailable: true,
    status: missing.length ? "missing_env" : "sandbox_ready",
    blockers: missing.length ? ["Email provider is not fully configured."] : []
  };
}

function smsStatus(): ProviderConfigurationStatus {
  const readiness = getSmsProductionReadiness();
  const mode = normalizeProviderMode(process.env.SMS_MODE || process.env.COMMUNICATIONS_SEND_MODE, "mock");
  return {
    type: "sms",
    provider: readiness.provider,
    mode,
    supportedModes,
    requiredEnv: ["SMS_PROVIDER", "SMS_MODE", "SMS_API_KEY", "SMS_SENDER_ID", "SMS_WEBHOOK_SECRET", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "VONAGE_API_KEY", "VONAGE_API_SECRET"],
    missingEnv: readiness.missing,
    webhookUrl: url("/api/webhooks/sms/delivery"),
    callbackUrl: null,
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: true,
    healthCheckAvailable: true,
    logsAvailable: true,
    status: readiness.missing.length ? "missing_env" : "sandbox_ready",
    blockers: readiness.missing.length ? ["SMS provider is not fully configured."] : []
  };
}

function whatsAppStatus(): ProviderConfigurationStatus {
  const readiness = getWhatsAppProductionReadiness();
  const mode = normalizeProviderMode(process.env.WHATSAPP_MODE || process.env.COMMUNICATIONS_SEND_MODE, "mock");
  return {
    type: "whatsapp",
    provider: readiness.provider,
    mode,
    supportedModes,
    requiredEnv: ["WHATSAPP_PROVIDER", "WHATSAPP_MODE", "WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID", "META_WHATSAPP_TOKEN", "TWILIO_WHATSAPP_TOKEN"],
    missingEnv: readiness.missing,
    webhookUrl: readiness.provider === "meta_whatsapp_business" ? url("/api/webhooks/whatsapp/meta") : readiness.provider === "twilio_whatsapp" ? url("/api/webhooks/whatsapp/twilio") : null,
    callbackUrl: null,
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: true,
    healthCheckAvailable: true,
    logsAvailable: true,
    status: readiness.missing.length ? "missing_env" : "sandbox_ready",
    blockers: readiness.missing.length ? ["WhatsApp provider is not fully configured."] : []
  };
}

function pushStatus(): ProviderConfigurationStatus {
  const readiness = getPushProductionReadiness();
  const modes = getIntegrationSafetyModes();
  const missing = Object.values(readiness.missingByProvider).flat();
  return {
    type: "push",
    provider: process.env.PUSH_PROVIDER || "mock_push",
    mode: modes.push,
    supportedModes,
    requiredEnv: ["PUSH_PROVIDER", "PUSH_MODE", "FCM_PROJECT_ID", "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY", "FCM_SERVER_KEY", "APNS_KEY_ID", "APNS_TEAM_ID", "APNS_BUNDLE_ID", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
    missingEnv: Array.from(new Set(missing)),
    webhookUrl: process.env.PUSH_PROVIDER ? url("/api/webhooks/push/feedback") : null,
    callbackUrl: null,
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: true,
    healthCheckAvailable: true,
    logsAvailable: true,
    status: readiness.configured ? "sandbox_ready" : "missing_env",
    blockers: readiness.configured ? [] : ["Push provider is not fully configured; real-device QA remains pending."]
  };
}

function simpleInfrastructureStatus(type: "supabase" | "vercel"): ProviderConfigurationStatus {
  const required = type === "supabase"
    ? ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    : ["VERCEL_URL", "NEXT_PUBLIC_APP_URL", "APP_URL"];
  const configured = type === "supabase"
    ? required.every((name) => Boolean(process.env[name]))
    : hasAny(required);
  return {
    type,
    provider: type,
    mode: configured ? "production" : "disabled",
    supportedModes,
    requiredEnv: required,
    missingEnv: configured ? [] : required.filter((name) => !process.env[name]),
    webhookUrl: null,
    callbackUrl: null,
    sandboxSupported: true,
    productionSupported: true,
    testActionAvailable: false,
    healthCheckAvailable: true,
    logsAvailable: type === "supabase",
    status: configured ? "configured" : "missing_env",
    blockers: configured ? [] : [`${type} environment is not fully configured.`]
  };
}

export function getProviderActivationInventory() {
  return [
    paymentStatus(),
    invoiceStatus(),
    emailStatus(),
    smsStatus(),
    whatsAppStatus(),
    pushStatus(),
    simpleInfrastructureStatus("supabase"),
    simpleInfrastructureStatus("vercel")
  ];
}
