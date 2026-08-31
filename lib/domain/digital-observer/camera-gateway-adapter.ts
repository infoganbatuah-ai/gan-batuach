import "server-only";

import type { CameraCapabilityManifest, CameraCapabilityProbe, CameraCommandAdapter, GuardAction } from "./guard-engine";

type GatewayConfig = { baseUrl: string; secret: string; timeoutMs: number };

function config(): GatewayConfig | null {
  const baseUrl = process.env.DIGITAL_OBSERVER_COMMAND_GATEWAY_URL?.trim();
  const secret = process.env.DIGITAL_OBSERVER_COMMAND_GATEWAY_SECRET?.trim();
  if (!baseUrl || !secret) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), secret, timeoutMs: 8_000 };
}

async function gatewayRequest(path: string, body: Record<string, unknown>) {
  const current = config();
  if (!current) throw new Error("COMMAND_GATEWAY_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), current.timeoutMs);
  try {
    const response = await fetch(`${current.baseUrl}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-digital-observer-secret": current.secret },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`COMMAND_GATEWAY_HTTP_${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export function commandGatewayConfigured() { return Boolean(config()); }

export async function probeCameraCapabilities(cameraId: string): Promise<CameraCapabilityProbe> {
  const payload = await gatewayRequest(`/v1/cameras/${encodeURIComponent(cameraId)}/capabilities`, { camera_id: cameraId });
  const manifest = payload?.manifest as Partial<CameraCapabilityManifest> | undefined;
  if (!manifest || manifest.cameraId !== cameraId || manifest.source !== "gateway") throw new Error("INVALID_CAPABILITY_EVIDENCE");
  return {
    manifest: {
      ...manifest,
      cameraId,
      source: "gateway",
      capabilities: { ptz: Boolean(manifest.capabilities?.ptz), twoWayAudio: Boolean(manifest.capabilities?.twoWayAudio), siren: Boolean(manifest.capabilities?.siren), lighting: Boolean(manifest.capabilities?.lighting) }
    } as CameraCapabilityManifest,
    evidenceId: String(payload.evidence_id || ""),
    verifiedAt: String(payload.verified_at || new Date().toISOString()),
    gatewayProvider: String(payload.gateway_provider || "unknown")
  };
}

export class HttpCameraCommandAdapter implements CameraCommandAdapter {
  async execute(command: { cameraId: string; action: GuardAction; payload?: Record<string, unknown> }) {
    const result = await gatewayRequest(`/v1/cameras/${encodeURIComponent(command.cameraId)}/commands`, {
      camera_id: command.cameraId,
      action: command.action,
      payload: command.payload ?? {}
    });
    const commandId = typeof result?.command_id === "string" ? result.command_id : "";
    if (result?.acknowledged !== true || !commandId) throw new Error("COMMAND_GATEWAY_ACK_MISSING");
    return { acknowledged: true, commandId };
  }
}

export function cameraCommandAdapter() { return commandGatewayConfigured() ? new HttpCameraCommandAdapter() : null; }
