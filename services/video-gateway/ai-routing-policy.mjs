import { createHash, randomUUID } from "node:crypto";
import { validateAiJob } from "./ai-job-contract.mjs";

export const EXECUTION_TARGET_CONTRACT = "observer-execution-target-v1";
export const AI_ROUTING_DECISION_CONTRACT = "observer-ai-routing-decision-v1";
export const AI_ROUTING_POLICY_VERSION = "observer-ai-routing-policy-v1";
export const EXECUTION_TARGET_CLASSES = Object.freeze(["EDGE_LOCAL", "LOCAL_DEDICATED", "CLOUD_SHARED", "CLOUD_DEDICATED"]);
export const AI_EXECUTION_POLICIES = Object.freeze(["EDGE_ONLY", "LOCAL_ALLOWED", "CLOUD_ALLOWED", "DEDICATED_ONLY"]);

const FORBIDDEN = /(password|secret|authorization|private.?key|credential|stream.?url|signed.?url|token)/i;
const text = (value, name, max = 240) => {
  if (typeof value !== "string" || !value || value.length > max) throw new Error(`ai_routing_${name}_invalid`);
  return value;
};
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const unique = values => [...new Set((values ?? []).map(String).filter(Boolean))];
const safe = (value, depth = 0) => {
  if (depth > 8) throw new Error("ai_routing_payload_depth");
  if (Array.isArray(value)) return value.map(item => safe(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) throw new Error("ai_routing_secret_field_rejected");
    output[key] = safe(item, depth + 1);
  }
  return output;
};
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createExecutionTarget(input) {
  const targetClass = EXECUTION_TARGET_CLASSES.includes(input.target_class) ? input.target_class : null;
  if (!targetClass) throw new Error("ai_routing_target_class_invalid");
  const maxConcurrency = Math.max(1, Math.floor(finite(input.capacity?.max_concurrency, 1)));
  const inFlight = Math.max(0, Math.floor(finite(input.capacity?.in_flight, 0)));
  const target = {
    contract: EXECUTION_TARGET_CONTRACT,
    schema_version: 1,
    target_id: text(input.target_id, "target_id"),
    target_class: targetClass,
    environment: text(input.environment, "environment"),
    provider_id: text(input.provider_id ?? "digital-observer-managed", "provider_id"),
    region: text(input.region ?? "local", "region"),
    supported_capabilities: unique(input.supported_capabilities),
    supported_model_classes: unique(input.supported_model_classes),
    supported_input_kinds: unique(input.supported_input_kinds),
    health: ["HEALTHY", "DEGRADED", "UNHEALTHY", "CRASH_LOOP", "REVOKED"].includes(input.health) ? input.health : "UNHEALTHY",
    available: input.available === true,
    capacity: { max_concurrency: maxConcurrency, in_flight: inFlight, queue_depth: Math.max(0, Math.floor(finite(input.capacity?.queue_depth, 0))) },
    tenant_eligibility: { mode: input.tenant_eligibility?.mode === "ALLOWLIST" ? "ALLOWLIST" : "ANY", tenant_ids: unique(input.tenant_eligibility?.tenant_ids) },
    privacy_eligibility: unique(input.privacy_eligibility?.length ? input.privacy_eligibility : ["EDGE_ONLY", "LOCAL_ALLOWED", "CLOUD_ALLOWED"]),
    input_access: { locality: unique(input.input_access?.locality ?? ["MANAGED_COMPONENT_ONLY"]), source_ids: unique(input.input_access?.source_ids ?? ["*"]) },
    latency: { expected_ms: Math.max(0, Math.floor(finite(input.latency?.expected_ms, 1_000))), sample_count: Math.max(0, Math.floor(finite(input.latency?.sample_count, 0))) },
    reliability: { measured: input.reliability?.measured === true, success_rate: Math.max(0, Math.min(1, finite(input.reliability?.success_rate, 0))), sample_count: Math.max(0, Math.floor(finite(input.reliability?.sample_count, 0))) },
    quality: { measured: input.quality?.measured === true, score: Math.max(0, Math.min(1, finite(input.quality?.score, 0))), sample_count: Math.max(0, Math.floor(finite(input.quality?.sample_count, 0))), dataset_version: input.quality?.dataset_version ? text(input.quality.dataset_version, "dataset_version") : null },
    cost_hook: { measured: input.cost_hook?.measured === true, compute_class: String(input.cost_hook?.compute_class ?? "UNKNOWN").slice(0, 80), bandwidth_class: String(input.cost_hook?.bandwidth_class ?? "UNKNOWN").slice(0, 80), accounting_key: String(input.cost_hook?.accounting_key ?? targetClass).slice(0, 120) },
    metadata: safe(input.metadata ?? {})
  };
  return Object.freeze(target);
}

export function validateExecutionTarget(value) {
  if (value?.contract !== EXECUTION_TARGET_CONTRACT || value?.schema_version !== 1) throw new Error("ai_routing_target_contract_invalid");
  return createExecutionTarget(value);
}

