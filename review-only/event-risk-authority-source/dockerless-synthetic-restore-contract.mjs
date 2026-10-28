// Review-only, synthetic-fixture transition contract. No guest, filesystem, SQL or decrypt I/O.
// This module is deliberately not imported by the executable restore runner.
import assert from "node:assert/strict";
import { COMPONENT_FILES } from "./component-restore-preflight.mjs";

const SHA = /^[a-f0-9]{64}$/;
const STEPS = Object.freeze([
  "SOURCE_VERIFIED", "ISOLATION_VERIFIED", "EGRESS_LOCKED", "ARCHIVE_STAGED",
  "PRIVATE_SCRATCH_CREATED", "POSTGRES_STARTED", "FIVE_COMPONENTS_VERIFIED",
  "GLOBALS_RESTORED", "DATABASES_RESTORED", "STORAGE_RESTORED",
  "AUTH_ACL_OWNERSHIP_CHECKED", "RECEIPT_COMPARED", "CLEANED",
]);
const SYNTHETIC_DATABASES = Object.freeze([
  "_supabase", "gan_batuach_baseline_builder_v2", "postgres",
]);
const exactly = (value, expected, reason) => assert.deepEqual(value, expected, reason);
const yes = (value, reason) => assert.equal(value, true, reason);

export function createSyntheticRestoreContract({ archiveSha256, recipientSha256,
  tenantId, siteId } = {}) {
  assert.match(archiveSha256 ?? "", SHA, "SYNTHETIC_ARCHIVE_DIGEST_REQUIRED");
  assert.match(recipientSha256 ?? "", SHA, "SYNTHETIC_RECIPIENT_DIGEST_REQUIRED");
  assert.match(tenantId ?? "", /^synthetic-[a-z0-9-]+$/, "SYNTHETIC_TENANT_REQUIRED");
  assert.match(siteId ?? "", /^synthetic-[a-z0-9-]+$/, "SYNTHETIC_SITE_REQUIRED");
  return Object.freeze({ kind: "REVIEW_ONLY_SYNTHETIC_FIXTURE", phase: "INITIAL",
    archiveSha256, recipientSha256, tenantId, siteId, guestId: null,
    outcome: "NOT_A_RESTORE_RESULT", failure: null });
}

function requireEvidence(state, step, proof) {
  assert.equal(proof?.kind, "synthetic-fixture", "SYNTHETIC_PROOF_ONLY");
  switch (step) {
    case "SOURCE_VERIFIED":
      exactly(proof.archiveSha256, state.archiveSha256, "ARCHIVE_DIGEST_MISMATCH");
      exactly(proof.componentIds, Object.keys(COMPONENT_FILES), "FIVE_COMPONENT_SOURCE_REQUIRED");
      yes(proof.independentSource, "INDEPENDENT_SOURCE_UNPROVEN");
      return;
    case "ISOLATION_VERIFIED":
      assert.match(proof.guestId ?? "", /^synthetic-guest-[a-z0-9-]+$/, "GUEST_ID_REQUIRED");
      for (const field of ["encryptedGuestDisk", "noHostMounts", "noProxyEnv",
        "noExistingDatabases", "noExistingVolumes", "noHomeOrProductionRoute"])
        yes(proof[field], `ISOLATION_${field}_UNPROVEN`);
      return;
    case "EGRESS_LOCKED":
      exactly(proof.guestId, state.guestId, "EGRESS_GUEST_MISMATCH");
      for (const field of ["ipv4Drop", "ipv6Drop", "forwardDrop",
        "ipv4ProbeDenied", "ipv6ProbeDenied", "dnsProbeDenied", "persistsAfterRestart"])
        yes(proof[field], `EGRESS_${field}_UNPROVEN`);
      return;
    case "ARCHIVE_STAGED":
      exactly(proof.guestId, state.guestId, "STAGE_GUEST_MISMATCH");
      exactly(proof.archiveSha256, state.archiveSha256, "STAGED_ARCHIVE_DIGEST_MISMATCH");
      yes(proof.guestLocalOnly, "STAGE_NOT_GUEST_LOCAL");
      return;
    case "PRIVATE_SCRATCH_CREATED":
      for (const field of ["newEmptyScratch", "mode0700", "noHostMounts",
        "noExistingDatabaseOrVolume", "capacityChecked"])
        yes(proof[field], `SCRATCH_${field}_UNPROVEN`);
      return;
    case "POSTGRES_STARTED":
      for (const field of ["nonroot", "unixSocketOnly", "tcpDisabled",
        "newCluster", "noExistingDatabaseUsed"])
        yes(proof[field], `POSTGRES_${field}_UNPROVEN`);
      return;
    case "FIVE_COMPONENTS_VERIFIED":
      exactly(proof.componentIds, Object.keys(COMPONENT_FILES), "COMPONENT_SET_MISMATCH");
      exactly(proof.recipientSha256, state.recipientSha256, "RECIPIENT_MISMATCH");
      yes(proof.ciphertextHashesMatchReceipt, "CIPHERTEXT_RECEIPT_UNPROVEN");
      yes(proof.ageAuthenticationPassed, "AGE_AUTH_UNPROVEN");
      return;
    case "GLOBALS_RESTORED":
      yes(proof.rolesVerified, "GLOBALS_ROLES_UNPROVEN");
      return;
    case "DATABASES_RESTORED":
      exactly(proof.databaseNames, SYNTHETIC_DATABASES, "DATABASE_SET_MISMATCH");
      yes(proof.singleTransactionPerDatabase, "DATABASE_ATOMICITY_UNPROVEN");
      return;
    case "STORAGE_RESTORED":
      yes(proof.metadataMatchesObjectBytes, "STORAGE_BYTES_MISMATCH");
      return;
    case "AUTH_ACL_OWNERSHIP_CHECKED":
      exactly(proof.tenantId, state.tenantId, "TENANT_MISMATCH");
      exactly(proof.siteId, state.siteId, "SITE_MISMATCH");
      for (const field of ["authVerified", "rlsVerified", "roleGrantsVerified",
        "migrationHistoryVerified", "crossTenantDenied", "crossSiteDenied"])
        yes(proof[field], `AUTH_${field}_UNPROVEN`);
      return;
    case "RECEIPT_COMPARED":
      exactly(proof.archiveSha256, state.archiveSha256, "RECEIPT_ARCHIVE_MISMATCH");
      exactly(proof.recipientSha256, state.recipientSha256, "RECEIPT_RECIPIENT_MISMATCH");
      exactly(proof.tenantId, state.tenantId, "RECEIPT_TENANT_MISMATCH");
      exactly(proof.siteId, state.siteId, "RECEIPT_SITE_MISMATCH");
      yes(proof.fiveComponentDigestsMatch, "RECEIPT_COMPONENTS_UNPROVEN");
      return;
    case "CLEANED":
      for (const field of ["postgresStopped", "guestPlaintextRemoved",
        "scratchRemoved", "noResidualDatabase", "noResidualVolume"])
        yes(proof[field], `CLEANUP_${field}_UNPROVEN`);
      return;
    default: throw new Error("UNKNOWN_SYNTHETIC_RESTORE_STEP");
  }
}

