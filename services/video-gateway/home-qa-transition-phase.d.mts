import type { EdgeUpdateManifest } from "./edge-update-contract.mjs";

export const HOME_QA_PHASE: Readonly<{
  LEGACY: "LEGACY_VERIFIED_FOR_TRANSITION";
  PENDING: "MANAGED_IDENTITY_PENDING_PROOF";
  VERIFIED: "MANAGED_IDENTITY_VERIFIED";
}>;

export function homeQaManagedPhaseAllows(input: {
  enrollment: {
    gateway_id?: string | null;
    deployment_profile?: string | null;
    identity_scheme?: string | null;
    credential_version?: number | null;
    metadata?: Record<string, unknown> | null;
  };
  manifest: EdgeUpdateManifest;
}): boolean;
