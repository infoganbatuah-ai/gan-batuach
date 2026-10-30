import type { ExternalDeliveryChannel, ProviderMode, ProviderOutcome } from "./notification-orchestration";

export type ProviderRequest = {
  requestId: string;
  stableDeliveryId: string;
  channel: ExternalDeliveryChannel;
  destinationReference: string;
  title: string;
  body: string;
  productPath: string | null;
};

export type ProviderResult = {
  outcome: ProviderOutcome;
  providerMessageId: string | null;
  retryAfterSeconds: number | null;
  safeErrorCode: string | null;
  confirmedDelivery: boolean;
  usageUnits: number;
};

export interface NotificationProviderAdapter {
  readonly channel: ExternalDeliveryChannel;
  readonly mode: ProviderMode;
  readonly providerKey: string;
  send(request: ProviderRequest): Promise<ProviderResult>;
}

export class DisabledNotificationAdapter implements NotificationProviderAdapter {
  readonly mode = "disabled" as const;
  constructor(readonly channel: ExternalDeliveryChannel, readonly providerKey = "disabled") {}
  async send(): Promise<ProviderResult> {
    return { outcome: "blocked", providerMessageId: null, retryAfterSeconds: null, safeErrorCode: "PROVIDER_DISABLED", confirmedDelivery: false, usageUnits: 0 };
  }
}

export type SandboxBehavior = "success" | "timeout" | "rate_limit" | "temporary_failure" | "permanent_failure" | "unknown_outcome";

export class DeterministicSandboxAdapter implements NotificationProviderAdapter {
  readonly mode = "sandbox" as const;
  readonly providerKey: string;
  constructor(readonly channel: ExternalDeliveryChannel, readonly behavior: SandboxBehavior = "success") {
    this.providerKey = `digital-observer-sandbox-${channel}`;
  }
  async send(request: ProviderRequest): Promise<ProviderResult> {
    const successful = this.behavior === "success";
    return {
      outcome: this.behavior,
      providerMessageId: successful ? `sandbox:${this.channel}:${request.requestId}` : null,
      retryAfterSeconds: this.behavior === "rate_limit" ? 60 : null,
      safeErrorCode: successful ? null : `SANDBOX_${this.behavior.toUpperCase()}`,
      confirmedDelivery: successful,
      usageUnits: 1
    };
  }
}

export class ExplicitProductionAdapter implements NotificationProviderAdapter {
  readonly mode = "production" as const;
  constructor(
    readonly channel: ExternalDeliveryChannel,
    readonly providerKey: string,
    private readonly explicitlyActivated: boolean,
    private readonly sender?: (request: ProviderRequest) => Promise<ProviderResult>
  ) {}
  async send(request: ProviderRequest): Promise<ProviderResult> {
    if (!this.explicitlyActivated || !this.sender) {
      return { outcome: "blocked", providerMessageId: null, retryAfterSeconds: null, safeErrorCode: "PRODUCTION_NOT_AUTHORIZED", confirmedDelivery: false, usageUnits: 0 };
    }
    return this.sender(request);
  }
}

export function providerAdapter(input: { channel: ExternalDeliveryChannel; mode?: ProviderMode; providerKey?: string; sandboxBehavior?: SandboxBehavior }) {
  if (input.mode === "sandbox") return new DeterministicSandboxAdapter(input.channel, input.sandboxBehavior);
  // Production construction is intentionally unavailable through configuration alone.
  // It requires a separately owner-authorized adapter and sender implementation.
  return new DisabledNotificationAdapter(input.channel, input.providerKey);
}
