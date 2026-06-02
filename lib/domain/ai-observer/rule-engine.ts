import type { ObserverDetection } from "@/lib/domain/ai-observer/detection-engine";

export type RuleDecision =
  | { status: "allow"; dedupeKey: string; severity: string; cooldownSeconds: number; rule: Record<string, any> }
  | { status: "suppressed"; reason: "rule_disabled" | "below_threshold" | "cooldown"; threshold?: number; cooldownSeconds?: number; rule?: Record<string, any> };

export function selectObserverRule(rules: Record<string, any>[], detection: ObserverDetection, kindergartenId: string, cameraId?: string | null, zoneId?: string | null) {
  return (
    rules.find((rule) => rule.enabled && zoneId && rule.zone_id === zoneId && rule.rule_key === detection.rule_key) ??
    rules.find((rule) => rule.enabled && cameraId && rule.camera_id === cameraId && rule.rule_key === detection.rule_key) ??
    rules.find((rule) => rule.enabled && rule.kindergarten_id === kindergartenId && !rule.camera_id && !rule.zone_id && rule.rule_key === detection.rule_key) ??
    rules.find((rule) => rule.enabled && !rule.kindergarten_id && !rule.camera_id && !rule.zone_id && rule.rule_key === detection.rule_key) ??
    rules.find((rule) => rule.rule_key === detection.rule_key) ??
    null
  );
}

export function buildObserverDedupeKey(params: { kindergartenId: string; cameraId?: string | null; zoneId?: string | null; ruleKey: string; bucketMs?: number }) {
  const bucketMs = params.bucketMs ?? 10 * 60 * 1000;
  const bucket = Math.floor(Date.now() / bucketMs);
  return [params.kindergartenId, params.cameraId ?? "garden", params.zoneId ?? "zone", params.ruleKey, bucket].join(":");
}

export function evaluateObserverRule(params: {
  detection: ObserverDetection;
  rules: Record<string, any>[];
  kindergartenId: string;
  cameraId?: string | null;
  zoneId?: string | null;
  recentEvent?: Record<string, any> | null;
}): RuleDecision {
  const rule = selectObserverRule(params.rules, params.detection, params.kindergartenId, params.cameraId, params.zoneId);
  if (!rule || rule.enabled === false) return { status: "suppressed", reason: "rule_disabled", rule: rule ?? undefined };

  const threshold = Number(rule.threshold ?? 0.75);
  if (params.detection.confidence < threshold) {
    return { status: "suppressed", reason: "below_threshold", threshold, rule };
  }

  const cooldownSeconds = Number(rule.cooldown_seconds ?? 300);
  if (params.recentEvent) {
    return { status: "suppressed", reason: "cooldown", cooldownSeconds, rule };
  }

  return {
    status: "allow",
    dedupeKey: buildObserverDedupeKey({
      kindergartenId: params.kindergartenId,
      cameraId: params.cameraId,
      zoneId: params.zoneId,
      ruleKey: params.detection.rule_key,
      bucketMs: cooldownSeconds * 1000
    }),
    severity: String(rule.severity ?? "medium"),
    cooldownSeconds,
    rule
  };
}
