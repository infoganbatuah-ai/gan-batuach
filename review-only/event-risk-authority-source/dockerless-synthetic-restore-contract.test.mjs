import test from "node:test";
import assert from "node:assert/strict";
import { COMPONENT_FILES } from "./component-restore-preflight.mjs";
import { createSyntheticRestoreContract, advanceSyntheticRestore, failSyntheticRestore,
  cleanupFailedSyntheticRestore, activateRealDockerlessRestore } from "./dockerless-synthetic-restore-contract.mjs";

const archiveSha256 = "a".repeat(64);
const recipientSha256 = "b".repeat(64);
const tenantId = "synthetic-tenant-a";
const siteId = "synthetic-site-a";
const guestId = "synthetic-guest-one";
const componentIds = Object.keys(COMPONENT_FILES);
const initial = () => createSyntheticRestoreContract({ archiveSha256, recipientSha256, tenantId, siteId });
const proof = step => ({
  SOURCE_VERIFIED: { independentSource: true, archiveSha256, componentIds },
  ISOLATION_VERIFIED: { guestId, encryptedGuestDisk: true, noHostMounts: true,
    noProxyEnv: true, noExistingDatabases: true, noExistingVolumes: true,
    noHomeOrProductionRoute: true },
  EGRESS_LOCKED: { guestId, ipv4Drop: true, ipv6Drop: true, forwardDrop: true,
    ipv4ProbeDenied: true, ipv6ProbeDenied: true, dnsProbeDenied: true,
    persistsAfterRestart: true },
  ARCHIVE_STAGED: { guestId, archiveSha256, guestLocalOnly: true },
  PRIVATE_SCRATCH_CREATED: { newEmptyScratch: true, mode0700: true,
    noHostMounts: true, noExistingDatabaseOrVolume: true, capacityChecked: true },
  POSTGRES_STARTED: { nonroot: true, unixSocketOnly: true, tcpDisabled: true,
    newCluster: true, noExistingDatabaseUsed: true },
  FIVE_COMPONENTS_VERIFIED: { componentIds, recipientSha256,
    ciphertextHashesMatchReceipt: true, ageAuthenticationPassed: true },
  GLOBALS_RESTORED: { rolesVerified: true },
  DATABASES_RESTORED: { databaseNames: ["_supabase", "gan_batuach_baseline_builder_v2", "postgres"],
    singleTransactionPerDatabase: true },
  STORAGE_RESTORED: { metadataMatchesObjectBytes: true },
  AUTH_ACL_OWNERSHIP_CHECKED: { tenantId, siteId, authVerified: true, rlsVerified: true,
    roleGrantsVerified: true, migrationHistoryVerified: true, crossTenantDenied: true,
    crossSiteDenied: true },
  RECEIPT_COMPARED: { archiveSha256, recipientSha256, tenantId, siteId,
    fiveComponentDigestsMatch: true },
  CLEANED: { postgresStopped: true, guestPlaintextRemoved: true, scratchRemoved: true,
    noResidualDatabase: true, noResidualVolume: true },
})[step];
const p = step => ({ kind: "synthetic-fixture", ...proof(step) });
function through(...steps) {
  return steps.reduce((state, step) => advanceSyntheticRestore(state, step, p(step)), initial());
}
const source = "SOURCE_VERIFIED";
const isolated = "ISOLATION_VERIFIED";
const locked = "EGRESS_LOCKED";
const staged = "ARCHIVE_STAGED";
const scratch = "PRIVATE_SCRATCH_CREATED";
const started = "POSTGRES_STARTED";

test("all synthetic transitions finish without returning a restore PASS", () => {
  const state = through(source, isolated, locked, staged, scratch, started,
    "FIVE_COMPONENTS_VERIFIED", "GLOBALS_RESTORED", "DATABASES_RESTORED",
    "STORAGE_RESTORED", "AUTH_ACL_OWNERSHIP_CHECKED", "RECEIPT_COMPARED", "CLEANED");
  assert.equal(state.outcome, "SYNTHETIC_SEQUENCE_ONLY_NOT_RESTORE_PASS");
  assert.throws(() => advanceSyntheticRestore(state, source, p(source)));
});

test("egress lock must precede archive transfer", () => {
  const state = through(source, isolated);
  assert.throws(() => advanceSyntheticRestore(state, staged, p(staged)), /OUT_OF_ORDER/);
  assert.throws(() => advanceSyntheticRestore(state, locked,
    { ...p(locked), dnsProbeDenied: false }), /EGRESS_dnsProbeDenied_UNPROVEN/);
});

test("unverified archive source and recipient are rejected", () => {
  assert.throws(() => advanceSyntheticRestore(initial(), source,
    { ...p(source), independentSource: false }), /INDEPENDENT_SOURCE/);
  assert.throws(() => advanceSyntheticRestore(initial(), source,
    { ...p(source), archiveSha256: "c".repeat(64) }), /ARCHIVE_DIGEST/);
  const state = through(source, isolated, locked, staged, scratch, started);
  assert.throws(() => advanceSyntheticRestore(state, "FIVE_COMPONENTS_VERIFIED",
    { ...p("FIVE_COMPONENTS_VERIFIED"), recipientSha256: "c".repeat(64) }), /RECIPIENT/);
});

