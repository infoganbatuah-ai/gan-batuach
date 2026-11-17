// Discovery is an observation, not permission to forget the last known
// physical source. A failed probe stays visible while the local monitor keeps
// retrying the previously verified stream.
export function retainVerifiedChannels(previous, discovered) {
  if (!Array.isArray(previous) || !Array.isArray(discovered)) throw new TypeError("channels_required");
  return discovered.some(channel => channel.status === "connected")
    ? discovered
    : previous.some(channel => channel.status === "connected") ? previous : discovered;
}

// The startup probe can exhaust its short bounded retry window while a small
// RTSP appliance is still releasing the previous supervised session. Keep a
// fast recovery cadence only while no source has ever connected; normal
// connected operation continues to use the slower periodic discovery cycle.
export function connectorSourceRecoveryRequired(channels) {
  if (!Array.isArray(channels)) throw new TypeError("channels_required");
  return !channels.some(channel => channel?.status === "connected");
}

export function connectorHeartbeatHealth(localHealth, expectedAssigned) {
  const expected = Number.isInteger(expectedAssigned) && expectedAssigned >= 0 ? expectedAssigned : 0;
  const progressing = Number(localHealth?.mediaHeartbeat?.progressingRelays ?? 0);
  const stalled = Number(localHealth?.mediaHeartbeat?.stalledRelays ?? 0);
  const failedDiscovery = Number(localHealth?.failedStreamCount ?? 0);
  const errorCodes = [];
  if (!localHealth?.ok || !Number.isFinite(progressing) || progressing < 0 ||
    !Number.isFinite(stalled) || stalled < 0 || progressing < expected || stalled > 0)
    errorCodes.push("EXPECTED_RELAY_NOT_PROGRESSING");
  if (failedDiscovery > 0) errorCodes.push("DISCOVERY_PROBE_FAILED");
  return {
    status: errorCodes.includes("EXPECTED_RELAY_NOT_PROGRESSING") ? "DEGRADED" : "HEALTHY",
    streamingCount: Number.isFinite(progressing) ? Math.max(0, Math.min(expected, progressing)) : 0,
    errorCodes
  };
}
