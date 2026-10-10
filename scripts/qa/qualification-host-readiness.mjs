import { execFile } from "node:child_process";
import { availableParallelism, freemem, loadavg, totalmem, uptime } from "node:os";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const QUALIFICATION_HOST_LIMITS = Object.freeze({
  minimum_samples: 5,
  maximum_normalized_load_1m: 1.5,
  maximum_health_p95_ms: 500,
  maximum_health_sample_ms: 1_000
});

const FORBIDDEN_WORKLOADS = Object.freeze([
  ["NEXT_DEVELOPMENT_SERVER", /node_modules\/next\/dist\/bin\/next\s+dev\b/],
  ["LOCAL_PRODUCTION_PREVIEW", /\/tmp\/start-merged-prod\.mjs\b/],
  ["NEXT_BUILD", /node_modules\/next\/dist\/bin\/next\s+build\b/],
  ["TYPESCRIPT_BUILD", /(?:^|\s)(?:tsc|tsgo)\b[^\n]*--noEmit\b/],
  ["SYNTHETIC_SCALE_BENCHMARK", /(?:horizontal|queue)[^\n]*(?:benchmark|throughput)/i],
  ["NON_QUALIFICATION_COLIMA_GBI", /(?:\.colima|colima)[^\n]*\bgbi\b/]
]);

function isInspectionOnlyCommand(command) {
  const value = String(command || "").trim();
  const executable = value.split(/\s+/, 1)[0] || "";
  if (/(?:^|\/)(?:rg|grep)$/.test(executable)) return true;
  return /(?:^|\/)(?:zsh|bash|sh)\s+-lc\b/.test(value) &&
    /\bps\s+-axo\b/.test(value) && /\b(?:rg|grep)\b/.test(value);
}

export function classifyForbiddenWorkloads(command) {
  if (isInspectionOnlyCommand(command)) return [];
  return FORBIDDEN_WORKLOADS
    .filter(([, pattern]) => pattern.test(String(command || "")))
    .map(([classification]) => classification);
}

const percentile = (values, fraction) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  return sorted.length ? sorted[Math.min(sorted.length - 1,
    Math.ceil(sorted.length * fraction) - 1)] : null;
};

export function classifyHostPressure(normalizedLoad1m) {
  if (!Number.isFinite(normalizedLoad1m)) return "UNKNOWN";
  if (normalizedLoad1m > QUALIFICATION_HOST_LIMITS.maximum_normalized_load_1m) return "SATURATED";
  if (normalizedLoad1m > 1) return "ELEVATED";
  return "NORMAL";
}

export async function inspectQualificationHost() {
  const logicalCpus = Math.max(1, availableParallelism());
  const loads = loadavg();
  let processRows = [];
  try {
    const { stdout } = await exec("/bin/ps", ["-axo", "pid=,command="], {
      timeout: 3_000,
      maxBuffer: 4 * 1024 * 1024
    });
    processRows = stdout.split("\n").flatMap(line => {
      const match = /^\s*(\d+)\s+(.+)$/.exec(line);
      if (!match) return [];
      const command = match[2];
      const classifications = classifyForbiddenWorkloads(command);
      return classifications.length ? [{ pid: Number(match[1]), classifications }] : [];
    });
  } catch {
    processRows = [{ pid: null, classifications: ["PROCESS_INSPECTION_UNAVAILABLE"] }];
  }
  const classifications = [...new Set(processRows.flatMap(row => row.classifications))].sort();
  const normalizedLoad1m = loads[0] / logicalCpus;
  return {
    observed_at: new Date().toISOString(),
    logical_cpus: logicalCpus,
    load_average: loads,
    normalized_load_1m: Number(normalizedLoad1m.toFixed(4)),
    pressure: classifyHostPressure(normalizedLoad1m),
    free_memory_ratio: Number((freemem() / Math.max(1, totalmem())).toFixed(4)),
    uptime_seconds: Math.floor(uptime()),
    forbidden_workloads: classifications,
    forbidden_workload_processes: processRows.length
  };
}

export function evaluateQualificationHostReadiness(samples, limits = QUALIFICATION_HOST_LIMITS) {
  const failures = [];
  if (!Array.isArray(samples) || samples.length < limits.minimum_samples)
    failures.push("HOST_READINESS_SAMPLE_COUNT_INSUFFICIENT");
  const gatewayLatencies = (samples || []).map(sample => sample.gateway?.latency_ms).filter(Number.isFinite);
  const connectorLatencies = (samples || []).map(sample => sample.connector?.latency_ms).filter(Number.isFinite);
  const forbidden = [...new Set((samples || []).flatMap(sample => sample.host?.forbidden_workloads || []))].sort();
  if (forbidden.length) failures.push("FORBIDDEN_DEVELOPMENT_WORKLOAD_ACTIVE");
  if ((samples || []).some(sample => sample.host?.pressure === "SATURATED"))
    failures.push("HOST_LOAD_SATURATED");
  if ((samples || []).some(sample => sample.gateway?.ok !== true || sample.connector?.ok !== true))
    failures.push("EDGE_HEALTH_PREFLIGHT_FAILED");
  const healthLatencies = [...gatewayLatencies, ...connectorLatencies];
  if (percentile(healthLatencies, 0.95) > limits.maximum_health_p95_ms)
    failures.push("EDGE_HEALTH_LATENCY_P95_EXCEEDED");
  if (healthLatencies.some(value => value > limits.maximum_health_sample_ms))
    failures.push("EDGE_HEALTH_LATENCY_SAMPLE_EXCEEDED");
  return {
    contract: "observer-qualification-host-readiness-v1",
    status: failures.length ? "FAIL" : "PASS",
    sample_count: Array.isArray(samples) ? samples.length : 0,
    limits,
    failures,
    forbidden_workloads: forbidden,
    gateway_health_latency_ms: {
      p95: percentile(gatewayLatencies, 0.95),
      max: gatewayLatencies.length ? Math.max(...gatewayLatencies) : null
    },
    connector_health_latency_ms: {
      p95: percentile(connectorLatencies, 0.95),
      max: connectorLatencies.length ? Math.max(...connectorLatencies) : null
    },
    samples
  };
}

export function summarizeQualificationHostEvidence(checkpoints) {
  const hosts = (checkpoints || []).map(point => point.host).filter(Boolean);
  const forbidden = hosts.filter(host => (host.forbidden_workloads || []).length > 0).length;
  const saturated = hosts.filter(host => host.pressure === "SATURATED").length;
  const interference = (checkpoints || []).filter(point => {
    if ((point.host?.forbidden_workloads || []).length) return true;
    if (point.host?.pressure !== "SATURATED") return false;
    return point.probe_duration_ms > QUALIFICATION_HOST_LIMITS.maximum_health_sample_ms ||
      point.dvr?.classification !== "PASS" || point.tapo?.classification !== "PASS";
  }).length;
  const ratios = hosts.map(host => host.normalized_load_1m).filter(Number.isFinite);
  return {
    observations: hosts.length,
    pressure: {
      normal: hosts.filter(host => host.pressure === "NORMAL").length,
      elevated: hosts.filter(host => host.pressure === "ELEVATED").length,
      saturated
    },
    forbidden_workload_checkpoints: forbidden,
    qualification_interference_checkpoints: interference,
    normalized_load_1m: {
      p95: percentile(ratios, 0.95),
      max: ratios.length ? Math.max(...ratios) : null
    }
  };
}
