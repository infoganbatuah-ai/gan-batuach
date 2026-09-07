import { z } from "zod";
import { connectivityFamilyIds } from "./connectivity-registry";

export const connectorInstallVersion = "connector-install-v1";
export const connectorInstallDocumentSchema = z.object({
  version: z.literal(connectorInstallVersion), intent_id: z.string().uuid(),
  observer_site_id: z.string().uuid(), secret: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expires_at: z.string().datetime(), origin: z.literal("https://ganbatuach.com")
}).strict();
export const installIntentRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), observer_site_id: z.string().uuid(), family: z.enum(connectivityFamilyIds).default("unknown") }).strict(),
  z.object({ action: z.literal("status"), observer_site_id: z.string().uuid(), intent_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("claim"), document: connectorInstallDocumentSchema,
    enrollment_id: z.string().uuid(), poll_token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    installation_id: z.string().regex(/^edge-[a-f0-9]{32}$/),
    platform: z.enum(["macos-arm64", "macos-x64", "windows-x64"]),
    software_version: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
    build_sha: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/)
  }).strict()
]);
export function installerPlatform(userAgent: string) {
  if (/iPhone|iPad|Android|Mobile/i.test(userAgent)) return "MOBILE";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "MACOS";
  if (/Windows NT/i.test(userAgent)) return "WINDOWS";
  return "UNSUPPORTED";
}
export function installationStage(input: { state: string; expiresAt: string; enrollmentStatus?: string; heartbeatAt?: string; now?: number }) {
  const now = input.now ?? Date.now();
  if (input.enrollmentStatus === "revoked" || input.state === "CANCELLED") return "REVOKED";
  if (input.enrollmentStatus === "delivered") {
    const age = now - Date.parse(input.heartbeatAt ?? "");
    return Number.isFinite(age) && age >= 0 && age < 120000 ? "CONNECTOR_FOUND" : "WAITING_FOR_CONNECTOR";
  }
  if (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= now) return "EXPIRED";
  if (input.enrollmentStatus === "approved") return "WAITING_FOR_CONNECTOR";
  return input.state === "CLAIMED" ? "CONFIRM_COMPUTER" : "WAITING_FOR_INSTALL";
}
