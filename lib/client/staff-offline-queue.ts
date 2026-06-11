export type StaffOfflineAction = {
  id: string;
  type: "attendance" | "child_update" | "child_operation";
  label: string;
  endpoint: string;
  method: "POST";
  body: Record<string, unknown>;
  createdAt: string;
};

const queueKey = "gan-batuach-staff-offline-actions";

export function readStaffOfflineQueue(): StaffOfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(queueKey);
    return raw ? JSON.parse(raw) as StaffOfflineAction[] : [];
  } catch {
    return [];
  }
}

export function writeStaffOfflineQueue(rows: StaffOfflineAction[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(queueKey, JSON.stringify(rows));
  window.dispatchEvent(new Event("staff-offline-queue-change"));
}

export function queueStaffOfflineAction(action: Omit<StaffOfflineAction, "id" | "createdAt">) {
  const row: StaffOfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  writeStaffOfflineQueue([...readStaffOfflineQueue(), row]);
  return row;
}

async function attachCurrentPosition(row: StaffOfflineAction) {
  if (row.type !== "attendance" || row.body.gps_lat !== null) return row;
  if (typeof navigator === "undefined" || !navigator.geolocation) return row;
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000 });
  });
  return {
    ...row,
    body: {
      ...row.body,
      gps_lat: position.coords.latitude,
      gps_lng: position.coords.longitude,
      offline: false
    }
  };
}

export async function syncStaffOfflineQueue() {
  const rows = readStaffOfflineQueue();
  const remaining: StaffOfflineAction[] = [];
  const synced: StaffOfflineAction[] = [];
  for (const row of rows) {
    try {
      const readyRow = await attachCurrentPosition(row);
      const response = await fetch(readyRow.endpoint, {
        method: readyRow.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readyRow.body)
      });
      if (response.ok) synced.push(readyRow);
      else remaining.push(row);
    } catch {
      remaining.push(row);
    }
  }
  writeStaffOfflineQueue(remaining);
  return { synced, remaining };
}
