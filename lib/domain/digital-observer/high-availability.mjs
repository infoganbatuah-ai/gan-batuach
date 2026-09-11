import { createHash } from "node:crypto";

export const HA_SERVICE_CONTRACT = "observer-ha-service-v1";
export const HA_RETRY_POLICY = "observer-ha-retry-policy-v1";
const STATES = new Set(["HEALTHY", "DEGRADED", "UNHEALTHY", "REMOVED", "RECOVERING"]);
const FORBIDDEN = /(password|secret|authorization|private.?key|credential|token|signed.?url)/i;

const required = (value, name) => {
  if (typeof value !== "string" || !value || value.length > 160) throw new Error(`ha_${name}_invalid`);
  return value;
};
const safe = (value, depth = 0) => {
  if (depth > 6) throw new Error("ha_metadata_depth");
  if (Array.isArray(value)) return value.map(item => safe(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) throw new Error("ha_secret_field_rejected");
    output[key] = safe(item, depth + 1);
  }
  return output;
};
const hash = value => createHash("sha256").update(String(value)).digest().readUInt32BE(0);

export function createHealthAwareServicePool({ now = Date.now, unhealthyAfterMs = 10_000, recoveryPasses = 2, flapWindowMs = 60_000, flapLimit = 4, cooldownMs = 30_000 } = {}) {
  const instances = new Map();
  const metrics = { selections: 0, failovers: 0, removed: 0, recoveries: 0, no_healthy_instance: 0 };

  function register(input) {
    if (input?.identity?.authenticated !== true || input.identity.revoked === true) throw new Error("ha_instance_authentication_required");
    const id = required(input.instance_id, "instance_id");
    const state = STATES.has(input.health) ? input.health : "HEALTHY";
    const existing = instances.get(id);
    instances.set(id, {
      instance_id: id,
      service: required(input.service, "service"),
      capabilities: [...new Set(input.capabilities ?? [])],
      scopes: [...new Set(input.scopes ?? ["*"])],
      health: state,
      last_seen_at: now(),
      in_flight: 0,
      weight: Math.max(1, Math.min(100, Number(input.weight ?? 1))),
      successful_probes: state === "HEALTHY" ? recoveryPasses : 0,
      transitions: existing?.transitions ?? [],
      cooldown_until: existing?.cooldown_until ?? 0,
      metadata: safe(input.metadata ?? {})
    });
    return id;
  }

  function transition(instance, health, reason) {
    if (!STATES.has(health)) throw new Error("ha_health_state_invalid");
    if (instance.health !== health) {
      instance.transitions.push({ at: now(), from: instance.health, to: health, reason: String(reason ?? "HEALTH_CHANGE").slice(0, 96) });
      instance.transitions = instance.transitions.filter(item => now() - item.at <= flapWindowMs);
      if (instance.transitions.length >= flapLimit) instance.cooldown_until = now() + cooldownMs;
    }
    instance.health = health;
    if (["UNHEALTHY", "REMOVED"].includes(health)) metrics.removed++;
  }

  function heartbeat(instanceId, { healthy = true, reason = "HEALTH_PROBE", capabilities } = {}) {
    const instance = instances.get(instanceId);
    if (!instance) throw new Error("ha_instance_missing");
    instance.last_seen_at = now();
    if (capabilities) instance.capabilities = [...new Set(capabilities)];
    if (!healthy) {
      instance.successful_probes = 0;
      transition(instance, "UNHEALTHY", reason);
      return snapshotInstance(instance);
    }
    instance.successful_probes++;
    if (instance.health !== "HEALTHY") {
      transition(instance, "RECOVERING", reason);
      if (instance.successful_probes >= recoveryPasses && instance.cooldown_until <= now()) {
        transition(instance, "HEALTHY", "RECOVERY_HEALTH_GATE_PASSED");
        metrics.recoveries++;
      }
    }
    return snapshotInstance(instance);
  }

  function refresh() {
    for (const instance of instances.values()) {
      if (now() - instance.last_seen_at > unhealthyAfterMs && !["UNHEALTHY", "REMOVED"].includes(instance.health)) transition(instance, "UNHEALTHY", "HEARTBEAT_STALE");
    }
  }

  function select({ service, capability, scope = "*", affinityKey = "default", exclude = [] }) {
    refresh();
    const excluded = new Set(exclude);
    const eligible = [...instances.values()].filter(instance => instance.service === service && instance.health === "HEALTHY" && instance.cooldown_until <= now()
      && !excluded.has(instance.instance_id) && (!capability || instance.capabilities.includes(capability)) && (instance.scopes.includes("*") || instance.scopes.includes(scope)));
    if (!eligible.length) { metrics.no_healthy_instance++; return { status: "NO_HEALTHY_INSTANCE", selected: null }; }
    eligible.sort((a, b) => (a.in_flight / a.weight) - (b.in_flight / b.weight) || ((hash(`${affinityKey}:${a.instance_id}`) - hash(`${affinityKey}:${b.instance_id}`))));
    const selected = eligible[0];
    selected.in_flight++;
    metrics.selections++;
    if (excluded.size) metrics.failovers++;
    return { status: "SELECTED", selected: snapshotInstance(selected), eligible_count: eligible.length };
  }

  function complete(instanceId) {
    const instance = instances.get(instanceId);
    if (instance) instance.in_flight = Math.max(0, instance.in_flight - 1);
  }
  function snapshotInstance(instance) { return Object.freeze({ instance_id: instance.instance_id, service: instance.service, health: instance.health, capabilities: [...instance.capabilities], in_flight: instance.in_flight, last_seen_at: new Date(instance.last_seen_at).toISOString(), flapping: instance.cooldown_until > now(), metadata: instance.metadata }); }
  function snapshot() { refresh(); return Object.freeze({ contract: HA_SERVICE_CONTRACT, instances: [...instances.values()].map(snapshotInstance), ...metrics }); }
  return Object.freeze({ contract: HA_SERVICE_CONTRACT, register, heartbeat, select, complete, snapshot });
}

