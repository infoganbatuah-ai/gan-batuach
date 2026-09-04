type Source = Record<string, any>;
const meaningfulName = (value: unknown) => typeof value === "string" && value.trim() && !/^(?:DVR\s*)?(?:ערוץ|channel|camera)\s*\d+$/i.test(value.trim());

/** Periodic hardware discovery owns connectivity, not the user's spatial policy. */
export function preserveCameraDiscoverySettings(existing: Source, discovered: Source): Source {
  if (existing.observer_site_id && existing.observer_site_id !== discovered.observer_site_id) throw new Error("CAMERA_DISCOVERY_SCOPE_MISMATCH");
  const previous = existing.metadata ?? {};
  const namedByUser = previous.user_assigned_name || previous.ai_suggested_name || (meaningfulName(existing.display_name) ? existing.display_name : null);
  const namedLocation = previous.user_assigned_location || previous.ai_suggested_location || (meaningfulName(existing.location_label) ? existing.location_label : null);
  return {
    ...discovered,
    display_name: namedByUser || discovered.display_name,
    location_label: namedLocation || discovered.location_label,
    status: existing.status === "disabled" ? "disabled" : discovered.status,
    monitoring_targets: existing.monitoring_targets ?? discovered.monitoring_targets,
    capabilities: { ...existing.capabilities, ...discovered.capabilities },
    metadata: { ...previous, ...discovered.metadata }
  };
}
