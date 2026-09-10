import { createHash, randomUUID } from "node:crypto";

export const COST_USAGE_CONTRACT = "observer-cost-usage-v1";
export const COST_RATE_CATALOG_CONTRACT = "observer-cost-rate-catalog-v1";
export const COST_REPORT_CONTRACT = "observer-cost-report-v1";
export const COST_RESOURCE_TYPES = Object.freeze([
  "AI_INFERENCE", "CPU_COMPUTE", "GPU_COMPUTE", "EDGE_COMPUTE",
  "BANDWIDTH_INGRESS", "BANDWIDTH_EGRESS", "STORAGE", "EVIDENCE_STORAGE",
  "DATABASE", "PLATFORM_HOSTING", "NOTIFICATION", "EXTERNAL_PROVIDER"
]);
export const COST_ATTRIBUTION_QUALITY = Object.freeze([
  "DIRECTLY_METERED", "PROVIDER_RECONCILED", "ALLOCATED", "ESTIMATED", "UNKNOWN"
]);
export const COST_UNITS = Object.freeze([
  "MILLISECOND", "SECOND", "BYTE", "BYTE_HOUR", "REQUEST", "MESSAGE", "JOB", "DEVICE_HOUR"
]);

const FORBIDDEN = /(password|secret|authorization|private.?key|credential|stream.?url|signed.?url|token)/i;
const text = (value, name, max = 240) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`cost_${name}_invalid`);
  return value.trim();
};
const optionalText = (value, name, max = 240) => value == null ? null : text(value, name, max);
const nonNegative = (value, name) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`cost_${name}_invalid`);
  return number;
};
const timestamp = (value, name) => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`cost_${name}_invalid`);
  return new Date(parsed).toISOString();
};
const safe = (value, depth = 0) => {
  if (depth > 8) throw new Error("cost_payload_depth");
  if (Array.isArray(value)) return value.map(item => safe(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) throw new Error("cost_secret_field_rejected");
    output[key] = safe(item, depth + 1);
  }
  return output;
};
const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rateKey = rate => `${rate.provider_id}:${rate.resource_type}:${rate.unit}:${rate.currency}`;

export function createRateCatalog(input) {
  if (!Array.isArray(input?.rates)) throw new Error("cost_rate_catalog_rates_invalid");
  const effectiveAt = timestamp(input.effective_at, "rate_effective_at");
  const rates = input.rates.map(value => {
    const resourceType = COST_RESOURCE_TYPES.includes(value.resource_type) ? value.resource_type : null;
    const unit = COST_UNITS.includes(value.unit) ? value.unit : null;
    const quality = ["PROVIDER_RECONCILED", "DIRECTLY_METERED", "ESTIMATED"].includes(value.quality) ? value.quality : null;
    if (!resourceType || !unit || !quality) throw new Error("cost_rate_invalid");
    return Object.freeze({
      rate_id: text(value.rate_id ?? `rate_${digest(value).slice(0, 20)}`, "rate_id"),
      provider_id: text(value.provider_id, "provider"), resource_type: resourceType, unit,
      currency: text(value.currency, "currency", 3).toUpperCase(), unit_cost: nonNegative(value.unit_cost, "unit_cost"),
      quality, source: text(value.source, "rate_source"), effective_at: timestamp(value.effective_at ?? effectiveAt, "rate_effective_at"),
      expires_at: value.expires_at ? timestamp(value.expires_at, "rate_expires_at") : null,
      assumptions: safe(value.assumptions ?? {})
    });
  });
  const keys = rates.map(rateKey);
  if (new Set(keys).size !== keys.length) throw new Error("cost_rate_duplicate");
  return Object.freeze({ contract: COST_RATE_CATALOG_CONTRACT, schema_version: 1,
    catalog_id: text(input.catalog_id, "catalog_id"), version: text(input.version, "rate_version"),
    currency: text(input.currency, "currency", 3).toUpperCase(), effective_at: effectiveAt, rates: Object.freeze(rates) });
}

export function findApplicableRate(catalog, usage, at = usage.window_end) {
  if (!catalog || catalog.contract !== COST_RATE_CATALOG_CONTRACT) return null;
  const when = Date.parse(at);
  return catalog.rates.find(rate => rate.provider_id === usage.provider_id && rate.resource_type === usage.resource_type
    && rate.unit === usage.unit && rate.currency === usage.currency && Date.parse(rate.effective_at) <= when
    && (!rate.expires_at || Date.parse(rate.expires_at) > when)) ?? null;
}

