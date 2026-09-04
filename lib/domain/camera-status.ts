export const cameraOperationalStatuses = ["connected", "connecting", "pending", "offline", "error", "disabled"] as const;
export type CameraOperationalStatus = (typeof cameraOperationalStatuses)[number];

export function normalizeCameraStatus(value?: string | null, active = true): CameraOperationalStatus {
  if (!active) return "disabled";
  const normalized = String(value ?? "pending").trim().toLowerCase();
  if (["connected", "online"].includes(normalized)) return "connected";
  if (["connecting"].includes(normalized)) return "connecting";
  if (["offline", "failed"].includes(normalized)) return "offline";
  if (["error"].includes(normalized)) return "error";
  if (["disabled"].includes(normalized)) return "disabled";
  return "pending";
}
