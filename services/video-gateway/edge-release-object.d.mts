import type { EdgeUpdateManifest, EdgeUpdateChannel, EdgeUpdateProfile } from "./edge-update-contract.mjs";
export const EDGE_RELEASE_BUCKET: string;
export const EDGE_RELEASE_R2_BUCKET: string;
export function edgeReleaseObjectPath(manifest: EdgeUpdateManifest): string;
export function assertEdgeReleaseObjectUrl(manifest: EdgeUpdateManifest, storageOrigin: string): string;
export function edgeReleaseScopeAllows(manifest: EdgeUpdateManifest, device: {
  deviceId: string; profile: EdgeUpdateProfile; platform: string; architecture: "arm64" | "x64";
  channel: EdgeUpdateChannel;
}): boolean;
