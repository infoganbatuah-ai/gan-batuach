import { BiometricObserverEngine } from "./biometric-engine";
import { assertKindergartenEvent, assertTenantEngineBoundary } from "./policy";
import { SkeletonObserverEngine } from "./skeleton-engine";
import type { IVisionEngine, ObservationEvent, TenantType, VideoFrame } from "./types";

export function createObserverEngine(tenantType: TenantType): IVisionEngine {
  const engine = tenantType === "KINDERGARTEN"
    ? new SkeletonObserverEngine()
    : new BiometricObserverEngine();
  assertTenantEngineBoundary(tenantType, engine.tenantType);
  return engine;
}

export function tenantTypeForCamera(camera: Record<string, unknown> | null | undefined): TenantType {
  return camera?.tenant_type === "KINDERGARTEN"
    || camera?.engine_mode === "kindergarten_skeleton"
    || camera?.vision_privacy_mode === "skeleton_only"
    || camera?.site_type === "kindergarten"
    || camera?.business_handles_children === true
    || Boolean(camera?.kindergarten_id)
    ? "KINDERGARTEN"
    : "STANDARD";
}

/**
 * נקודת הכניסה היחידה לעיבוד פריימים.
 * כל Adapter/Gateway חייב לקרוא לפונקציה הזו ולא לבחור מנוע בעצמו.
 * בגן בטוח התוצאה נבדקת שוב לאחר העיבוד כדי למנוע זליגה ביומטרית מספק.
 */
export async function processFrameForCamera(
  camera: Record<string, unknown>,
  frame: VideoFrame
): Promise<{ tenantType: TenantType; engine: IVisionEngine["name"]; events: ObservationEvent[] }> {
  const tenantType = tenantTypeForCamera(camera);
  const engine = createObserverEngine(tenantType);
  const events = await engine.processFrame(frame);
  if (tenantType === "KINDERGARTEN") {
    events.forEach(assertKindergartenEvent);
  }
  return { tenantType, engine: engine.name, events };
}
