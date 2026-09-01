const DIGEST = /^[a-f0-9]{64}$/;
const RESULT_CODE = /^[A-Za-z0-9_]{2,80}$/;

function workerFailure(code, details = {}) {
  return Object.assign(new Error(code), { code, details });
}

function safeCode(value) {
  return typeof value === "string" && RESULT_CODE.test(value) ? value : "device_state_unknown";
}

function physicalScope(task) {
  return {
    request_id: task.id,
    gateway_id: task.gateway_id,
    site_id: task.site_id,
    camera_id: task.camera_id,
    stream_id: task.stream_id,
    channel: task.channel,
    source_generation: task.source_generation,
    binding_generation: task.binding_generation,
    action: task.action,
    executor_installed: true
  };
}

export function mapPrivateNvrNonRetryableResult(task, error, now = Date.now) {
  const phase = error?.details?.phase;
  const auditDigest = error?.details?.audit_digest;
  if (error?.details?.non_retryable !== true || phase?.writeAttempted !== true || !DIGEST.test(auditDigest || "")) {
    throw workerFailure("non_retryable_result_facts_missing");
  }
  const acknowledged = phase.ackObserved === true;
  if (!acknowledged && (phase.ackObserved !== false || phase.stateVerified !== false)) {
    throw workerFailure("non_retryable_result_phase_invalid");
  }
  const outcome = acknowledged ? "acknowledged_needs_reconciliation" : "unknown_non_retryable";
  return Object.freeze({
    action: "result",
    request_id: task.id,
    outcome,
    result_code: outcome,
    outcome_payload: {
      ...physicalScope(task),
      executed: null,
      non_retryable: true,
      phase: {
        write_attempted: true,
        ack_observed: acknowledged,
        state_verified: phase.stateVerified === true
      },
      audit_digest: auditDigest,
      error_code: safeCode(error?.details?.cause || error?.code),
      reported_at: new Date(now()).toISOString()
    }
  });
}

export async function executePrivateNvrQueueTaskOnce({ executor, task, identity, submitResult, now = Date.now }) {
  if (typeof executor?.execute !== "function" || typeof submitResult !== "function") throw workerFailure("worker_dependencies_invalid");
  let result;
  try {
    result = await executor.execute(task, identity);
  } catch (error) {
    if (error?.details?.non_retryable === true) result = mapPrivateNvrNonRetryableResult(task, error, now);
    else result = { action: "result", request_id: task.id, outcome: "failed", result_code: safeCode(error?.code) };
  }
  try {
    await submitResult(result);
  } catch (error) {
    // The caller may retry delivery of this exact result object. It must never
    // call executor.execute again for this task.
    throw workerFailure("camera_result_delivery_pending", { result, execute_again: false, cause: safeCode(error?.code) });
  }
  return Object.freeze({ state: "result_recorded", result });
}
