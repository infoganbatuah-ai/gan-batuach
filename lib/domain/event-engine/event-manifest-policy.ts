import "server-only";
import type { ZoneType } from "./camera-zone-mapper";

type ManifestPolicyInput = {
  zone_type: ZoneType;
  monitoring_enabled: boolean;
  off_hours_active: boolean;
  allowed_event_types: readonly string[];
  implemented_event_types: readonly string[];
  verified_event_models?: unknown;
};

const offHoursZone: Readonly<Record<string, ZoneType>> = {
  person_near_pool_off_hours: "POOL",
  unauthorized_night_motion: "PERIMETER"
};
const MAX_EVENT_TYPES = 64;
const validType = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9_]{1,79}$/.test(value);
function bounded(values: readonly string[]): string[] {
  if (!Array.isArray(values) || values.length > MAX_EVENT_TYPES || values.some(value => !validType(value))) return [];
  return [...new Set(values)];
}
function verified(models: unknown, eventType: string): boolean {
  return Boolean(models && typeof models === "object" && !Array.isArray(models)
    && Object.prototype.hasOwnProperty.call(models, eventType)
    && (models as Record<string, unknown>)[eventType] === true);
}

/** Produces the only event lists exposed to the local runtime. Metadata can
 * remove support but cannot invent an event outside the cloud-owned lists. */
export function eventManifestPolicy(input: ManifestPolicyInput) {
  const allowed = bounded(input.allowed_event_types);
  const implemented = new Set(bounded(input.implemented_event_types));
  if (!input.monitoring_enabled || !allowed.length || !implemented.size) {
    return { off_hours_active: false, supported_event_types: [] as string[], verified_event_types: [] as string[] };
  }
  const supported = allowed.filter(eventType => {
    if (!implemented.has(eventType)) return false;
    const requiredZone = offHoursZone[eventType];
    return !requiredZone || requiredZone === input.zone_type
      && input.off_hours_active && verified(input.verified_event_models, eventType);
  });
  const verifiedTypes = supported.filter(eventType => verified(input.verified_event_models, eventType));
  return {
    off_hours_active: input.off_hours_active,
    supported_event_types: supported,
    verified_event_types: verifiedTypes
  };
}