export function createCostUsage(input, { catalog = null } = {}) {
  const resourceType = COST_RESOURCE_TYPES.includes(input.resource_type) ? input.resource_type : null;
  const unit = COST_UNITS.includes(input.unit) ? input.unit : null;
  if (!resourceType || !unit) throw new Error("cost_usage_dimension_invalid");
  const start = timestamp(input.window_start ?? input.timestamp, "window_start");
  const end = timestamp(input.window_end ?? input.timestamp, "window_end");
  if (Date.parse(end) < Date.parse(start)) throw new Error("cost_window_invalid");
  const quantity = nonNegative(input.quantity, "quantity");
  const currency = text(input.currency ?? catalog?.currency ?? "USD", "currency", 3).toUpperCase();
  const base = {
    provider_id: text(input.provider_id, "provider"), resource_type: resourceType, unit, currency,
    tenant_id: text(input.tenant_id, "tenant"), site_id: text(input.site_id, "site"),
    source_id: optionalText(input.source_id, "source"), ai_job_id: optionalText(input.ai_job_id, "ai_job"),
    model: optionalText(input.model, "model"), model_version: optionalText(input.model_version, "model_version"),
    execution_target_id: optionalText(input.execution_target_id, "execution_target"),
    execution_target_class: optionalText(input.execution_target_class, "execution_target_class"),
    quantity, window_start: start, window_end: end, provenance: safe(input.provenance ?? {}),
    allocation_scope: input.allocation_scope ? safe(input.allocation_scope) : null
  };
  const rate = findApplicableRate(catalog, { ...base, currency }, end);
  const suppliedCost = input.calculated_cost == null ? null : nonNegative(input.calculated_cost, "calculated_cost");
  const calculatedCost = suppliedCost ?? (rate ? Number((quantity * rate.unit_cost).toFixed(12)) : null);
  let quality = COST_ATTRIBUTION_QUALITY.includes(input.attribution_quality) ? input.attribution_quality : null;
  if (!quality) quality = rate?.quality ?? (calculatedCost == null ? "UNKNOWN" : "ESTIMATED");
  if (quality === "PROVIDER_RECONCILED" && !input.reconciliation_id && rate?.quality !== "PROVIDER_RECONCILED") throw new Error("cost_reconciliation_required");
  return Object.freeze({ contract: COST_USAGE_CONTRACT, schema_version: 1,
    usage_id: text(input.usage_id ?? `ocu_${randomUUID()}`, "usage_id"), idempotency_key: text(input.idempotency_key ?? digest(base), "idempotency_key"),
    ...base, rate_catalog_id: rate ? catalog.catalog_id : null, rate_version: rate ? catalog.version : null,
    rate_id: rate?.rate_id ?? null, unit_cost: rate?.unit_cost ?? null, calculated_cost: calculatedCost,
    attribution_quality: quality, reconciliation_id: optionalText(input.reconciliation_id, "reconciliation"),
    cost_is_customer_price: false, billing_action: false, created_at: timestamp(input.created_at ?? end, "created_at") });
}

export function createInferenceCostUsage(job, result, target, options = {}) {
  if (job?.job_id !== result?.job_id || job?.tenant_id !== result?.tenant_id || job?.site_id !== result?.site_id || job?.source_id !== result?.source_id) throw new Error("cost_ai_provenance_mismatch");
  if (result.execution_target_id !== target?.target_id || result.execution_target_class !== target?.target_class) throw new Error("cost_execution_target_mismatch");
  return createCostUsage({
    usage_id: options.usage_id, idempotency_key: `ai:${result.result_id}`, provider_id: target.provider_id,
    resource_type: "AI_INFERENCE", unit: "MILLISECOND", quantity: result.inference_ms,
    tenant_id: job.tenant_id, site_id: job.site_id, source_id: job.source_id, ai_job_id: job.job_id,
    model: result.model, model_version: result.model_version, execution_target_id: result.execution_target_id,
    execution_target_class: result.execution_target_class, window_start: result.started_at, window_end: result.completed_at,
    currency: options.currency ?? "USD", attribution_quality: options.attribution_quality,
    provenance: { result_id: result.result_id, route_decision_id: result.route_decision_id, routing_policy_version: result.routing_policy_version,
      compute_class: target.cost_hook?.compute_class ?? "UNKNOWN", bandwidth_class: target.cost_hook?.bandwidth_class ?? "UNKNOWN",
      meter: "INFERENCE_RESULT_DURATION", measured_duration: true }
  }, { catalog: options.catalog });
}

export function allocateSharedUsage(input, physicalSources) {
  const eligible = physicalSources.filter(source => source.expected_physical_camera === true && !["CHANNEL_EMPTY", "UNASSIGNED", "DISABLED"].includes(source.state));
  if (!eligible.length) throw new Error("cost_allocation_denominator_empty");
  const share = nonNegative(input.calculated_cost, "allocated_cost") / eligible.length;
  return eligible.map(source => createCostUsage({ ...input, usage_id: undefined,
    idempotency_key: `${input.idempotency_key}:source:${source.source_id}`, source_id: source.source_id,
    quantity: nonNegative(input.quantity, "quantity") / eligible.length, calculated_cost: Number(share.toFixed(12)),
    attribution_quality: "ALLOCATED", allocation_scope: { policy: "EXPECTED_PHYSICAL_CAMERA_EQUAL_SHARE", denominator: eligible.length, shared_usage_id: input.usage_id }
  }));
}

