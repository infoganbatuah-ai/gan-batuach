export const MEDIA_FAULT_STATUSES = ["open", "resolved", "waived"] as const;
export type MediaFaultStatus = (typeof MEDIA_FAULT_STATUSES)[number];

export type MediaFaultLifecycle = {
  status: MediaFaultStatus;
  reason: string;
  opened_at: string;
  last_observed_at: string;
  occurrences: number;
  resolved_at?: string;
  waived_at?: string;
  resolution?: string;
  note?: string;
};

type Transition = "opened" | "resolved" | "waived" | "unchanged";

const iso = (value: unknown, fallback: string) => typeof value === "string" && Number.isFinite(Date.parse(value))
  ? new Date(value).toISOString()
  : fallback;
const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim()
  ? value.trim().slice(0, 160)
  : fallback;

/** Read-time compatibility keeps historical missing/failed media visible as an
 * open fault even when the row predates the explicit lifecycle contract. */
export function mediaFaultLifecycle(metadata: Record<string, any> | null | undefined, fallbackAt: string): MediaFaultLifecycle | null {
  const source = metadata?.media_fault;
  if (source && typeof source === "object" && MEDIA_FAULT_STATUSES.includes(source.status)) {
    const openedAt = iso(source.opened_at, fallbackAt);
    return {
      status: source.status,
      reason: text(source.reason, text(metadata?.media_missing_reason, "media_unavailable")),
      opened_at: openedAt,
      last_observed_at: iso(source.last_observed_at, openedAt),
      occurrences: Math.max(1, Math.min(1_000_000, Number(source.occurrences) || 1)),
      ...(source.resolved_at ? { resolved_at: iso(source.resolved_at, openedAt) } : {}),
      ...(source.waived_at ? { waived_at: iso(source.waived_at, openedAt) } : {}),
      ...(source.resolution ? { resolution: text(source.resolution, "documented") } : {}),
      ...(source.note ? { note: text(source.note, "") } : {})
    };
  }
  if (!["missing", "failed"].includes(String(metadata?.media_status))) return null;
  const openedAt = iso(metadata?.last_media_attempt_at ?? metadata?.first_seen, fallbackAt);
  return {
    status: "open",
    reason: text(metadata?.media_missing_reason, "media_unavailable"),
    opened_at: openedAt,
    last_observed_at: openedAt,
    occurrences: 1
  };
}

export function openMediaFault(metadata: Record<string, any>, reason: string, at: string) {
  const now = iso(at, new Date().toISOString());
  const existing = mediaFaultLifecycle(metadata, now);
  const transition: Transition = existing?.status === "open" ? "unchanged" : "opened";
  const fault: MediaFaultLifecycle = existing?.status === "open"
    ? { ...existing, reason: text(reason, existing.reason), last_observed_at: now, occurrences: Math.min(1_000_000, existing.occurrences + 1) }
    : { status: "open", reason: text(reason, "media_unavailable"), opened_at: now, last_observed_at: now, occurrences: 1 };
  return { transition, fault, metadata: { ...metadata, media_fault: fault } };
}

export function resolveMediaFault(metadata: Record<string, any>, at: string, resolution = "media_uploaded") {
  const now = iso(at, new Date().toISOString());
  const existing = mediaFaultLifecycle(metadata, now);
  if (!existing || existing.status === "resolved") return { transition: "unchanged" as const, fault: existing, metadata };
  const fault: MediaFaultLifecycle = { ...existing, status: "resolved", resolved_at: now, resolution: text(resolution, "media_uploaded") };
  return { transition: "resolved" as const, fault, metadata: { ...metadata, media_fault: fault } };
}

export function waiveMediaFault(metadata: Record<string, any>, at: string, note: string) {
  const now = iso(at, new Date().toISOString());
  const existing = mediaFaultLifecycle(metadata, now);
  if (!existing || existing.status !== "open") return { transition: "unchanged" as const, fault: existing, metadata };
  const fault: MediaFaultLifecycle = { ...existing, status: "waived", waived_at: now, resolution: "human_waiver", note: text(note, "ויתור מתועד על מדיה חסרה") };
  return { transition: "waived" as const, fault, metadata: { ...metadata, media_fault: fault } };
}
