import type { PushPlatform } from "./push-service";

export type PushProviderName = "mock_push" | "fcm" | "apns" | "web_push" | "custom";
export type PushDeliveryStatus = "queued" | "sent" | "delivered" | "opened" | "failed" | "dead_letter" | "sent_mock" | "queued_mock";

export type PushPayload = {
  profileId: string;
  deviceTokenId?: string | null;
  platform: PushPlatform;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  category?: string | null;
  deepLinkType?: string | null;
  metadata?: Record<string, unknown>;
};

export type PushProviderResult = {
  ok: boolean;
  status: PushDeliveryStatus;
  provider: PushProviderName;
  providerMessageId?: string | null;
  providerReference?: string | null;
  failureReason?: string | null;
  sentAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type PushProviderReadiness = {
  provider: PushProviderName;
  configured: boolean;
  canSendRealMessages: boolean;
  mode: "mock" | "dry_run" | "real";
  missing: string[];
  supportedPlatforms: PushPlatform[];
  summary: string;
};

export type PushProvider = {
  name: PushProviderName;
  getReadiness: () => PushProviderReadiness;
  send: (payload: PushPayload) => Promise<PushProviderResult>;
};

const providerPlatforms: Record<PushProviderName, PushPlatform[]> = {
  mock_push: ["web", "android", "ios"],
  fcm: ["android", "web"],
  apns: ["ios"],
  web_push: ["web"],
  custom: ["web", "android", "ios"]
};

function missingEnv(names: string[]) {
  return names.filter((name) => !process.env[name]);
}

function dryRunResult(provider: PushProviderName, payload: PushPayload, configured: boolean): PushProviderResult {
  const now = new Date().toISOString();
  return {
    ok: true,
    status: provider === "mock_push" ? "sent_mock" : "queued_mock",
    provider,
    providerMessageId: `${provider}_${Date.now()}_${(payload.deviceTokenId ?? payload.profileId).slice(0, 8)}`,
    providerReference: configured ? "dry_run_configured_no_real_send" : "mock_no_provider_credentials",
    sentAt: now,
    metadata: {
      dry_run: true,
      real_send_enabled: false,
      action_url: payload.actionUrl ?? null,
      deep_link_type: payload.deepLinkType ?? null
    }
  };
}

function createProvider(name: PushProviderName, requiredEnv: string[]): PushProvider {
  return {
    name,
    getReadiness() {
      const missing = missingEnv(requiredEnv);
      const configured = missing.length === 0;
      return {
        provider: name,
        configured,
        canSendRealMessages: false,
        mode: name === "mock_push" ? "mock" : "dry_run",
        missing,
        supportedPlatforms: providerPlatforms[name],
        summary: configured
          ? "הגדרות ספק קיימות, אך שליחה אמיתית כבויה בשלב זה."
          : "ספק Push במצב בדיקה. חסרות הגדרות להפעלה אמיתית."
      };
    },
    async send(payload) {
      const readiness = this.getReadiness();
      return dryRunResult(name, payload, readiness.configured);
    }
  };
}

const providers: Record<PushProviderName, PushProvider> = {
  mock_push: createProvider("mock_push", []),
  fcm: createProvider("fcm", ["FCM_PROJECT_ID", "FCM_SERVER_KEY"]),
  apns: createProvider("apns", ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_BUNDLE_ID"]),
  web_push: createProvider("web_push", ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]),
  custom: createProvider("custom", ["PUSH_PROVIDER_ENDPOINT", "PUSH_PROVIDER_API_KEY"])
};

export function getPushProviderForPlatform(platform: PushPlatform): PushProvider {
  const requested = (process.env.PUSH_PROVIDER || "mock_push").toLowerCase() as PushProviderName;
  if (requested in providers && providers[requested].getReadiness().supportedPlatforms.includes(platform)) {
    return providers[requested];
  }
  if (platform === "android" && providers.fcm.getReadiness().configured) return providers.fcm;
  if (platform === "ios" && providers.apns.getReadiness().configured) return providers.apns;
  if (platform === "web" && providers.web_push.getReadiness().configured) return providers.web_push;
  return providers.mock_push;
}

export function getPushProductionReadiness() {
  const readiness = Object.values(providers).map((provider) => provider.getReadiness());
  const configuredProviders = readiness.filter((provider) => provider.configured && provider.provider !== "mock_push");
  return {
    providers: readiness,
    configured: configuredProviders.length > 0,
    realSendEnabled: false,
    summary: configuredProviders.length
      ? "קיימת תצורת ספק Push, אך adapter השליחה עדיין במצב dry-run ואין שליחה אמיתית."
      : "Push פועל במצב mock בלבד. אין שליחה אמיתית.",
    missingByProvider: readiness.reduce<Record<string, string[]>>((acc, provider) => {
      acc[provider.provider] = provider.missing;
      return acc;
    }, {})
  };
}
