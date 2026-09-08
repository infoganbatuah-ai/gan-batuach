export type EdgeUpdateProfile = "SOFTWARE_CONNECTOR" | "PHYSICAL_GATEWAY" | "ENTERPRISE_EDGE";
export type EdgeUpdateChannel = "INTERNAL" | "CANARY" | "STABLE";
export type EdgeUpdateManifest = Record<string, unknown> & { release_id: string; version: string; build_sha: string; profile: EdgeUpdateProfile; platform: string; architecture: "arm64" | "x64"; channel: EdgeUpdateChannel; signature: string };
export function validateEdgeUpdateManifest(input: unknown): EdgeUpdateManifest;
export function verifyEdgeUpdateManifest(input: unknown, trustedPublicKeys: Record<string, string>): { ok: true; manifest: EdgeUpdateManifest } | { ok: false; reason: string };
export function evaluateEdgeUpdateEligibility(manifest: EdgeUpdateManifest, device: Record<string, unknown>): { eligible: boolean; reason: string };
export function shouldPauseRollout(input: { failedCanaries: number; unhealthyCanaries: number; failureThreshold?: number }): boolean;
