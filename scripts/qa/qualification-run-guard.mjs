import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;

function fail(code) {
  throw new Error(code);
}

function readJson(path, code) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fail(code);
  }
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function assertQualificationServiceAvailable(serviceState) {
  if (serviceState?.loaded) fail("durable_soak_service_already_loaded");
  return true;
}

function runFiles(outputRoot) {
  if (!existsSync(outputRoot)) return [];
  if (!statSync(outputRoot).isDirectory()) fail("durable_soak_output_root_not_directory");
  return readdirSync(outputRoot).filter(name => name !== ".DS_Store");
}

function readCheckpointLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return fail("durable_soak_resume_checkpoints_invalid");
    }
  });
}

export function assertQualificationResumeState({ outputRoot, runId,
  expectedStartedAt, expectedSequence }) {
  const statePath = join(outputRoot, "state.json");
  const resultPath = join(outputRoot, "result.json");
  const checkpointsPath = join(outputRoot, "checkpoints.ndjson");
  if (existsSync(resultPath)) fail("durable_soak_terminal_result_exists");
  if (!existsSync(statePath)) fail("durable_soak_resume_state_missing");
  const state = readJson(statePath, "durable_soak_resume_state_invalid");
  if (state.contract !== "observer-reliability-soak-state-v1" || state.status !== "RUNNING")
    fail("durable_soak_resume_state_not_running");
  if (state.run_id !== runId) fail("durable_soak_resume_run_id_mismatch");
  if (typeof expectedStartedAt !== "string" || state.started_at !== expectedStartedAt ||
    !Number.isFinite(Date.parse(expectedStartedAt)) ||
    state.started_at_ms !== Date.parse(expectedStartedAt))
    fail("durable_soak_resume_started_at_mismatch");
  const expected = Number(expectedSequence);
  if (!Number.isInteger(expected) || expected < 0 || state.checkpoint_count !== expected)
    fail("durable_soak_resume_sequence_mismatch");
  const checkpoints = readCheckpointLines(checkpointsPath);
  if (checkpoints.length !== expected)
    fail("durable_soak_resume_checkpoint_count_mismatch");
  if (expected > 0) {
    const last = checkpoints.at(-1);
    if (last?.run_id !== runId || last?.sequence !== expected)
      fail("durable_soak_resume_checkpoint_tail_mismatch");
    if (state.last_checkpoint_at !== last.sampled_at)
      fail("durable_soak_resume_checkpoint_timestamp_mismatch");
  }
  return { mode: "VERIFIED_RESUME", state, checkpoint_count: checkpoints.length };
}

export function assertQualificationRunStart({ outputRoot, runId, resume = false,
  expectedStartedAt = null, expectedSequence = null }) {
  const files = runFiles(outputRoot);
  if (!files.length && !resume) return { mode: "FRESH", files: [] };
  if (!resume) fail("durable_soak_non_empty_run_directory");
  return assertQualificationResumeState({ outputRoot, runId,
    expectedStartedAt, expectedSequence });
}

export function assertQualificationRunnerStart(options) {
  if (options.resume) return assertQualificationResumeState(options);
  for (const name of ["state.json", "result.json", "checkpoints.ndjson"]) {
    if (existsSync(join(options.outputRoot, name)))
      fail("durable_soak_runner_existing_run_state");
  }
  return { mode: "FRESH_RUNTIME" };
}

export function qualificationCadenceAbort({ scheduledAt, sampledAt, intervalMs,
  maximumIntervals = 3 }) {
  const driftMs = Number(sampledAt) - Number(scheduledAt);
  const maximumDriftMs = Math.max(180_000, Number(intervalMs) * Number(maximumIntervals));
  return Number.isFinite(driftMs) && Number.isFinite(maximumDriftMs) && driftMs > maximumDriftMs
    ? { contract: "observer-qualification-cadence-abort-v1",
      reason: "HOST_SLEEP_OR_MONITOR_PAUSE", scheduled_at: new Date(scheduledAt).toISOString(),
      detected_at: new Date(sampledAt).toISOString(), drift_ms: driftMs,
      maximum_drift_ms: maximumDriftMs }
    : null;
}

function firstFailure(checkpoints) {
  return checkpoints.find(point => point?.dvr?.classification !== "PASS" ||
    point?.tapo?.classification !== "PASS" ||
    (point?.host?.forbidden_workloads || []).length > 0 ||
    point?.host?.disk_qualification_ready === false) || null;
}