export function buildCostReport(events, filters = {}) {
  const rows = events.filter(event => (!filters.tenant_id || event.tenant_id === filters.tenant_id)
    && (!filters.site_id || event.site_id === filters.site_id) && (!filters.source_id || event.source_id === filters.source_id));
  const unique = [...new Map(rows.map(row => [row.idempotency_key, row])).values()];
  const known = unique.filter(row => row.calculated_cost != null);
  const byCurrency = {};
  const byCategory = {};
  const byQuality = Object.fromEntries(COST_ATTRIBUTION_QUALITY.map(value => [value, 0]));
  for (const row of unique) {
    byQuality[row.attribution_quality] = (byQuality[row.attribution_quality] ?? 0) + 1;
    const category = byCategory[row.resource_type] ??= { usage_events: 0, known_cost: 0, unknown_cost_events: 0 };
    category.usage_events++;
    if (row.calculated_cost == null) category.unknown_cost_events++; else {
      category.known_cost += row.calculated_cost;
      byCurrency[row.currency] = (byCurrency[row.currency] ?? 0) + row.calculated_cost;
    }
  }
  return Object.freeze({ contract: COST_REPORT_CONTRACT, schema_version: 1, usage_events: unique.length,
    duplicate_events_ignored: rows.length - unique.length, known_cost_events: known.length, unknown_cost_events: unique.length - known.length,
    totals_by_currency: Object.fromEntries(Object.entries(byCurrency).map(([key, value]) => [key, Number(value.toFixed(12))])),
    by_category: byCategory, by_attribution_quality: byQuality, customer_price_included: false });
}

export function reconcileProviderCost(events, actual) {
  const report = buildCostReport(events);
  const currency = text(actual.currency, "currency", 3).toUpperCase();
  const calculated = report.totals_by_currency[currency];
  if (calculated == null) return { status: "NOT_RECONCILED", reason: "NO_CALCULATED_COST", calculated_cost: null, actual_cost: nonNegative(actual.actual_cost, "actual_cost"), currency };
  const value = nonNegative(actual.actual_cost, "actual_cost");
  return Object.freeze({ status: "RECONCILED", reconciliation_id: text(actual.reconciliation_id, "reconciliation"), provider_id: text(actual.provider_id, "provider"),
    currency, calculated_cost: calculated, actual_cost: value, variance: Number((calculated - value).toFixed(12)), variance_ratio: value ? (calculated - value) / value : null,
    tolerance_approved: actual.approved_tolerance != null, within_approved_tolerance: actual.approved_tolerance == null ? null : Math.abs(calculated - value) <= Number(actual.approved_tolerance) });
}

export function projectUsage(baseline, cameraCounts = [10, 100, 1_000]) {
  const cameras = nonNegative(baseline.physical_camera_count, "projection_camera_count");
  if (!cameras) throw new Error("cost_projection_denominator_empty");
  return cameraCounts.map(count => {
    const factor = nonNegative(count, "projection_target") / cameras;
    return { classification: "PROJECTION", physical_cameras: count, observation_ms: nonNegative(baseline.observation_ms, "projection_observation"),
      assumptions: { linear_from_physical_camera_count: cameras, workload_shape_unchanged: true, provider_rates_unchanged: true },
      ai_jobs: Number((nonNegative(baseline.ai_jobs, "projection_jobs") * factor).toFixed(6)),
      inference_ms: Number((nonNegative(baseline.inference_ms, "projection_inference") * factor).toFixed(6)),
      known_cost_by_currency: Object.fromEntries(Object.entries(baseline.known_cost_by_currency ?? {}).map(([currency, value]) => [currency, Number((Number(value) * factor).toFixed(12))])) };
  });
}

export function detectCostAnomalies(current, baseline, { ratio = 2, minimumQuantity = 1 } = {}) {
  const keys = ["AI_INFERENCE", "BANDWIDTH_EGRESS", "STORAGE", "NOTIFICATION"];
  return keys.flatMap(resourceType => {
    const value = Number(current[resourceType] ?? 0), reference = Number(baseline[resourceType] ?? 0);
    return value >= minimumQuantity && reference > 0 && value / reference >= ratio
      ? [{ resource_type: resourceType, status: "ANOMALY_DETECTED", ratio: value / reference, current: value, baseline: reference }] : [];
  });
}

export function assertCostOptimizationSafety({ targetEligible, privacyAllowed, qualityGatePassed }) {
  if (targetEligible !== true) throw new Error("cost_optimization_target_ineligible");
  if (privacyAllowed !== true) throw new Error("cost_optimization_privacy_denied");
  if (qualityGatePassed !== true) throw new Error("cost_optimization_quality_gate_denied");
  return true;
}
