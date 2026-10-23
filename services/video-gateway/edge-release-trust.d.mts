export declare const PROTECTED_EDGE_TRUST_ROOT_PATH: string;
export declare const PROTECTED_EDGE_TRUST_REGISTRY_PATH: string;
export declare function canonicalEdgeTrustRegistry(input: Record<string, unknown>): string;
export declare function verifyEdgeTrustRegistry(input: Record<string, unknown>, options: {
  pinnedRootKeyId: string; pinnedRootPublicKey: string; minimumEpoch?: number;
}): { ok: boolean; trustedPublicKeys?: Record<string, string>; reason?: string };
export declare function installEdgeTrustRegistry(options: {
  path: string; registry: Record<string, unknown> & { epoch: number };
  pinnedRootKeyId: string; pinnedRootPublicKey: string;
}): { epoch: number; trustedPublicKeys: Record<string, string> };
export declare function loadEdgeTrustRegistry(options: {
  path: string; pinnedRootKeyId: string; pinnedRootPublicKey: string;
}): { epoch: number; trustedPublicKeys: Record<string, string> };
export declare function loadPinnedEdgeReleaseKeys(options: {
  registryPath: string; rootPinPath?: string; qaOwnerAllowed?: boolean;
}): { epoch: number; trustedPublicKeys: Record<string, string>;
  root_key_id: string; root_fingerprint_sha256: string };
