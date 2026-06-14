import { maskPhone } from "@/lib/domain/communication-service";

export type SmsProviderName = "mock_sms" | "twilio" | "messagebird" | "vonage" | "israeli_local" | "custom";
export type SmsDeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "dead_letter";
export type SmsEventType =
  | "registration_verification"
  | "password_reset"
  | "parent_approval"
  | "child_approval"
  | "safety_alert"
  | "payment_reminder"
  | "inspection_reminder";

export type SmsMessage = {
  to: string;
  body: string;
  eventType: SmsEventType;
  metadata?: Record<string, unknown>;
};

export type SmsProviderResult = {
  status: SmsDeliveryStatus;
  provider: SmsProviderName;
  providerMessageId?: string | null;
  providerReference?: string | null;
  failureReason?: string | null;
  dryRunPayload?: unknown;
};

export type SmsProviderReadiness = {
  configured: boolean;
  mode: "mock" | "dry_run" | "real_disabled";
  provider: SmsProviderName;
  missing: string[];
  canSendRealMessages: false;
  summary: string;
};

export type SmsProvider = {
  name: SmsProviderName;
  checkReadiness: () => SmsProviderReadiness;
  send: (message: SmsMessage) => Promise<SmsProviderResult>;
};

function baseReadiness(provider: SmsProviderName, required: Array<[string, string | undefined]>): SmsProviderReadiness {
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  const configured = missing.length === 0;
  return {
    configured,
    mode: configured ? "dry_run" : "mock",
    provider,
    missing,
    canSendRealMessages: false,
    summary: configured
      ? `${provider} credentials are present, but real SMS sending is disabled by product policy.`
      : `${provider} is not fully configured. Mock SMS mode is active.`
  };
}

const mockSmsProvider: SmsProvider = {
  name: "mock_sms",
  checkReadiness() {
    return {
      configured: true,
      mode: "mock",
      provider: "mock_sms",
      missing: [],
      canSendRealMessages: false,
      summary: "Mock SMS provider is active. No real SMS messages are sent."
    };
  },
  async send(message) {
    return {
      status: "queued",
      provider: "mock_sms",
      providerMessageId: `mock_sms_${Date.now()}`,
      dryRunPayload: {
        to: maskPhone(message.to),
        bodyLength: message.body.length,
        eventType: message.eventType
      }
    };
  }
};

function dryRunProvider(name: Exclude<SmsProviderName, "mock_sms" | "custom">, required: Array<[string, string | undefined]>): SmsProvider {
  return {
    name,
    checkReadiness: () => baseReadiness(name, required),
    async send(message) {
      const readiness = baseReadiness(name, required);
      return {
        status: readiness.configured ? "queued" : "failed",
        provider: name,
        providerMessageId: readiness.configured ? `dry_run_${name}_${Date.now()}` : null,
        providerReference: readiness.configured ? `dry_run_${message.eventType}` : null,
        failureReason: readiness.configured ? null : `Missing ${readiness.missing.join(", ")}`,
        dryRunPayload: {
          provider: name,
          to: maskPhone(message.to),
          body: message.body,
          eventType: message.eventType
        }
      };
    }
  };
}

export function getSmsProvider(provider = process.env.SMS_PROVIDER): SmsProvider {
  if (provider === "twilio") {
    return dryRunProvider("twilio", [
      ["TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID || process.env.SMS_PROVIDER_ACCOUNT_ID],
      ["TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN || process.env.SMS_API_KEY],
      ["SMS_SENDER_ID", process.env.SMS_SENDER_ID || process.env.SMS_FROM_NUMBER]
    ]);
  }
  if (provider === "messagebird") {
    return dryRunProvider("messagebird", [
      ["SMS_API_KEY", process.env.SMS_API_KEY],
      ["SMS_SENDER_ID", process.env.SMS_SENDER_ID || process.env.SMS_FROM_NUMBER]
    ]);
  }
  if (provider === "vonage") {
    return dryRunProvider("vonage", [
      ["VONAGE_API_KEY", process.env.VONAGE_API_KEY],
      ["VONAGE_API_SECRET", process.env.VONAGE_API_SECRET],
      ["SMS_SENDER_ID", process.env.SMS_SENDER_ID || process.env.SMS_FROM_NUMBER]
    ]);
  }
  if (provider === "israeli_local") {
    return dryRunProvider("israeli_local", [
      ["SMS_API_KEY", process.env.SMS_API_KEY],
      ["SMS_PROVIDER_ACCOUNT_ID", process.env.SMS_PROVIDER_ACCOUNT_ID],
      ["SMS_SENDER_ID", process.env.SMS_SENDER_ID || process.env.SMS_FROM_NUMBER]
    ]);
  }
  return mockSmsProvider;
}

export function getSmsProductionReadiness() {
  return getSmsProvider().checkReadiness();
}
