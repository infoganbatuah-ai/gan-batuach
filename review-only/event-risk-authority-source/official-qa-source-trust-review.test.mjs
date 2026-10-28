import test from "node:test";
import assert from "node:assert/strict";
import { APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM, APPROVED_QA_ATTESTOR_SPKI_SHA256 } from "./synthetic-qa-image-input.mjs";
import { RECORDED_QA_SOURCE_IDS, reviewOfficialQaSourceFacts,
  assertOfficialQaSourceFactsAuthorizeExecution } from "./official-qa-source-trust-review.mjs";

const exact = () => ({ ...RECORDED_QA_SOURCE_IDS });

test("all matching recorded facts still cannot authorize guest execution", () => {
  const result = reviewOfficialQaSourceFacts(exact());
  assert.equal(result.recordedFactsMatch, true);
  assert.equal(result.status, "NO_GO_REVIEW_ONLY");
  assert.equal(result.originalAttestorPinned, false);
  assert.match(result.postgresTrust, /NOT_PUBLISHER_SIGNATURE/);
  assert.match(result.registryToDockerSave, /NOT_PROVEN/);
  assert.throws(() => assertOfficialQaSourceFactsAuthorizeExecution(exact()),
    /NOT_EQUIVALENT_TO_INDEPENDENT_ATTESTATION_NO_GO/);
});

test("digest, size, layer count and signing-key mismatches fail before trust review", () => {
  for (const [field, value] of [
    ["ubuntuUecFingerprint", "A".repeat(40)],
    ["ubuntuArm64Sha256", "0".repeat(64)],
    ["ubuntuArm64Bytes", 1],
    ["postgresEcrArm64ManifestDigest", `sha256:${"0".repeat(64)}`],
    ["postgresImageId", `sha256:${"0".repeat(64)}`],
    ["postgresDockerSaveSha256", "0".repeat(64)],
    ["postgresDockerSaveBytes", 1],
    ["postgresDiffIds", 28],
  ]) {
    const altered = { ...exact(), [field]: value };
    assert.deepEqual(reviewOfficialQaSourceFacts(altered).mismatchedFields, [field]);
    assert.throws(() => assertOfficialQaSourceFactsAuthorizeExecution(altered),
      /QA_SOURCE_FACT_MISMATCH_NO_GO/);
  }
});

test("claimed publisher signature and HTTPS do not change a NO-GO decision", () => {
  const claimed = { ...exact(), publisherSigned: true, httpsFetched: true,
    ownerSelfSigned: true, registryReturnedDigest: true };
  assert.equal(reviewOfficialQaSourceFacts(claimed).status, "NO_GO_REVIEW_ONLY");
  assert.throws(() => assertOfficialQaSourceFactsAuthorizeExecution(claimed), /NO_GO/);
});

test("the executable runner's separate attestor pin remains null", () => {
  assert.equal(APPROVED_QA_ATTESTOR_PUBLIC_KEY_PEM, null);
  assert.equal(APPROVED_QA_ATTESTOR_SPKI_SHA256, null);
});
