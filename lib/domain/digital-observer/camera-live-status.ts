const connectedStatuses = new Set(["connected", "healthy", "online", "active"]);
const unavailableStatuses = new Set(["offline", "failed", "error", "disabled", "blocked"]);

export function digitalObserverGatewayStreamId(camera: Record<string, any>) {
  const value = camera.metadata?.gateway_stream_id ?? camera.gateway_stream_id ?? camera.video_gateway_stream_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function digitalObserverCameraIsConnected(camera: Record<string, any>) {
  const status = String(camera.status ?? "").toLowerCase();
  const health = String(camera.health_status ?? "").toLowerCase();
  if (unavailableStatuses.has(status) || unavailableStatuses.has(health)) return false;
  return connectedStatuses.has(status) || connectedStatuses.has(health);
}

export function digitalObserverCameraHasLiveGateway(camera: Record<string, any>) {
  return Boolean(digitalObserverGatewayStreamId(camera) && digitalObserverCameraIsConnected(camera));
}
