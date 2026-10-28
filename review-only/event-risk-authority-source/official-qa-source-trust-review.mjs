// Review-only classification of already recorded public-source facts.
// No file, network, cryptographic-signature, Docker, guest, or database I/O.
// Deliberately never authorizes the executable QA runner.
import { APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM, APPROVED_QA_ATTESTOR_SPKI_SHA256,
  QA_POSTGRES_IMAGE_ID } from "./synthetic-qa-image-input.mjs";

// Source digests are recorded identifiers, not publisher signatures. A
// separately reviewed verifier must bind the actual bytes to these values.
export const RECORDED_QA_SOURCE_IDS = Object.freeze({
  ubuntuUecFingerprint: "D2EB44626FDDC30B513D5BB71A5D6C4C7DB87C81",
  ubuntuArm64Sha256: "50e24e1fb79e89116e939d90aa7738f7af48c442fa1bc2510131e0b39c50348e",
  ubuntuArm64Bytes: 616522752,
  postgresEcrArm64ManifestDigest: "sha256:e3fb2c4a4376423f4eb1f1b1d87490a4ec23bdcdb97d3fc29e691f5a3c4abd9d",
  postgresImageId: QA_POSTGRES_IMAGE_ID,
  postgresDockerSaveSha256: "51c3b993f6ec02b579665fcd56c4f126107dd474e97f6fcf723e66c703c30e27",
  postgresDockerSaveBytes: 1330063360,
  postgresDiffIds: 29,
});

export function reviewOfficialQaSourceFacts(recorded) {
  const mismatch = [];
  for (const [field, expected] of Object.entries(RECORDED_QA_SOURCE_IDS)) {
    if (recorded?.[field] !== expected) mismatch.push(field);
  }
  // A registry digest identifies manifest bytes. It is not a digital
  // signature or a proof of who published those bytes. Docker-save keeps
  // uncompressed layer diff IDs, not the registry's compressed blob bytes.
  return Object.freeze({
    status: "NO_GO_REVIEW_ONLY",
    recordedFactsMatch: mismatch.length === 0,
    mismatchedFields: Object.freeze(mismatch),
    ubuntuTrust: "SIGNED_SUMS_MAY_BE_VERIFIABLE_SEPARATELY_NOT_REVERIFIED_HERE",
    postgresTrust: "REGISTRY_DIGEST_AND_LOCAL_HASH_NOT_PUBLISHER_SIGNATURE",
    registryToDockerSave: "COMPRESSED_BLOB_BINDING_NOT_PROVEN_FROM_DOCKER_SAVE",
    originalAttestorPinned: APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM !== null ||
      APPROVED_QA_ATTESTOR_SPKI_SHA256 !== null,
    realExtractor: "SEPARATE_PYTHON_GATE_CURRENTLY_NONE_NOT_EVALUATED_HERE",
  });
}

export function assertOfficialQaSourceFactsAuthorizeExecution(recorded) {
  const review = reviewOfficialQaSourceFacts(recorded);
  if (!review.recordedFactsMatch) throw new Error("QA_SOURCE_FACT_MISMATCH_NO_GO");
  throw new Error("QA_SOURCE_CHAIN_NOT_EQUIVALENT_TO_INDEPENDENT_ATTESTATION_NO_GO");
}
