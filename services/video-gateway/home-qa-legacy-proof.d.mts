import type { KeyObject } from "node:crypto";
export type HomeQaLegacyClaim = {
  device_id: string; enrollment_id: string; site_id: string; tenant_id: string;
  profile: "SOFTWARE_CONNECTOR" | "PHYSICAL_GATEWAY"; platform: "darwin";
  architecture: "arm64"; channel: "HOME_QA"; current_version: string;
  config_version: number; release_id: string; timestamp: string; nonce: string;
};
export declare function deriveHomeQaLegacyProofKey(input: {
  localSigningSecret: string; device_id: string; enrollment_id: string;
  site_id: string; tenant_id: string; profile: HomeQaLegacyClaim["profile"];
}): { privateKey: KeyObject; publicKeySpki: string };
export declare function canonicalHomeQaLegacyProof(claim: HomeQaLegacyClaim): string;
export declare function signHomeQaLegacyProof(claim: HomeQaLegacyClaim, privateKey: KeyObject): string;
export declare function verifyHomeQaLegacyProof(claim: HomeQaLegacyClaim, signature: string,
  publicKeySpki: string, now?: number): boolean;
