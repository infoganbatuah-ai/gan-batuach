import { Resend } from "resend";

export type EmailProviderName = "mock_email" | "resend" | "sendgrid" | "amazon_ses" | "custom";
export type EmailDeliveryStatus = "queued" | "sent" | "delivered" | "opened" | "clicked" | "failed" | "dead_letter";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  category: string;
  metadata?: Record<string, unknown>;
};

export type EmailProviderResult = {
  status: EmailDeliveryStatus;
  provider: EmailProviderName;
  providerMessageId?: string | null;
  providerReference?: string | null;
  failureReason?: string | null;
  dryRunPayload?: unknown;
};

export type EmailProviderReadiness = {
  configured: boolean;
  mode: "mock" | "dry_run" | "real_disabled" | "production";
  provider: EmailProviderName;
  missing: string[];
  canSendRealMessages: boolean;
  summary: string;
};

export type EmailProvider = {
  name: EmailProviderName;
  checkReadiness: () => EmailProviderReadiness;
  send: (message: EmailMessage) => Promise<EmailProviderResult>;
};

function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

function baseReadiness(provider: EmailProviderName, required: Array<[string, string | undefined]>): EmailProviderReadiness {
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  const configured = missing.length === 0;
  return {
    configured,
    mode: configured ? "dry_run" : "mock",
    provider,
    missing,
    canSendRealMessages: false,
    summary: configured
      ? `${provider} credentials are present, but real email sending is disabled by product policy.`
      : `${provider} is not fully configured. Mock email mode is active.`
  };
}

function resendReadiness(): EmailProviderReadiness {
  const required: Array<[string, string | undefined]> = [
    ["RESEND_API_KEY", process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY],
    ["EMAIL_FROM_ADDRESS", process.env.EMAIL_FROM_ADDRESS]
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  const configured = missing.length === 0;
  const activationMissing = [
    process.env.COMMUNICATIONS_SEND_MODE !== "production" ? "COMMUNICATIONS_SEND_MODE=production" : null,
    process.env.EMAIL_MODE !== "production" ? "EMAIL_MODE=production" : null,
    process.env.EMAIL_REAL_SEND_ENABLED !== "true" ? "EMAIL_REAL_SEND_ENABLED=true" : null,
    process.env.PRODUCTION_ACTIVATION_APPROVED !== "true" ? "PRODUCTION_ACTIVATION_APPROVED=true" : null
  ].filter((value): value is string => Boolean(value));
  const canSendRealMessages = configured && activationMissing.length === 0;

  return {
    configured,
    mode: canSendRealMessages ? "production" : configured ? "real_disabled" : "mock",
    provider: "resend",
    missing: [...missing, ...activationMissing],
    canSendRealMessages,
    summary: canSendRealMessages
      ? "Resend is configured and production email sending is enabled."
      : configured
        ? "Resend credentials are configured, but one or more production safety gates are disabled."
        : "Resend is not fully configured. Mock email mode is active."
  };
}

function safeTagValue(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) || "general";
}

const resendEmailProvider: EmailProvider = {
  name: "resend",
  checkReadiness: resendReadiness,
  async send(message) {
    const readiness = resendReadiness();
    if (!readiness.canSendRealMessages) {
      return {
        status: readiness.configured ? "queued" : "failed",
        provider: "resend",
        providerMessageId: readiness.configured ? `dry_run_resend_${Date.now()}` : null,
        providerReference: readiness.configured ? `dry_run_${message.category}` : null,
        failureReason: readiness.configured ? null : `Missing ${readiness.missing.join(", ")}`,
        dryRunPayload: {
          provider: "resend",
          to: maskEmail(message.to),
          subject: message.subject,
          category: message.category,
          realSend: false
        }
      };
    }

    const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS!;
    const fromName = process.env.EMAIL_FROM_NAME?.trim();
    const from = fromAddress.includes("<") || !fromName ? fromAddress : `${fromName} <${fromAddress}>`;
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from,
      to: message.to,
      replyTo: process.env.EMAIL_REPLY_TO || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html || undefined,
      tags: [
        { name: "category", value: safeTagValue(message.category) },
        { name: "application", value: "gan_batuach" }
      ]
    });

    if (response.error || !response.data?.id) {
      return {
        status: "failed",
        provider: "resend",
        providerMessageId: null,
        providerReference: "resend_api_error",
        failureReason: response.error?.message || "Resend did not return a message id."
      };
    }

    return {
      status: "sent",
      provider: "resend",
      providerMessageId: response.data.id,
      providerReference: `resend_${message.category}`
    };
  }
};

const mockEmailProvider: EmailProvider = {
  name: "mock_email",
  checkReadiness() {
    return {
      configured: true,
      mode: "mock",
      provider: "mock_email",
      missing: [],
      canSendRealMessages: false,
      summary: "Mock email provider is active. No real emails are sent."
    };
  },
  async send(message) {
    return {
      status: "queued",
      provider: "mock_email",
      providerMessageId: `mock_email_${Date.now()}`,
      providerReference: "mock_queue_only",
      dryRunPayload: {
        to: maskEmail(message.to),
        subject: message.subject,
        category: message.category,
        textLength: message.text.length,
        hasHtml: Boolean(message.html)
      }
    };
  }
};

function dryRunProvider(name: Exclude<EmailProviderName, "mock_email" | "custom">, required: Array<[string, string | undefined]>): EmailProvider {
  return {
    name,
    checkReadiness: () => baseReadiness(name, required),
    async send(message) {
      const readiness = baseReadiness(name, required);
      return {
        status: readiness.configured ? "queued" : "failed",
        provider: name,
        providerMessageId: readiness.configured ? `dry_run_${name}_${Date.now()}` : null,
        providerReference: readiness.configured ? `dry_run_${message.category}` : null,
        failureReason: readiness.configured ? null : `Missing ${readiness.missing.join(", ")}`,
        dryRunPayload: {
          provider: name,
          to: maskEmail(message.to),
          subject: message.subject,
          category: message.category
        }
      };
    }
  };
}

export function getEmailProvider(provider = process.env.EMAIL_PROVIDER): EmailProvider {
  if (provider === "resend") {
    return resendEmailProvider;
  }
  if (provider === "sendgrid") {
    return dryRunProvider("sendgrid", [
      ["SENDGRID_API_KEY", process.env.SENDGRID_API_KEY || process.env.EMAIL_API_KEY],
      ["EMAIL_FROM_ADDRESS", process.env.EMAIL_FROM_ADDRESS]
    ]);
  }
  if (provider === "amazon_ses") {
    return dryRunProvider("amazon_ses", [
      ["SES_REGION", process.env.SES_REGION || process.env.AWS_SES_REGION],
      ["AWS_SES_ACCESS_KEY_ID", process.env.AWS_SES_ACCESS_KEY_ID],
      ["AWS_SES_SECRET_ACCESS_KEY", process.env.AWS_SES_SECRET_ACCESS_KEY],
      ["EMAIL_FROM_ADDRESS", process.env.EMAIL_FROM_ADDRESS]
    ]);
  }
  return mockEmailProvider;
}

export function getEmailProductionReadiness() {
  return getEmailProvider().checkReadiness();
}