export function createRetryBudget(input = {}) {
  const budgets = Object.freeze({
    IDEMPOTENT_READ: { attempts: 3, base_delay_ms: 100, circuit_failures: 5 },
    IDEMPOTENT_WRITE: { attempts: 2, base_delay_ms: 250, circuit_failures: 3 },
    DEVICE_COMMAND: { attempts: 1, base_delay_ms: 0, circuit_failures: 2 },
    EVIDENCE_WRITE: { attempts: 2, base_delay_ms: 500, circuit_failures: 3 },
    ...(input.budgets ?? {})
  });
  const now = input.now ?? Date.now;
  const cooldownMs = Math.max(100, Number(input.cooldownMs ?? 30_000));
  const dependencies = new Map();
  const state = dependency => dependencies.get(dependency) ?? { failures: 0, open_until: 0, probes: 0 };
  function before(dependency, operation) {
    const policy = budgets[operation]; if (!policy) throw new Error("ha_retry_operation_invalid");
    const current = state(dependency);
    if (current.open_until > now()) throw new Error("ha_circuit_open");
    if (current.open_until && current.open_until <= now()) current.probes++;
    dependencies.set(dependency, current);
    return Object.freeze({ contract: HA_RETRY_POLICY, operation, ...policy });
  }
  function success(dependency) { dependencies.set(dependency, { failures: 0, open_until: 0, probes: state(dependency).probes }); }
  function failure(dependency, operation) {
    const policy = budgets[operation]; if (!policy) throw new Error("ha_retry_operation_invalid");
    const current = state(dependency); current.failures++;
    if (current.failures >= policy.circuit_failures) current.open_until = now() + cooldownMs;
    dependencies.set(dependency, current); return { circuit_open: current.open_until > now(), failures: current.failures };
  }
  function snapshot() { return Object.fromEntries([...dependencies].map(([key, value]) => [key, { ...value, circuit_open: value.open_until > now() }])); }
  return Object.freeze({ contract: HA_RETRY_POLICY, before, success, failure, snapshot });
}

export function createStorageFailoverPolicy({ primary, alternates = [], allowedAlternateIds = [], enqueuePending, onUsage } = {}) {
  if (!primary?.write) throw new Error("ha_storage_primary_required");
  const allowed = new Set(allowedAlternateIds);
  return Object.freeze({
    async write(input) {
      try { const result = await primary.write(input); onUsage?.({ operation: "PRIMARY_WRITE", backend_id: primary.id, state: "AVAILABLE" }); return { state: "AVAILABLE", backend_id: primary.id, result }; }
      catch (primaryError) {
        for (const alternate of alternates) {
          if (!allowed.has(alternate.id)) continue;
          try { const result = await alternate.write(input); onUsage?.({ operation: "AUTHORIZED_FAILOVER_WRITE", backend_id: alternate.id, state: "AVAILABLE" }); return { state: "AVAILABLE", backend_id: alternate.id, result, failed_over: true }; } catch {}
        }
        await enqueuePending?.(input);
        onUsage?.({ operation: "WRITE_PENDING", backend_id: primary.id, state: "PENDING_UPLOAD" });
        return { state: "PENDING_UPLOAD", backend_id: primary.id, reason: "STORAGE_UNAVAILABLE", error_class: primaryError?.name ?? "Error" };
      }
    }
  });
}
