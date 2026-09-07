import { z } from "zod";
import { connectivityFamilyIds, connectivityRegistryVersion, connectionStrategies } from "./connectivity-registry";
import { connectionFailureCategories, connectionOrchestratorVersion, isZeroInstallPath, type PersistentPathProof } from "./connection-orchestrator";

export const connectivityObservationSchema = z.object({
  attemptId: z.string().uuid(),
  siteId: z.string().uuid(),
  family: z.enum(connectivityFamilyIds),
  strategy: z.enum(connectionStrategies).nullable(),
  registryVersion: z.literal(connectivityRegistryVersion),
  orchestratorVersion: z.enum(["connection-orchestrator-v1", connectionOrchestratorVersion]),
  firmware: z.string().regex(/^\d{1,3}(\.\d{1,3}){0,3}$/).nullable(),
  outcome: z.enum(["ACTIVATED", "FAILED", "INTEGRATION_MISSING", "ABANDONED"]),
  failure: z.enum(connectionFailureCategories).nullable(),
  durationMs: z.number().int().min(0).max(7 * 86400_000).nullable(),
  interactions: z.number().int().min(0).max(1000).nullable(),
  manualFields: z.number().int().min(0).max(100).nullable(),
  externalAppSteps: z.number().int().min(0).max(100).nullable(),
  installationRequired: z.boolean(),
  manualSupportRequired: z.boolean().nullable(),
  stability: z.object({ observedSeconds: z.number().int().min(0).max(90 * 86400),
    progressingSeconds: z.number().int().min(0).max(90 * 86400),
    reconnects: z.number().int().min(0).max(100000), authFailures: z.number().int().min(0).max(100000) }).strict().nullable(),
  occurredAt: z.string().datetime(),
  provenance: z.enum(["PRODUCTION", "CLIENT_REPORTED", "TEST"]),
  zeroInstallVerified: z.boolean(),
  commercial: z.object({
    productActions: z.number().int().min(0).max(1000).nullable(),
    technicalActions: z.number().int().min(0).max(1000).nullable(),
    installerActions: z.number().int().min(0).max(100).nullable(),
    discoverySucceeded: z.boolean().nullable(),
    technicalCapability: z.enum(["PERSISTENT_ZERO_INSTALL", "LOCAL_PATH_VERIFIED", "UNKNOWN"]),
    digitalObserverCoverage: z.enum(["IMPLEMENTED", "INTEGRATION_MISSING", "UNKNOWN"]),
    observedSuccess: z.enum(["REAL_DEPLOYMENT", "CONTROLLED_TEST", "NOT_VERIFIED"]),
    requirementBasis: z.enum(["TECHNICAL", "POLICY", "PRODUCT_COVERAGE", "UNKNOWN"])
  }).strict().optional()
}).strict().superRefine((sample, context) => {
  if (sample.stability && sample.stability.progressingSeconds > sample.stability.observedSeconds)
    context.addIssue({ code: "custom", message: "INVALID_STABILITY_WINDOW", path: ["stability"] });
  if (sample.outcome === "ACTIVATED" && (!sample.strategy || sample.failure))
    context.addIssue({ code: "custom", message: "INVALID_ACTIVATION_OUTCOME" });
  if (sample.zeroInstallVerified && (sample.outcome !== "ACTIVATED" || sample.installationRequired
    || !sample.strategy || ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY", "ENTERPRISE_EDGE"].includes(sample.strategy)))
    context.addIssue({ code: "custom", message: "INVALID_ZERO_INSTALL_CLAIM" });
});
export type ConnectivityObservation = z.infer<typeof connectivityObservationSchema>;

// Only server-side outcome adapters should call this. User reports may contribute
// friction/failure information; they cannot supply production activation proof.
export function sanitizeConnectivityObservation(input: unknown, authorizedSiteId: string, proof?: PersistentPathProof): ConnectivityObservation {
  const observation = connectivityObservationSchema.parse(input);
  if (observation.siteId !== authorizedSiteId) throw new Error("CONNECTIVITY_SCOPE_DENIED");
  if (observation.zeroInstallVerified && (!proof || proof.strategy !== observation.strategy || !isZeroInstallPath(proof)))
    throw new Error("PERSISTENCE_PROOF_REQUIRED");
  return observation;
}

export function connectionEffort(sample: ConnectivityObservation) {
  // Internal friction index, not an industry standard or model-quality score.
  if (sample.interactions === null || sample.manualFields === null || sample.externalAppSteps === null || sample.manualSupportRequired === null) return null;
  return Math.min(100, sample.interactions + sample.manualFields * 2 + sample.externalAppSteps * 5
    + Number(sample.installationRequired) * 20 + Number(sample.manualSupportRequired) * 40
    + Math.min(10, Math.floor((sample.durationMs ?? 0) / 60000)));
}

export function aggregateConnectivity(observations: readonly ConnectivityObservation[], now = new Date()) {
  const seen = new Set<string>();
  const groups = new Map<string, { family: ConnectivityObservation["family"]; strategy: ConnectivityObservation["strategy"];
    firmware: string | null; registryVersion: string; orchestratorVersion: string; sampleCount: number;
    successCount: number; failureCount: number; zeroInstallCount: number; supportCount: number;
    totalDurationMs: number; timedSamples: number; effortTotal: number; effortSamples: number; observedSeconds: number;
    progressingSeconds: number; reconnects: number; authFailures: number; lastVerified: string;
    failureCategories: Partial<Record<typeof connectionFailureCategories[number], number>> }>();
  for (const raw of observations) {
    const sample = connectivityObservationSchema.parse(raw);
    if (sample.provenance !== "PRODUCTION") continue;
    const age = now.getTime() - Date.parse(sample.occurredAt);
    if (age < 0 || age > 90 * 86400_000) continue;
    const key = `${sample.siteId}:${sample.attemptId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const groupKey = JSON.stringify([sample.family, sample.strategy, sample.firmware, sample.registryVersion, sample.orchestratorVersion]);
    const group = groups.get(groupKey) ?? { family: sample.family, strategy: sample.strategy, firmware: sample.firmware,
      registryVersion: sample.registryVersion, orchestratorVersion: sample.orchestratorVersion,
      sampleCount: 0, successCount: 0, failureCount: 0, zeroInstallCount: 0, supportCount: 0,
      totalDurationMs: 0, timedSamples: 0, effortTotal: 0, effortSamples: 0, observedSeconds: 0, progressingSeconds: 0,
      reconnects: 0, authFailures: 0, lastVerified: sample.occurredAt, failureCategories: {} };
    group.sampleCount++;
    group.successCount += Number(sample.outcome === "ACTIVATED");
    group.failureCount += Number(sample.outcome === "FAILED");
    group.zeroInstallCount += Number(sample.zeroInstallVerified);
    group.supportCount += Number(sample.manualSupportRequired);
    const effort = connectionEffort(sample);
    if (effort !== null) { group.effortTotal += effort; group.effortSamples++; }
    if (sample.durationMs !== null && sample.outcome === "ACTIVATED") {
      group.totalDurationMs += sample.durationMs; group.timedSamples++;
    }
    if (sample.stability) {
      group.observedSeconds += sample.stability.observedSeconds;
      group.progressingSeconds += sample.stability.progressingSeconds;
      group.reconnects += sample.stability.reconnects; group.authFailures += sample.stability.authFailures;
    }
    if (sample.failure) group.failureCategories[sample.failure] = (group.failureCategories[sample.failure] ?? 0) + 1;
    if (sample.occurredAt > group.lastVerified) group.lastVerified = sample.occurredAt;
    groups.set(groupKey, group);
  }
  // No attempt/site/user/network identifiers survive into global pattern output.
  return Array.from(groups.values()).map(group => ({
    ...group,
    successRate: group.successCount / group.sampleCount,
    failureRate: group.failureCount / group.sampleCount,
    zeroInstallActivationRate: group.zeroInstallCount / group.sampleCount,
    denominator: "ALL_RECORDED_ELIGIBLE_ATTEMPTS" as const,
    meanTimeToActiveMs: group.timedSamples ? group.totalDurationMs / group.timedSamples : null,
    meanEffort: group.effortSamples ? group.effortTotal / group.effortSamples : null,
    availability: group.observedSeconds ? group.progressingSeconds / group.observedSeconds : null,
    maturity: group.sampleCount < 20 ? "INSUFFICIENT_SAMPLES" as const : "CANDIDATE_KNOWLEDGE" as const,
    promotion: "HUMAN_VALIDATION_REQUIRED" as const,
    autoApply: false as const
  }));
}
