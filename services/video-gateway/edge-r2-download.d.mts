import type { EdgeUpdateManifest } from "./edge-update-contract.mjs";
export function authorizeHomeQaR2Download(manifest: EdgeUpdateManifest, config: {
  accountId: string; accessKeyId: string; secretAccessKey: string;
}): Promise<{ url: string; expires_at: string }>;
