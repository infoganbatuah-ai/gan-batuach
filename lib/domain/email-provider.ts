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
  mode: "mock" | "dry_run" | "real_disabled";
  provider: EmailProviderName;
  missing: string[];
  canSendRealMessages: false;
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
    return dryRunProvider("resend", [
      ["EMAIL_API_KEY", process.env.EMAIL_API_KEY],
      ["EMAIL_FROM_ADDRESS", process.env.EMAIL_FROM_ADDRESS]
    ]);
  }
  if (provider === "sendgrid") {
    return dryRunProvider("sendgrid", [
      ["EMAIL_API_KEY", process.env.EMAIL_API_KEY],
      ["EMAIL_FROM_ADDRESS", process.env.EMAIL_FROM_ADDRESS]
    ]);
  }
  if (provider === "amazon_ses") {
    return dryRunProvider("amazon_ses", [
      ["AWS_SES_REGION", process.env.AWS_SES_REGION],
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