test("host mounts and Home or Production route fail closed", () => {
  const state = through(source);
  for (const field of ["noHostMounts", "noHomeOrProductionRoute", "noExistingVolumes"])
    assert.throws(() => advanceSyntheticRestore(state, isolated,
      { ...p(isolated), [field]: false }), /ISOLATION_/);
});

test("existing database and non-private scratch are forbidden", () => {
  const state = through(source, isolated, locked, staged);
  for (const field of ["newEmptyScratch", "mode0700", "noExistingDatabaseOrVolume"])
    assert.throws(() => advanceSyntheticRestore(state, scratch,
      { ...p(scratch), [field]: false }), /SCRATCH_/);
  const next = advanceSyntheticRestore(state, scratch, p(scratch));
  for (const field of ["nonroot", "unixSocketOnly", "tcpDisabled", "newCluster", "noExistingDatabaseUsed"])
    assert.throws(() => advanceSyntheticRestore(next, started,
      { ...p(started), [field]: false }), /POSTGRES_/);
});

test("all five components and three new synthetic databases are required", () => {
  const state = through(source, isolated, locked, staged, scratch, started);
  assert.throws(() => advanceSyntheticRestore(state, "FIVE_COMPONENTS_VERIFIED",
    { ...p("FIVE_COMPONENTS_VERIFIED"), componentIds: componentIds.slice(1) }), /COMPONENT_SET/);
  const globals = through(source, isolated, locked, staged, scratch, started,
    "FIVE_COMPONENTS_VERIFIED", "GLOBALS_RESTORED");
  assert.throws(() => advanceSyntheticRestore(globals, "DATABASES_RESTORED",
    { ...p("DATABASES_RESTORED"), databaseNames: ["postgres"] }), /DATABASE_SET/);
});

test("Model A tenant/site and recipient receipt mismatches fail closed", () => {
  const authState = through(source, isolated, locked, staged, scratch, started,
    "FIVE_COMPONENTS_VERIFIED", "GLOBALS_RESTORED", "DATABASES_RESTORED", "STORAGE_RESTORED");
  assert.throws(() => advanceSyntheticRestore(authState, "AUTH_ACL_OWNERSHIP_CHECKED",
    { ...p("AUTH_ACL_OWNERSHIP_CHECKED"), tenantId: "synthetic-other" }), /TENANT_MISMATCH/);
  assert.throws(() => advanceSyntheticRestore(authState, "AUTH_ACL_OWNERSHIP_CHECKED",
    { ...p("AUTH_ACL_OWNERSHIP_CHECKED"), siteId: "synthetic-other" }), /SITE_MISMATCH/);
  const receiptState = advanceSyntheticRestore(authState, "AUTH_ACL_OWNERSHIP_CHECKED",
    p("AUTH_ACL_OWNERSHIP_CHECKED"));
  assert.throws(() => advanceSyntheticRestore(receiptState, "RECEIPT_COMPARED",
    { ...p("RECEIPT_COMPARED"), recipientSha256: "c".repeat(64) }), /RECEIPT_RECIPIENT/);
});

test("cleanup proof is mandatory after restore and failure", () => {
  const completed = through(source, isolated, locked, staged, scratch, started,
    "FIVE_COMPONENTS_VERIFIED", "GLOBALS_RESTORED", "DATABASES_RESTORED",
    "STORAGE_RESTORED", "AUTH_ACL_OWNERSHIP_CHECKED", "RECEIPT_COMPARED");
  assert.throws(() => advanceSyntheticRestore(completed, "CLEANED",
    { ...p("CLEANED"), guestPlaintextRemoved: false }), /CLEANUP_/);
  const failed = failSyntheticRestore(through(source, isolated, locked, staged), "RESTORE_FAULT");
  assert.throws(() => advanceSyntheticRestore(failed, scratch, p(scratch)), /FAILED_RESTORE/);
  assert.throws(() => cleanupFailedSyntheticRestore(failed,
    { ...p("CLEANED"), noResidualDatabase: false }), /CLEANUP_/);
  assert.equal(cleanupFailedSyntheticRestore(failed, p("CLEANED")).outcome,
    "FAILED_SYNTHETIC_SEQUENCE_NOT_RESTORE_PASS");
});

test("fixture evidence cannot be silently relabeled as real proof", () => {
  assert.throws(() => advanceSyntheticRestore(initial(), source,
    { ...p(source), kind: "real-guest" }), /SYNTHETIC_PROOF_ONLY/);
  assert.throws(activateRealDockerlessRestore, /DISABLED_ATTESTOR_AND_EXTRACTOR_UNPINNED/);
});
