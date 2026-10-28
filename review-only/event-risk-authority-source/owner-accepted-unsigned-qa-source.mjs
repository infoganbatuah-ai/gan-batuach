// Review-only owner decision for one synthetic, disposable guest experiment.
// This is NOT a publisher signature, an executable attestation, or authority
// to access Development/Production data. Keep the existing runner gates closed.
import assert from "node:assert/strict";
import { RECORDED_QA_SOURCE_IDS } from "./official-qa-source-trust-review.mjs";
import { APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM,
  APPROVED_QA_ATTESTOR_SPKI_SHA256 } from "./synthetic-qa-image-input.mjs";
import { APPROVED_GUEST_ROOTFS_MATERIALIZER } from
  "./guest-rootfs-materialization-contract.mjs";

export const OWNER_SYNTHETIC_QA_APPROVAL = Object.freeze({
  receipt: "call_8983f99300f6476d9eaf15309ee44cfa",
  decision: "OWNER_ACCEPTED_UNSIGNED_SOURCE",
  scope: "ONE_LOCAL_SYNTHETIC_DISPOSABLE_GUEST_ONLY",
});

export function reviewOwnerAcceptedUnsignedQaSource({ approval, ubuntu, postgres }) {
  assert.deepEqual(approval, OWNER_SYNTHETIC_QA_APPROVAL,
    "QA_OWNER_APPROVAL_SCOPE_MISMATCH");
  assert.ok(ubuntu?.sha256 === RECORDED_QA_SOURCE_IDS.ubuntuArm64Sha256 &&
    ubuntu.bytes === RECORDED_QA_SOURCE_IDS.ubuntuArm64Bytes &&
    ubuntu.kind === "lima-base-aarch64", "QA_UBUNTU_INPUT_MISMATCH");
  assert.ok(postgres?.sha256 === RECORDED_QA_SOURCE_IDS.postgresDockerSaveSha256 &&
    postgres.bytes === RECORDED_QA_SOURCE_IDS.postgresDockerSaveBytes &&
    postgres.imageId === RECORDED_QA_SOURCE_IDS.postgresImageId &&
    postgres.architecture === "arm64" && postgres.layerCount === 29 &&
    postgres.archiveIntegrity === "STRUCTURE_AND_DIFF_IDS_VERIFIED",
  "QA_POSTGRES_INPUT_MISMATCH");
  // Recorded hashes and owner acceptance do not verify current file bytes or
  // publisher identity. A future runner must perform fresh no-follow rehashing.
  assert.equal(APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM, null,
    "QA_ORIGINAL_ATTESTOR_GATE_CHANGED");
  assert.equal(APPROVED_QA_ATTESTOR_SPKI_SHA256, null,
    "QA_ORIGINAL_ATTESTOR_GATE_CHANGED");
  assert.equal(APPROVED_GUEST_ROOTFS_MATERIALIZER, null,
    "QA_REAL_MATERIALIZER_GATE_CHANGED");
  return Object.freeze({
    status: "OWNER_ACCEPTED_UNSIGNED_SOURCE",
    scope: OWNER_SYNTHETIC_QA_APPROVAL.scope,
    publisherSignature: "NOT_PROVEN",
    currentFilesRehashed: false,
    prebootNoEgressProven: false,
    realMaterializerQualified: false,
    guestExecutionAuthorized: false,
    developmentOrProductionAuthorized: false,
  });
}
