import test from "node:test";
import assert from "node:assert/strict";
import { RECORDED_QA_SOURCE_IDS } from "./official-qa-source-trust-review.mjs";
import { OWNER_SYNTHETIC_QA_APPROVAL,
  reviewOwnerAcceptedUnsignedQaSource } from "./owner-accepted-unsigned-qa-source.mjs";

const exact = () => ({ approval: { ...OWNER_SYNTHETIC_QA_APPROVAL },
  ubuntu: { kind: "lima-base-aarch64",
    sha256: RECORDED_QA_SOURCE_IDS.ubuntuArm64Sha256,
    bytes: RECORDED_QA_SOURCE_IDS.ubuntuArm64Bytes },
  postgres: { sha256: RECORDED_QA_SOURCE_IDS.postgresDockerSaveSha256,
    bytes: RECORDED_QA_SOURCE_IDS.postgresDockerSaveBytes,
    imageId: RECORDED_QA_SOURCE_IDS.postgresImageId,
    architecture: "arm64", layerCount: 29,
    archiveIntegrity: "STRUCTURE_AND_DIFF_IDS_VERIFIED" } });

test("exact owner-accepted source is synthetic-only and cannot boot", () => {
  const decision = reviewOwnerAcceptedUnsignedQaSource(exact());
  assert.equal(decision.status, "OWNER_ACCEPTED_UNSIGNED_SOURCE");
  assert.equal(decision.publisherSignature, "NOT_PROVEN");
  assert.equal(decision.currentFilesRehashed, false);
  assert.equal(decision.prebootNoEgressProven, false);
  assert.equal(decision.realMaterializerQualified, false);
  assert.equal(decision.guestExecutionAuthorized, false);
  assert.equal(decision.developmentOrProductionAuthorized, false);
});

test("another receipt or broader approval scope is rejected", () => {
  for (const approval of [
    { ...OWNER_SYNTHETIC_QA_APPROVAL, receipt: "self-asserted" },
    { ...OWNER_SYNTHETIC_QA_APPROVAL, scope: "DEVELOPMENT" },
    { ...OWNER_SYNTHETIC_QA_APPROVAL, decision: "PUBLISHER_SIGNED" },
  ]) assert.throws(() => reviewOwnerAcceptedUnsignedQaSource({ ...exact(), approval }),
    /QA_OWNER_APPROVAL_SCOPE_MISMATCH/);
});

test("both source identities and archive structural evidence are exact", () => {
  for (const [field, value] of [["sha256", "0".repeat(64)],
    ["bytes", 1], ["kind", "other"]]) {
    const input = exact(); input.ubuntu[field] = value;
    assert.throws(() => reviewOwnerAcceptedUnsignedQaSource(input),
      /QA_UBUNTU_INPUT_MISMATCH/);
  }
  for (const [field, value] of [["sha256", "0".repeat(64)],
    ["bytes", 1], ["imageId", "other"], ["architecture", "amd64"],
    ["layerCount", 28], ["archiveIntegrity", "CLAIMED"]]) {
    const input = exact(); input.postgres[field] = value;
    assert.throws(() => reviewOwnerAcceptedUnsignedQaSource(input),
      /QA_POSTGRES_INPUT_MISMATCH/);
  }
});
