/** Stable public journal vocabulary; no model, transport or database dependency. */
export const GUARD_EVENT_TYPES = [
  "ENTRY", "EXIT", "UNAUTHORIZED_FACE", "KNOWN_FACE", "VEHICLE_IN", "VEHICLE_OUT",
  "PERIMETER_BREACH", "LINE_CROSSING", "FIRE_SMOKE_ALERT", "POOL_HAZARD"
] as const;

export type GuardEventType = typeof GUARD_EVENT_TYPES[number];