const policyFor = job => AI_EXECUTION_POLICIES.includes(job.privacy_constraints?.execution_policy)
  ? job.privacy_constraints.execution_policy : "LOCAL_ALLOWED";
const allowedClasses = policy => policy === "EDGE_ONLY" ? ["EDGE_LOCAL"]
  : policy === "LOCAL_ALLOWED" ? ["EDGE_LOCAL", "LOCAL_DEDICATED"]
    : policy === "DEDICATED_ONLY" ? ["LOCAL_DEDICATED", "CLOUD_DEDICATED"] : EXECUTION_TARGET_CLASSES;

function eligibility(job, target, context) {
  const reasons = [];
  const tenantPolicy = context.tenant_policy ?? {};
  const executionPolicy = policyFor(job);
  const sourceAllowed = target.input_access.source_ids.includes("*") || target.input_access.source_ids.includes(job.source_id);
  if (!target.available) reasons.push("TARGET_UNAVAILABLE");
  if (!["HEALTHY", "DEGRADED"].includes(target.health)) reasons.push(`TARGET_${target.health}`);
  if (target.health === "DEGRADED" && job.priority === "CRITICAL") reasons.push("CRITICAL_REQUIRES_HEALTHY_TARGET");
  if (target.capacity.in_flight >= target.capacity.max_concurrency) reasons.push("TARGET_AT_CAPACITY");
  if (!target.supported_capabilities.includes(job.requested_capability)) reasons.push("CAPABILITY_UNSUPPORTED");
  if (!target.supported_model_classes.includes(job.model_class)) reasons.push("MODEL_CLASS_UNSUPPORTED");
  if (!target.supported_input_kinds.includes(job.input_ref.kind)) reasons.push("INPUT_KIND_UNSUPPORTED");
  if (!target.input_access.locality.includes(job.input_ref.locality) || !sourceAllowed) reasons.push("INPUT_INACCESSIBLE");
  if (!allowedClasses(executionPolicy).includes(target.target_class) || !target.privacy_eligibility.includes(executionPolicy)) reasons.push("PRIVACY_POLICY_DENIED");
  if (target.tenant_eligibility.mode === "ALLOWLIST" && !target.tenant_eligibility.tenant_ids.includes(job.tenant_id)) reasons.push("TENANT_NOT_ELIGIBLE");
  if (Array.isArray(tenantPolicy.allowed_target_classes) && !tenantPolicy.allowed_target_classes.includes(target.target_class)) reasons.push("TENANT_TARGET_CLASS_DENIED");
  if (Array.isArray(tenantPolicy.allowed_regions) && !tenantPolicy.allowed_regions.includes(target.region)) reasons.push("TENANT_REGION_DENIED");
  if (Array.isArray(tenantPolicy.allowed_provider_ids) && !tenantPolicy.allowed_provider_ids.includes(target.provider_id)) reasons.push("TENANT_PROVIDER_DENIED");
  if (tenantPolicy.shared_cloud_allowed === false && target.target_class === "CLOUD_SHARED") reasons.push("TENANT_SHARED_CLOUD_DENIED");
  if (tenantPolicy.dedicated_required === true && !target.target_class.endsWith("DEDICATED")) reasons.push("TENANT_DEDICATED_REQUIRED");
  if ((context.excluded_target_ids ?? []).includes(target.target_id)) reasons.push("FAILOVER_TARGET_EXCLUDED");
  return [...new Set(reasons)];
}

function score(job, target, context) {
  const locality = target.target_class === "EDGE_LOCAL" ? 400 : target.target_class === "LOCAL_DEDICATED" ? 300 : target.target_class === "CLOUD_DEDICATED" ? 200 : 100;
  const latencyWeight = ["CRITICAL", "HIGH"].includes(job.priority) ? 2 : job.purpose === "SITE_LEARNING" ? 0.25 : 1;
  const latency = Math.min(2_000, target.latency.expected_ms) * latencyWeight;
  const load = target.capacity.in_flight / target.capacity.max_concurrency * 500 + Math.min(500, target.capacity.queue_depth * 5);
  const quality = target.quality.measured && target.quality.sample_count >= 20 ? target.quality.score * 300 : 0;
  const reliability = target.reliability.measured && target.reliability.sample_count >= 20 ? target.reliability.success_rate * 200 : 0;
  const preferred = context.tenant_policy?.preferred_target_class === target.target_class ? 250 : 0;
  // PUSH 33 owns economics. Cost metadata is deliberately not scored here.
  return Number((locality + quality + reliability + preferred - latency - load).toFixed(3));
}