export function buildQualificationFailureBlocker({ runId, stage, resultPath,
  checkpointsPath }) {
  if (!existsSync(resultPath) || !existsSync(checkpointsPath))
    fail("durable_soak_failure_evidence_missing");
  const result = readJson(resultPath, "durable_soak_failure_result_invalid");
  if (result.status === "PASS") fail("durable_soak_failure_result_is_pass");
  const checkpoints = readCheckpointLines(checkpointsPath);
  const first = firstFailure(checkpoints);
  const fingerprint = {
    failed_run_id: runId,
    failed_stage: stage,
    started_at: result.started_at ?? null,
    ended_at: result.ended_at ?? null,
    first_failure: first ? {
      sequence: first.sequence ?? null,
      sampled_at: first.sampled_at ?? null,
      dvr_classification: first.dvr?.classification ?? null,
      dvr_available: first.dvr?.available ?? null,
      dvr_auth: first.dvr?.auth ?? null,
      tapo_classification: first.tapo?.classification ?? null,
      tapo_progressing: first.tapo?.progressing ?? null,
      tapo_auth: first.tapo?.auth ?? null,
      host_pressure: first.host?.pressure ?? null,
      host_disk_free_bytes: first.host?.disk_free_bytes ?? null,
      host_disk_qualification_ready:
        first.host?.disk_qualification_ready ?? null,
      forbidden_workloads: first.host?.forbidden_workloads ?? []
    } : null,
    gate_failures: [...(result.gate_failures || [])].sort()
  };
  return {
    contract: "observer-qualification-failure-blocker-v1",
    created_at: new Date().toISOString(),
    failed_run: { run_id: runId, stage, status: result.status,
      started_at: result.started_at ?? null, ended_at: result.ended_at ?? null },
    evidence: { result_path: resolve(resultPath), result_sha256: sha256File(resultPath),
      checkpoints_path: resolve(checkpointsPath),
      checkpoints_sha256: sha256File(checkpointsPath) },
    failure_fingerprint: { ...fingerprint,
      sha256: createHash("sha256").update(JSON.stringify(fingerprint)).digest("hex") }
  };
}

function assertEvidenceFile(value, label) {
  if (!value || value.status !== "PASS" || !isAbsolute(value.evidence_path || "") ||
    !SHA256.test(value.evidence_sha256 || "") || !existsSync(value.evidence_path) ||
    sha256File(value.evidence_path) !== value.evidence_sha256)
    fail(`durable_soak_failure_closure_${label}_invalid`);
}

function assertStageEvidence(value, label, expectedStage, minimumElapsedMs) {
  if (!value || value.status !== "PASS" || !value.run_id ||
    !isAbsolute(value.result_path || "") || !isAbsolute(value.checkpoints_path || "") ||
    !SHA256.test(value.result_sha256 || "") || !SHA256.test(value.checkpoints_sha256 || "") ||
    !existsSync(value.result_path) || !existsSync(value.checkpoints_path) ||
    sha256File(value.result_path) !== value.result_sha256 ||
    sha256File(value.checkpoints_path) !== value.checkpoints_sha256)
    fail(`durable_soak_failure_closure_${label}_invalid`);
  const result = readJson(value.result_path,
    `durable_soak_failure_closure_${label}_result_invalid`);
  if (result.status !== "PASS" || result.qualification_stage !== expectedStage ||
    result.elapsed_ms < minimumElapsedMs)
    fail(`durable_soak_failure_closure_${label}_result_invalid`);
}

export function assertQualificationFailureClosure({ blocker, closure, stage,
  candidateSha }) {
  if (blocker?.contract !== "observer-qualification-failure-blocker-v1")
    fail("durable_soak_failure_blocker_invalid");
  if (closure?.contract !== "observer-qualification-failure-closure-v1")
    fail("durable_soak_failure_closure_invalid");
  if (closure.failed_run_id !== blocker.failed_run?.run_id ||
    closure.failed_stage !== blocker.failed_run?.stage ||
    closure.failure_fingerprint_sha256 !== blocker.failure_fingerprint?.sha256 ||
    closure.evidence?.result_sha256 !== blocker.evidence?.result_sha256 ||
    closure.evidence?.checkpoints_sha256 !== blocker.evidence?.checkpoints_sha256)
    fail("durable_soak_failure_closure_binding_mismatch");
  if (!COMMIT_SHA.test(candidateSha || "") || closure.candidate_sha !== candidateSha ||
    !COMMIT_SHA.test(closure.fix?.commit_sha || "") ||
    closure.ci?.candidate_sha !== candidateSha)
    fail("durable_soak_failure_closure_candidate_mismatch");
  if (!closure.fix?.summary) fail("durable_soak_failure_closure_fix_invalid");
  assertEvidenceFile(closure.reproduction, "reproduction");
  assertEvidenceFile(closure.regression, "regression");
  if (closure.ci?.status !== "PASS" || !String(closure.ci?.run_id || ""))
    fail("durable_soak_failure_closure_ci_invalid");
  if (!closure.canary || !closure.pre_soak)
    fail("durable_soak_failure_closure_stage_gates_missing");
  if (stage === "PRE_SOAK" || stage === "V8")
    assertStageEvidence(closure.canary, "canary", "CANARY", 900_000);
  if (stage === "V8")
    assertStageEvidence(closure.pre_soak, "pre_soak", "PRE_SOAK", 3_600_000);
  return { status: "PASS", closure_sha256: createHash("sha256")
    .update(JSON.stringify(closure)).digest("hex") };
}

export function assertQualificationFailureGate({ blocker, closure, stage,
  candidateSha }) {
  if (!blocker) return { status: "NOT_REQUIRED" };
  if (!closure) fail("durable_soak_failure_closure_required");
  return assertQualificationFailureClosure({ blocker, closure, stage, candidateSha });
}
