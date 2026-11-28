import {
  digitalObserverCameraOperationalState,
  digitalObserverCameraStreamReference,
} from "@/lib/domain/digital-observer/camera-live-status";

export const EDGE_PLAYBACK_SOURCE_COLUMNS = "id,observer_site_id,source_mode,status,health_status,metadata,last_seen_at,last_health_check_at";

export type EdgePlaybackSourceRow = {
  id: string;
  observer_site_id: string;
  source_mode: string | null;
  status: string | null;
  health_status: string | null;
  metadata: Record<string, unknown> | null;
  last_seen_at: string | null;
  last_health_check_at: string | null;
};

export function resolveEdgePlaybackSource(source: EdgePlaybackSourceRow) {
  // Keep the supported assignment modes identical on issue and redemption.
  if (source.source_mode !== "live" && source.source_mode !== "gateway_test") {
    return { status: "mode_denied" } as const;
  }
  if (digitalObserverCameraOperationalState(source) !== "ONLINE") {
    return { status: "not_online" } as const;
  }

  // The enrolled edge resolves its own gateway stream ID; a conflicting
  // canonical reference must never silently select a different stream.
  const metadata = source.metadata;
  const streamId = digitalObserverCameraStreamReference(source);
  const gatewayStreamId = typeof metadata?.gateway_stream_id === "string" ? metadata.gateway_stream_id.trim() : "";
  if (!streamId || streamId !== gatewayStreamId) {
    return { status: "stream_unmapped" } as const;
  }

  // Old recorder rows predate connector_device_type. Explicit profiles must match.
  const profile = metadata?.connector_device_type ?? "PHYSICAL_GATEWAY";
  if (profile !== "PHYSICAL_GATEWAY" && profile !== "SOFTWARE_CONNECTOR") {
    return { status: "profile_unmapped" } as const;
  }
  const gatewayId = typeof metadata?.gateway_id === "string" ? metadata.gateway_id.trim() : "";
  if (!gatewayId) {
    return { status: "gateway_unmapped" } as const;
  }

  return { status: "eligible", gatewayId, streamId, profile } as const;
}
