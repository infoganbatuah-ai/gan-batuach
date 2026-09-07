import "server-only";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export const connectorReleasePlatforms = ["macos-arm64", "macos-x64", "windows-x64"] as const;
export type ConnectorReleasePlatform = typeof connectorReleasePlatforms[number];

const remoteReleaseSchema = z.object({
  url: z.string().url().refine(value => value.startsWith("https://"), "HTTPS_REQUIRED"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/),
  build: z.string().regex(/^[A-Za-z0-9._-]{1,80}$/)
}).strict();

function environmentPrefix(platform: ConnectorReleasePlatform) {
  if (platform.startsWith("macos")) return "OBSERVER_CONNECTOR_MACOS";
  return "OBSERVER_CONNECTOR_WINDOWS";
}

export function connectorRelease(platform: ConnectorReleasePlatform) {
  const prefix = environmentPrefix(platform);
  const remote = remoteReleaseSchema.safeParse({ url: process.env[`${prefix}_RELEASE_URL`],
    sha256: process.env[`${prefix}_RELEASE_SHA256`], version: process.env[`${prefix}_RELEASE_VERSION`],
    build: process.env[`${prefix}_RELEASE_BUILD`] });
  if (remote.success) return { platform, available: true as const, source: "REMOTE" as const,
    filename: platform.startsWith("macos") ? "Digital-Observer-Connector.dmg" : "Digital-Observer-Connector.msi",
    ...remote.data };

  // Local artifacts are accepted only in development QA and never become a
  // serverless/public-distribution fallback accidentally.
  const localInput = process.env[`${prefix}_LOCAL_QA_PATH`] || "";
  const localPath = localInput ? resolve(/* turbopackIgnore: true */ localInput) : "";
  if (process.env.NODE_ENV === "development" && localPath && existsSync(localPath) && statSync(localPath).isFile()) {
    const bytes = readFileSync(localPath);
    return { platform, available: true as const, source: "LOCAL_QA" as const, path: localPath,
      filename: platform.startsWith("macos") ? "Digital-Observer-Connector.dmg" : "Digital-Observer-Connector.msi",
      sha256: createHash("sha256").update(bytes).digest("hex"), version: "local-qa", build: "local-qa" };
  }
  return { platform, available: false as const, source: "UNAVAILABLE" as const,
    reason: platform.startsWith("macos") ? "MACOS_DISTRIBUTION_NOT_CONFIGURED" : "WINDOWS_DISTRIBUTION_NOT_CONFIGURED" };
}