export function createHybridAiRouter({ policyVersion = AI_ROUTING_POLICY_VERSION, now = Date.now, auditLimit = 500 } = {}) {
  const decisions = [];
  const metrics = { decisions: 0, selected: {}, rejected: {}, failovers: 0, no_eligible_target: 0 };
  function route(value, targetValues, context = {}) {
    const job = validateAiJob(value);
    const targets = targetValues.map(validateExecutionTarget);
    const evaluated = targets.map(target => {
      const rejected_reasons = eligibility(job, target, context);
      return { target, eligible: rejected_reasons.length === 0, rejected_reasons, score: rejected_reasons.length ? null : score(job, target, context) };
    });
    const eligible = evaluated.filter(item => item.eligible).sort((a, b) => b.score - a.score || a.target.target_id.localeCompare(b.target.target_id));
    const selected = eligible[0] ?? null;
    const history = safe(context.failover_history ?? []);
    const decision = Object.freeze({ contract: AI_ROUTING_DECISION_CONTRACT, schema_version: 1,
      decision_id: `aird_${randomUUID()}`, job_id: job.job_id, idempotency_key: job.idempotency_key,
      tenant_id: job.tenant_id, site_id: job.site_id, source_id: job.source_id,
      policy_version: policyVersion, execution_policy: policyFor(job), decided_at: new Date(now()).toISOString(),
      status: selected ? "TARGET_SELECTED" : "NO_ELIGIBLE_TARGET", selected_target_id: selected?.target.target_id ?? null,
      selected_target_class: selected?.target.target_class ?? null,
      reason: selected ? explain(job, selected.target, context) : "NO_ELIGIBLE_TARGET",
      eligible_targets: eligible.map(item => ({ target_id: item.target.target_id, target_class: item.target.target_class, score: item.score })),
      rejected_targets: evaluated.filter(item => !item.eligible).map(item => ({ target_id: item.target.target_id, target_class: item.target.target_class, reasons: item.rejected_reasons })),
      failover_history: history, quality_evidence_used: eligible.some(item => item.target.quality.measured && item.target.quality.sample_count >= 20),
      cost_optimization_used: false, audit_digest: digest([job.job_id, policyVersion, selected?.target.target_id ?? null, evaluated.map(item => [item.target.target_id, item.rejected_reasons])]) });
    metrics.decisions++;
    if (selected) metrics.selected[selected.target.target_class] = (metrics.selected[selected.target.target_class] ?? 0) + 1;
    else metrics.no_eligible_target++;
    for (const item of evaluated) for (const reason of item.rejected_reasons) metrics.rejected[reason] = (metrics.rejected[reason] ?? 0) + 1;
    if (history.length) metrics.failovers++;
    decisions.push(decision); if (decisions.length > auditLimit) decisions.splice(0, decisions.length - auditLimit);
    return decision;
  }
  function explain(job, target, context) {
    const executionPolicy = policyFor(job);
    if (executionPolicy === "EDGE_ONLY") return "EDGE_LOCAL — privacy policy";
    if ((context.failover_history ?? []).length) return `${target.target_class} — prior target failed; alternate allowed`;
    if (target.quality.measured && target.quality.sample_count >= 20) return `${target.target_class} — eligible measured-quality preference`;
    if (["CRITICAL", "HIGH"].includes(job.priority)) return `${target.target_class} — eligible low-latency priority target`;
    return `${target.target_class} — best eligible policy target`;
  }
  async function execute({ job, queue, targets, workers, context = {} }) {
    const excluded = [...(context.excluded_target_ids ?? [])], history = [...(context.failover_history ?? [])];
    for (let attempt = 0; attempt < targets.length; attempt += 1) {
      const decision = route(job, targets, { ...context, excluded_target_ids: excluded, failover_history: history });
      if (decision.status === "NO_ELIGIBLE_TARGET") return { status: "NO_ELIGIBLE_TARGET", decision, failover_history: history };
      const worker = workers.get(decision.selected_target_id);
      if (!worker) { excluded.push(decision.selected_target_id); history.push({ target_id: decision.selected_target_id, reason: "WORKER_NOT_REGISTERED", at: new Date(now()).toISOString() }); continue; }
      const result = await worker.processOne(queue, { jobId: job.job_id, routeDecision: decision, failoverOnRetryable: true });
      if (result.status === "COMPLETED") return { ...result, decision, failover_history: history };
      if (result.status !== "FAILOVER_REQUIRED") return { ...result, decision, failover_history: history };
      excluded.push(decision.selected_target_id); history.push({ target_id: decision.selected_target_id, reason: result.failure_reason ?? "RETRYABLE_TARGET_FAILURE", at: new Date(now()).toISOString() });
    }
    const decision = route(job, targets, { ...context, excluded_target_ids: excluded, failover_history: history });
    return { status: "NO_ELIGIBLE_TARGET", decision, failover_history: history };
  }
  return Object.freeze({ route, execute, audit: () => decisions.map(item => item), snapshot: () => ({ contract: AI_ROUTING_DECISION_CONTRACT, policy_version: policyVersion, ...safe(metrics) }) });
}
