import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertQualificationFailureGate, assertQualificationRunStart,
  assertQualificationServiceAvailable, buildQualificationFailureBlocker,
  qualificationCadenceAbort, sha256File } from "./qualification-run-guard.mjs";

const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

test("duplicate service and non-empty run directories fail closed", () => {
  assert.throws(() => assertQualificationServiceAvailable({ loaded: true }),
    /durable_soak_service_already_loaded/);
  const root = mkdtempSync(join(tmpdir(), "push38-run-guard-"));
  try {
    writeFileSync(join(root, "orphan.log"), "old attempt\n");
    assert.throws(() => assertQualificationRunStart({
      outputRoot: root, runId: "new-run"
    }), /durable_soak_non_empty_run_directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a vanished service without a result resumes only from exact immutable state", () => {
  const root = mkdtempSync(join(tmpdir(), "push38-resume-"));
  const runId = "durable-run";
  const startedAt = "2026-10-15T00:00:00.000Z";
  try {
    const checkpoint = { contract: "observer-reliability-checkpoint-v1",
      run_id: runId, sequence: 1, sampled_at: "2026-10-15T00:01:00.000Z" };
    writeJson(join(root, "state.json"), {
      contract: "observer-reliability-soak-state-v1", run_id: runId,
      status: "RUNNING", started_at: startedAt, started_at_ms: Date.parse(startedAt),
      checkpoint_count: 1, last_checkpoint_at: checkpoint.sampled_at
    });
    writeFileSync(join(root, "checkpoints.ndjson"), `${JSON.stringify(checkpoint)}\n`);
    assert.throws(() => assertQualificationRunStart({ outputRoot: root, runId }),
      /durable_soak_non_empty_run_directory/);
    assert.equal(assertQualificationRunStart({ outputRoot: root, runId, resume: true,
      expectedStartedAt: startedAt, expectedSequence: 1 }).mode, "VERIFIED_RESUME");
    assert.throws(() => assertQualificationRunStart({ outputRoot: root,
      runId: "new-id", resume: true, expectedStartedAt: startedAt, expectedSequence: 1 }),
    /durable_soak_resume_run_id_mismatch/);
    assert.throws(() => assertQualificationRunStart({ outputRoot: root, runId, resume: true,
      expectedStartedAt: "2026-10-15T00:00:01.000Z", expectedSequence: 1 }),
    /durable_soak_resume_started_at_mismatch/);
    assert.throws(() => assertQualificationRunStart({ outputRoot: root, runId, resume: true,
      expectedStartedAt: startedAt, expectedSequence: 2 }),
    /durable_soak_resume_sequence_mismatch/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sleep or monitor pauses abort instead of manufacturing catch-up checkpoints", () => {
  assert.equal(qualificationCadenceAbort({ scheduledAt: 0, sampledAt: 179_999,
    intervalMs: 60_000 }), null);
  const aborted = qualificationCadenceAbort({ scheduledAt: 0, sampledAt: 180_001,
    intervalMs: 60_000 });
  assert.equal(aborted.reason, "HOST_SLEEP_OR_MONITOR_PAUSE");
  assert.equal(aborted.drift_ms, 180_001);
});

test("a global failure blocker cannot be bypassed with a new run id", () => {
  const root = mkdtempSync(join(tmpdir(), "push38-failure-closure-"));
  try {
    const resultPath = join(root, "failed-result.json");
    const checkpointsPath = join(root, "failed-checkpoints.ndjson");
    writeJson(resultPath, { status: "NOT_DONE", started_at: "2026-10-14T20:44:39.452Z",
      ended_at: "2026-10-15T11:32:08.013Z",
      gate_failures: ["EXPECTED_CAMERA_AVAILABILITY_BELOW_100_PERCENT"] });
    writeFileSync(checkpointsPath, `${JSON.stringify({ run_id: "failed-v8", sequence: 156,
      sampled_at: "2026-10-14T23:19:39.454Z", dvr: { classification: "PRODUCT_FAILURE",
        available: 1, auth: "ready" }, tapo: { classification: "PASS", progressing: 1,
        auth: "ready" }, host: { pressure: "NORMAL", forbidden_workloads: [] } })}\n`);
    const blocker = buildQualificationFailureBlocker({ runId: "failed-v8", stage: "V8",
      resultPath, checkpointsPath });
    const candidateSha = "a".repeat(40);
    assert.throws(() => assertQualificationFailureGate({ blocker, closure: null,
      stage: "CANARY", candidateSha, runId: "different-new-run-id" }),
    /durable_soak_failure_closure_required/);

    const reproductionPath = join(root, "reproduction.json");
    const regressionPath = join(root, "regression.json");
    writeJson(reproductionPath, { status: "PASS", reproduced_sequence: 156 });
    writeJson(regressionPath, { status: "PASS", targeted_tests: 4 });
    const fixCommitSha = "b".repeat(40);
    const closure = {
      contract: "observer-qualification-failure-closure-v1",
      failed_run_id: "failed-v8", failed_stage: "V8",
      failure_fingerprint_sha256: blocker.failure_fingerprint.sha256,
      evidence: { result_sha256: blocker.evidence.result_sha256,
        checkpoints_sha256: blocker.evidence.checkpoints_sha256 },
      candidate_sha: candidateSha,
      reproduction: { status: "PASS", evidence_path: reproductionPath,
        evidence_sha256: sha256File(reproductionPath) },
      fix: { commit_sha: fixCommitSha, summary: "sweep ended stale-epoch finite responses" },
      regression: { status: "PASS", evidence_path: regressionPath,
        evidence_sha256: sha256File(regressionPath) },
      ci: { status: "PASS", candidate_sha: candidateSha, run_id: "fixture-ci" },
      canary: { status: "PENDING" }, pre_soak: { status: "PENDING" }
    };
    assert.equal(assertQualificationFailureGate({ blocker, closure,
      stage: "CANARY", candidateSha }).status, "PASS");
    assert.throws(() => assertQualificationFailureGate({ blocker, closure,
      stage: "PRE_SOAK", candidateSha }), /failure_closure_canary_invalid/);

    const canaryResult = join(root, "canary-result.json");
    const canaryCheckpoints = join(root, "canary-checkpoints.ndjson");
    writeJson(canaryResult, { status: "PASS", qualification_stage: "CANARY",
      elapsed_ms: 900_001 });
    writeFileSync(canaryCheckpoints, "{}\n");
    closure.canary = { status: "PASS", run_id: "canary-new",
      result_path: canaryResult, checkpoints_path: canaryCheckpoints,
      result_sha256: sha256File(canaryResult),
      checkpoints_sha256: sha256File(canaryCheckpoints) };
    assert.equal(assertQualificationFailureGate({ blocker, closure,
      stage: "PRE_SOAK", candidateSha }).status, "PASS");
    assert.throws(() => assertQualificationFailureGate({ blocker, closure,
      stage: "V8", candidateSha }), /failure_closure_pre_soak_invalid/);

    const preSoakResult = join(root, "pre-soak-result.json");
    const preSoakCheckpoints = join(root, "pre-soak-checkpoints.ndjson");
    writeJson(preSoakResult, { status: "PASS", qualification_stage: "PRE_SOAK",
      elapsed_ms: 3_600_001 });
    writeFileSync(preSoakCheckpoints, "{}\n");
    closure.pre_soak = { status: "PASS", run_id: "pre-soak-new",
      result_path: preSoakResult, checkpoints_path: preSoakCheckpoints,
      result_sha256: sha256File(preSoakResult),
      checkpoints_sha256: sha256File(preSoakCheckpoints) };
    assert.equal(assertQualificationFailureGate({ blocker, closure,
      stage: "V8", candidateSha }).status, "PASS");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