export function advanceSyntheticRestore(state, step, proof) {
  assert.equal(state?.kind, "REVIEW_ONLY_SYNTHETIC_FIXTURE", "SYNTHETIC_STATE_REQUIRED");
  assert.equal(state.failure, null, "FAILED_RESTORE_REQUIRES_CLEANUP");
  assert.notEqual(state.phase, "CLEANED", "SYNTHETIC_SEQUENCE_ALREADY_CLEANED");
  const next = STEPS[STEPS.indexOf(state.phase) + 1] ?? STEPS[0];
  assert.equal(step, next, "RESTORE_STEP_OUT_OF_ORDER");
  requireEvidence(state, step, proof);
  return Object.freeze({ ...state, phase: step,
    guestId: step === "ISOLATION_VERIFIED" ? proof.guestId : state.guestId,
    outcome: step === "CLEANED" ? "SYNTHETIC_SEQUENCE_ONLY_NOT_RESTORE_PASS" : state.outcome });
}

export function failSyntheticRestore(state, failureCode) {
  assert.equal(state?.kind, "REVIEW_ONLY_SYNTHETIC_FIXTURE", "SYNTHETIC_STATE_REQUIRED");
  assert.match(failureCode ?? "", /^[A-Z][A-Z0-9_]{2,80}$/, "FAILURE_CODE_REQUIRED");
  assert.notEqual(state.phase, "CLEANED", "ALREADY_CLEANED");
  assert.equal(state.failure, null, "FAILURE_ALREADY_RECORDED");
  return Object.freeze({ ...state, phase: "FAILED_NEEDS_CLEANUP", failure: failureCode,
    outcome: "NOT_A_RESTORE_RESULT" });
}

export function cleanupFailedSyntheticRestore(state, proof) {
  assert.equal(state?.phase, "FAILED_NEEDS_CLEANUP", "NO_FAILED_RESTORE_TO_CLEAN");
  requireEvidence(state, "CLEANED", proof);
  return Object.freeze({ ...state, phase: "FAILED_CLEANED",
    outcome: "FAILED_SYNTHETIC_SEQUENCE_NOT_RESTORE_PASS" });
}

export function activateRealDockerlessRestore() {
  throw new Error("REAL_DOCKERLESS_RESTORE_DISABLED_ATTESTOR_AND_EXTRACTOR_UNPINNED");
}
