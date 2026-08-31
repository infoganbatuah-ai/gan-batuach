import "server-only";

import { z } from "zod";
import type { CameraCapabilityProbe, CameraCommand, CameraCommandAdapter, CameraCommandResult } from "./guard-engine";
import { assertFreshCapabilityProbe } from "./camera-command-policy";

type GatewayConfig = { baseUrl: string; secret: string; timeoutMs: number };

function config(): GatewayConfig | null {
  const baseUrl = process.env.DIGITAL_OBSERVER_COMMAND_GATEWAY_URL?.trim();
  const secret = process.env.DIGITAL_OBSERVER_COMMAND_GATEWAY_SECRET?.trim();
  if (!baseUrl || !secret) return null;
  const url = new URL(baseUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) || url.username || url.password || url.search || url.hash) throw new Error("COMMAND_GATEWAY_INSECURE_URL");
  return { baseUrl: url.href.replace(/\/$/, ""), secret, timeoutMs: 8_000 };
}

async function gatewayRequest(path: string, body: Record<string, unknown>) {
  const current = config();
  if (!current) throw new Error("COMMAND_GATEWAY_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), current.timeoutMs);
  try {
    const response = await fetch(`${current.baseUrl}${path}`, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-digital-observer-secret": current.secret },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`COMMAND_GATEWAY_HTTP_${response.status}`);
    return { payload: await response.json(), status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

export function commandGatewayConfigured() { return Boolean(config()); }

const probeSchema = z.object({
  evidence_id: z.string().trim().min(1).max(160),
  verified_at: z.string().datetime(),
  gateway_provider: z.string().trim().min(1).max(100),
  manifest: z.object({
    cameraId: z.string().uuid(), cameraZoneName: z.string().trim().min(1).max(200),
    discoveredAt: z.string().datetime(), source: z.literal("gateway"),
    capabilities: z.object({ ptz: z.boolean(), twoWayAudio: z.boolean(), siren: z.boolean(), lighting: z.boolean() }),
    details: z.record(z.string(), z.object({ supported: z.boolean(), apiEndpoint: z.string().optional(), states: z.array(z.string()).optional(), axes: z.array(z.string()).optional(), requiresConfirmation: z.boolean().optional() })).optional()
  })
});

export async function probeCameraCapabilities(cameraId: string): Promise<CameraCapabilityProbe> {
  const response = await gatewayRequest(`/v1/cameras/${encodeURIComponent(cameraId)}/capabilities`, { camera_id: cameraId });
  const parsed = probeSchema.safeParse(response.payload);
  if (!parsed.success) throw new Error("INVALID_CAPABILITY_EVIDENCE");
  const probe: CameraCapabilityProbe = {
    manifest: parsed.data.manifest,
    evidenceId: parsed.data.evidence_id,
    verifiedAt: parsed.data.verified_at,
    gatewayProvider: parsed.data.gateway_provider,
    gatewayHttpStatus: response.status
  };
  assertFreshCapabilityProbe(probe, cameraId);
  return probe;
}

export class HttpCameraCommandAdapter implements CameraCommandAdapter {
  async execute(command: CameraCommand): Promise<CameraCommandResult> {
    if (Date.parse(command.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(command.expiresAt))) throw new Error("COMMAND_EXPIRED");
    const response = await gatewayRequest(`/v1/cameras/${encodeURIComponent(command.cameraId)}/commands`, {
      camera_id: command.cameraId,
      action: command.action,
      payload: command.payload,
      request_id: command.requestId,
      expires_at: command.expiresAt
    });
    const result = response.payload;
    const commandId = typeof result?.command_id === "string" ? result.command_id : "";
    if (result?.acknowledged !== true || !commandId.trim() || result.request_id !== command.requestId || result.camera_id !== command.cameraId
      || !["acknowledged", "executed"].includes(result.state)) throw new Error("COMMAND_GATEWAY_ACK_MISSING");
    return { acknowledged: true, commandId, state: result.state, gatewayHttpStatus: response.status };
  }
}

export function mockCameraCapabilityProbe(camera: {
  id: string;
  displayName?: string | null;
  capabilities?: Record<string, unknown> | null;
}): CameraCapabilityProbe {
  const values = camera.capabilities ?? {};
  const enabled = (key: string) => values[key] === undefined || values[key] === true || (values[key] as any)?.supported === true;
  const now = new Date().toISOString();
  return {
    evidenceId: `mock-evidence-${camera.id}`,
    verifiedAt: now,
    gatewayProvider: "local-demo-gateway",
    manifest: {
      cameraId: camera.id,
      cameraZoneName: camera.displayName?.trim() || "מצלמת דמו",
      discoveredAt: now,
      source: "simulated",
      capabilities: { ptz: enabled("ptz"), twoWayAudio: enabled("twoWayAudio") || enabled("talk"), siren: enabled("siren"), lighting: enabled("lighting") || enabled("light") },
      details: {
        ptz: { supported: enabled("ptz"), apiEndpoint: "/control/ptz", axes: ["pan", "tilt", "zoom"] },
        twoWayAudio: { supported: enabled("twoWayAudio") || enabled("talk"), apiEndpoint: "/control/audio" },
        siren: { supported: enabled("siren"), apiEndpoint: "/control/siren" },
        lighting: { supported: enabled("lighting") || enabled("light"), apiEndpoint: "/control/light", states: ["on", "off", "dim"] }
      }
    }
  };
}

export function cameraCommandAdapter() { return commandGatewayConfigured() ? new HttpCameraCommandAdapter() : null; }
