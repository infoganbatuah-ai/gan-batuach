/** Canonical spatial vocabulary used by the event engine. Database values are
 * deliberately normalized here so older camera_zones rows remain supported. */
export const ZONE_TYPES = ["PARKING", "POOL", "ENTRANCE", "PERIMETER", "INDOOR"] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

export type CameraZone = {
  camera_id: string;
  camera_name: string;
  zone_type: ZoneType;
  zone_id?: string | null;
  source: "explicit" | "inferred" | "default";
};

const aliases: Record<string, ZoneType> = {
  parking: "PARKING", garage: "PARKING", driveway: "PARKING", חניה: "PARKING", חנייה: "PARKING", מוסך: "PARKING", parking_lot: "PARKING",
  pool: "POOL", backyard_pool: "POOL", בריכה: "POOL", בריכת: "POOL",
  entrance: "ENTRANCE", entry: "ENTRANCE", door: "ENTRANCE", דלת: "ENTRANCE", כניסה: "ENTRANCE",
  perimeter: "PERIMETER", fence: "PERIMETER", גדר: "PERIMETER", היקף: "PERIMETER",
  indoor: "INDOOR", classroom: "INDOOR", living_room: "INDOOR", סלון: "INDOOR", חדר: "INDOOR", כיתה: "INDOOR", playground: "INDOOR", yard: "INDOOR", lobby: "INDOOR", hallway: "INDOOR", restricted_area: "INDOOR"
};

function text(value: unknown) { return typeof value === "string" ? value.toLowerCase().trim() : ""; }

export function normalizeZoneType(value: unknown): ZoneType | null {
  const valueText = text(value).replace(/[ -]/g, "_");
  if (ZONE_TYPES.includes(valueText.toUpperCase() as ZoneType)) return valueText.toUpperCase() as ZoneType;
  return aliases[valueText] ?? null;
}

function inferZone(camera: Record<string, any>, zone?: Record<string, any> | null): ZoneType | null {
  const explicit = normalizeZoneType(zone?.zone_type) ?? normalizeZoneType(camera.camera_zone_type);
  if (explicit) return explicit;
  const haystack = [camera.name, camera.area, camera.location, camera.spatial_name, zone?.name, zone?.description].map(text).join(" ");
  for (const [alias, type] of Object.entries(aliases)) if (haystack.includes(alias.replace(/_/g, " "))) return type;
  return null;
}

export interface CameraZoneMapper {
  map(camera: Record<string, any>, zone?: Record<string, any> | null): CameraZone;
  discoverAllConnectedCameras(supabase: any, scope?: { gardenId?: string; observerSiteId?: string }): Promise<CameraZone[]>;
}

export class DefaultCameraZoneMapper implements CameraZoneMapper {
  map(camera: Record<string, any>, zone?: Record<string, any> | null): CameraZone {
    const type = inferZone(camera, zone) ?? "INDOOR";
    return { camera_id: String(camera.id ?? camera.camera_id), camera_name: String(camera.spatial_name ?? camera.name ?? camera.area ?? `Camera ${camera.id}`), zone_type: type, zone_id: zone?.id ?? null, source: inferZone(camera, zone) ? (normalizeZoneType(zone?.zone_type) || normalizeZoneType(camera.camera_zone_type) ? "explicit" : "inferred") : "default" };
  }

  async discoverAllConnectedCameras(supabase: any, scope: { gardenId?: string; observerSiteId?: string } = {}) {
    let query = supabase.from("camera_streams" as any).select("*").in("status", ["active", "connected", "ready", "online"]);
    if (scope.gardenId) query = query.eq("garden_id", scope.gardenId);
    if (scope.observerSiteId) query = query.eq("observer_site_id", scope.observerSiteId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const cameras = (data ?? []) as Record<string, any>[];
    const zones = await Promise.all(cameras.map(async (camera) => {
      const result = await supabase.from("camera_zones" as any).select("*").eq("camera_id", camera.id).eq("is_active", true).limit(1).maybeSingle();
      return this.map(camera, result.data);
    }));
    return zones;
  }
}

export const cameraZoneMapper = new DefaultCameraZoneMapper();
