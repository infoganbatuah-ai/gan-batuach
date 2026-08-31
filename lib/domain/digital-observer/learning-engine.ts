export type LearningObservation = {
  cameraId: string;
  zoneName: string;
  observedAt: string;
  peopleCount?: number;
  vehicleCount?: number;
  lightLevel?: number;
  active?: boolean;
};

export type BehaviorBaseline = {
  cameraId: string;
  zoneName: string;
  samples: number;
  activeHours: number[];
  averagePeople: number;
  averageVehicles: number;
  averageLightLevel: number | null;
  confidence: number;
  updatedAt: string;
};

function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

export function learnBehaviorBaseline(observations: LearningObservation[], now = new Date()): BehaviorBaseline | null {
  if (!observations.length) return null;
  const first = observations[0];
  const people = observations.map((item) => item.peopleCount ?? 0);
  const vehicles = observations.map((item) => item.vehicleCount ?? 0);
  const lights = observations.map((item) => item.lightLevel).filter((item): item is number => typeof item === "number");
  const activeHours = [...new Set(observations.filter((item) => item.active !== false).map((item) => new Date(item.observedAt).getHours()))].sort((a, b) => a - b);
  return {
    cameraId: first.cameraId,
    zoneName: first.zoneName,
    samples: observations.length,
    activeHours,
    averagePeople: average(people),
    averageVehicles: average(vehicles),
    averageLightLevel: lights.length ? average(lights) : null,
    confidence: Math.min(0.98, Math.max(0.05, observations.length / 100)),
    updatedAt: now.toISOString()
  };
}

export function detectBehaviorAnomaly(observation: LearningObservation, baseline: BehaviorBaseline, restrictedHours: number[] = []) {
  const hour = new Date(observation.observedAt).getHours();
  const peopleDelta = Math.abs((observation.peopleCount ?? 0) - baseline.averagePeople);
  const vehicleDelta = Math.abs((observation.vehicleCount ?? 0) - baseline.averageVehicles);
  const unusualHour = restrictedHours.includes(hour) || (baseline.activeHours.length > 3 && !baseline.activeHours.includes(hour));
  const score = Math.min(1, (peopleDelta > Math.max(2, baseline.averagePeople * 1.5) ? 0.45 : 0) + (vehicleDelta > Math.max(1, baseline.averageVehicles * 1.5) ? 0.3 : 0) + (unusualHour ? 0.35 : 0));
  return { isAnomaly: score >= 0.35, score, reason: unusualHour ? "פעילות בשעה חריגה" : peopleDelta > vehicleDelta ? "שינוי חריג בכמות האנשים" : "שינוי חריג בפעילות" };
}
