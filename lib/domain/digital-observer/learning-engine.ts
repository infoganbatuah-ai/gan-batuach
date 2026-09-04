import { z } from "zod";

export const learningObservationSchema = z.object({
  cameraId: z.string().min(1), zoneName: z.string().min(1), observedAt: z.string().datetime(),
  peopleCount: z.number().int().nonnegative().optional(), vehicleCount: z.number().int().nonnegative().optional(),
  lightLevel: z.number().min(0).max(1).optional(), motionLevel: z.number().min(0).max(1).optional(),
  active: z.boolean().optional()
}).strict();
export type LearningObservation = z.infer<typeof learningObservationSchema>;

const countsSchema = z.object({ people: z.number().int().nonnegative(), vehicles: z.number().int().nonnegative(), light: z.number().int().nonnegative(), motion: z.number().int().nonnegative() });
export const behaviorBaselineSchema = z.object({
  version: z.literal(1), cameraId: z.string().min(1), zoneName: z.string().min(1), timeZone: z.string().min(1),
  samples: z.number().int().nonnegative(), activeHours: z.array(z.number().int().min(0).max(23)).max(24),
  averagePeople: z.number().nonnegative().nullable(), averageVehicles: z.number().nonnegative().nullable(),
  averageLightLevel: z.number().min(0).max(1).nullable(), averageMotionLevel: z.number().min(0).max(1).nullable(),
  metricSamples: countsSchema, confidence: z.number().min(0).max(1),
  startedAt: z.string().datetime(), lastObservedAt: z.string().datetime(), updatedAt: z.string().datetime()
});
export type BehaviorBaseline = z.infer<typeof behaviorBaselineSchema>;

export function observationHour(observedAt: string, timeZone: string) {
  // Explicit tenant timezone: deployment host timezone must not change detection.
  return Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date(observedAt)));
}

function active(observation: LearningObservation) {
  return observation.active === true || (observation.motionLevel ?? 0) > 0.05 || (observation.peopleCount ?? 0) > 0 || (observation.vehicleCount ?? 0) > 0;
}

function mean(previous: number | null, count: number, next: number | undefined) {
  return next === undefined ? previous : ((previous ?? 0) * count + next) / (count + 1);
}

export function updateBehaviorBaseline(previous: BehaviorBaseline | null, input: LearningObservation, timeZone = "UTC", now = new Date()): BehaviorBaseline {
  const observation = learningObservationSchema.parse(input);
  const hour = observationHour(observation.observedAt, timeZone);
  if (previous && (previous.cameraId !== observation.cameraId || previous.timeZone !== timeZone)) throw new Error("LEARNING_SCOPE_MISMATCH");
  if (previous && Date.parse(observation.observedAt) <= Date.parse(previous.lastObservedAt)) return previous;
  const counts = previous?.metricSamples ?? { people: 0, vehicles: 0, light: 0, motion: 0 };
  const samples = (previous?.samples ?? 0) + 1;
  return {
    version: 1, cameraId: observation.cameraId, zoneName: observation.zoneName, timeZone, samples,
    activeHours: [...new Set([...(previous?.activeHours ?? []), ...(active(observation) ? [hour] : [])])].sort((a, b) => a - b),
    averagePeople: mean(previous?.averagePeople ?? null, counts.people, observation.peopleCount),
    averageVehicles: mean(previous?.averageVehicles ?? null, counts.vehicles, observation.vehicleCount),
    averageLightLevel: mean(previous?.averageLightLevel ?? null, counts.light, observation.lightLevel),
    averageMotionLevel: mean(previous?.averageMotionLevel ?? null, counts.motion, observation.motionLevel),
    metricSamples: { people: counts.people + Number(observation.peopleCount !== undefined), vehicles: counts.vehicles + Number(observation.vehicleCount !== undefined),
      light: counts.light + Number(observation.lightLevel !== undefined), motion: counts.motion + Number(observation.motionLevel !== undefined) },
    confidence: Math.min(0.98, samples / 288), startedAt: previous?.startedAt ?? observation.observedAt,
    lastObservedAt: observation.observedAt, updatedAt: now.toISOString()
  };
}

export function learnBehaviorBaseline(observations: LearningObservation[], now = new Date(), timeZone = "UTC"): BehaviorBaseline | null {
  let baseline: BehaviorBaseline | null = null;
  for (const observation of [...observations].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt))) {
    baseline = updateBehaviorBaseline(baseline, observation, timeZone, now);
  }
  return baseline;
}

export function detectBehaviorAnomaly(input: LearningObservation, baseline: BehaviorBaseline, restrictedHours: number[] = []) {
  const observation = learningObservationSchema.parse(input);
  if (observation.cameraId !== baseline.cameraId) throw new Error("LEARNING_SCOPE_MISMATCH");
  const hour = observationHour(observation.observedAt, baseline.timeZone);
  const reasons: string[] = [];
  if (Date.parse(observation.observedAt) <= Date.parse(baseline.lastObservedAt)) return { isAnomaly: false, score: 0, reason: "", reasons };
  // Restricted hours are configured rules. Learned hours need a full week of evidence.
  const learnedHoursReady = baseline.samples >= 288 && Date.parse(baseline.lastObservedAt) - Date.parse(baseline.startedAt) >= 7 * 86_400_000;
  if (active(observation) && (restrictedHours.includes(hour) || (learnedHoursReady && !baseline.activeHours.includes(hour)))) reasons.push("פעילות בשעה חריגה");
  const changed = (value: number | undefined, average: number | null, count: number, threshold: number) =>
    value !== undefined && average !== null && count >= 24 && Math.abs(value - average) >= threshold;
  if (changed(observation.peopleCount, baseline.averagePeople, baseline.metricSamples.people, Math.max(3, (baseline.averagePeople ?? 0) * 1.5))) reasons.push("שינוי חריג בכמות האנשים");
  if (changed(observation.vehicleCount, baseline.averageVehicles, baseline.metricSamples.vehicles, Math.max(2, (baseline.averageVehicles ?? 0) * 1.5))) reasons.push("שינוי חריג בכמות כלי הרכב");
  if (changed(observation.motionLevel, baseline.averageMotionLevel, baseline.metricSamples.motion, 0.35)) reasons.push("שינוי חריג בתנועה");
  if (changed(observation.lightLevel, baseline.averageLightLevel, baseline.metricSamples.light, 0.45)) reasons.push("שינוי חריג בתאורה");
  const score = Math.min(1, reasons.length * 0.35);
  return { isAnomaly: reasons.length > 0, score, reason: reasons.join("; "), reasons };
}
