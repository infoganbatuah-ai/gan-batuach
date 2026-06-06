import { maskPhone } from "@/lib/domain/communication-service";

export type WhatsAppProviderName = "meta_whatsapp_business" | "twilio_whatsapp" | "mock_whatsapp" | "custom";
export type WhatsAppDeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";
export type WhatsAppEventType =
  | "registration"
  | "verification"
  | "parent_approval"
  | "child_approval"
  | "payment_reminder"
  | "safety_alert"
  | "inspection_alert";

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  language: string;
  variables?: Record<string, string | number | null | undefined>;
  eventType: WhatsAppEventType;
  metadata?: Record<string, unknown>;
};

export type WhatsAppProviderResult = {
  status: WhatsAppDeliveryStatus;
  provider: WhatsAppProviderName;
  providerMessageId?: string | null;
  failureReason?: string | null;
  dryRunPayload?: unknown;
};

export type WhatsAppProvider = {
  name: WhatsAppProviderName;
  checkReadiness: () => WhatsAppProviderReadiness;
  sendTemplate: (message: WhatsAppTemplateMessage) => Promise<WhatsAppProviderResult>;
};

export type WhatsAppProviderReadiness = {
  configured: boolean;
  mode: "mock" | "dry_run" | "real_disabled";
  provider: WhatsAppProviderName;
  missing: string[];
  canSendRealMessages: false;
  summary: string;
};

function variablesToComponents(variables?: WhatsAppTemplateMessage["variables"]) {
  const values = Object.values(variables ?? {}).filter((value) => value !== null && value !== undefined);
  if (!values.length) return [];
  return [{
    type: "body",
    parameters: values.map((value) => ({ type: "text", text: String(value) }))
  }];
}

export function buildMetaWhatsAppTemplatePayload(message: WhatsAppTemplateMessage) {
  return {
    messaging_product: "whatsapp",
    to: message.to,
    type: "template",
    template: {
      name: message.templateName,
      language: { code: message.language || "he" },
      components: variablesToComponents(message.variables)
    }
  };
}

function getMetaReadiness(): WhatsAppProviderReadiness {
  const envVars: Array<[string, string | undefined]> = [
    ["WHATSAPP_ACCESS_TOKEN", process.env.WHATSAPP_ACCESS_TOKEN],
    ["WHATSAPP_PHONE_NUMBER_ID", process.env.WHATSAPP_PHONE_NUMBER_ID],
    ["WHATSAPP_BUSINESS_ACCOUNT_ID", process.env.WHATSAPP_BUSINESS_ACCOUNT_ID]
  ];
  const missing = envVars.filter(([, value]) => !value).map(([key]) => key);
  const configured = missing.length === 0;
  return {
    configured,
    mode: configured ? "dry_run" : "mock",
    provider: "meta_whatsapp_business",
    missing,
    canSendRealMessages: false,
    summary: configured
      ? "Meta WhatsApp Business credentials are present, but real sending is disabled by product policy."
      : "Meta WhatsApp Business is not fully configured. Mock mode is active."
  };
}

const mockWhatsAppProvider: WhatsAppProvider = {
  name: "mock_whatsapp",
  checkReadiness() {
    return {
      configured: true,
      mode: "mock",
      provider: "mock_whatsapp",
      missing: [],
      canSendRealMessages: false,
      summary: "Mock WhatsApp provider is active. No real messages are sent."
    };
  },
  async sendTemplate(message) {
    return {
      status: "queued",
      provider: "mock_whatsapp",
      providerMessageId: `mock_wa_${Date.now()}`,
      dryRunPayload: {
        to: maskPhone(message.to),
        templateName: message.templateName,
        language: message.language,
        eventType: message.eventType
      }
    };
  }
};

const metaWhatsAppProvider: WhatsAppProvider = {
  name: "meta_whatsapp_business",
  checkReadiness: getMetaReadiness,
  async sendTemplate(message) {
    const readiness = getMetaReadiness();
    const payload = buildMetaWhatsAppTemplatePayload(message);
    return {
      status: readiness.configured ? "queued" : "failed",
      provider: "meta_whatsapp_business",
      providerMessageId: readiness.configured ? `dry_run_meta_wa_${Date.now()}` : null,
      failureReason: readiness.configured ? null : `Missing ${readiness.missing.join(", ")}`,
      dryRunPayload: payload
    };
  }
};

const twilioWhatsAppProvider: WhatsAppProvider = {
  name: "twilio_whatsapp",
  checkReadiness() {
    const required: Array<[string, string | undefined]> = [
      ["TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID],
      ["TWILIO_AUTH_TOKEN", process.env.TWILIO_AUTH_TOKEN],
      ["TWILIO_WHATSAPP_FROM", process.env.TWILIO_WHATSAPP_FROM]
    ];
    const missing = required.filter(([, value]) => !value).map(([key]) => key);
    return {
      configured: missing.length === 0,
      mode: missing.length === 0 ? "dry_run" : "mock",
      provider: "twilio_whatsapp",
      missing,
      canSendRealMessages: false,
      summary: missing.length === 0
        ? "Twilio WhatsApp credentials are present, but real sending is disabled by product policy."
        : "Twilio WhatsApp is not fully configured. Mock mode is active."
    };
  },
  async sendTemplate(message) {
    const readiness = this.checkReadiness();
    return {
      status: readiness.configured ? "queued" : "failed",
      provider: "twilio_whatsapp",
      providerMessageId: readiness.configured ? `dry_run_twilio_wa_${Date.now()}` : null,
      failureReason: readiness.configured ? null : `Missing ${readiness.missing.join(", ")}`,
      dryRunPayload: {
        provider: "twilio_whatsapp",
        to: maskPhone(message.to),
        templateName: message.templateName,
        eventType: message.eventType
      }
    };
  }
};

export function getWhatsAppProvider(provider = process.env.WHATSAPP_PROVIDER): WhatsAppProvider {
  if (provider === "meta" || provider === "meta_whatsapp_business") return metaWhatsAppProvider;
  if (provider === "twilio" || provider === "twilio_whatsapp") return twilioWhatsAppProvider;
  return mockWhatsAppProvider;
}

export function getWhatsAppProductionReadiness() {
  const provider = getWhatsAppProvider();
  return provider.checkReadiness();
}
