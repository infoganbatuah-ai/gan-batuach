import { BiometricObserverEngine } from "./biometric-engine";
import { assertKindergartenEvent, assertTenantEngineBoundary } from "./policy";
import { SkeletonObserverEngine } from "./skeleton-engine";
import type { IVisionEngine, ObservationEvent, TenantType, VideoFrame } from "./types";

export function createObserverEngine(tenantType: unknown): IVisionEngine {
  if (tenantType !== "KINDERGARTEN" && tenantType !== "STANDARD") {
    throw new Error("Observer engine boundary violation: unknown tenant type; refusing to create an engine.");
  }
  const engine = tenantType === "KINDERGARTEN"
    ? new SkeletonObserverEngine()
    : new BiometricObserverEngine();
  assertTenantEngineBoundary(tenantType, engine.tenantType);
  return engine;
}

export function tenantTypeForCamera(camera: Record<string, unknown> | null | undefined): TenantType {
  if (!camera) throw new Error("Observer engine boundary violation: camera tenant metadata is required.");

  const tenantType = camera.tenant_type;
  const engineMode = camera.engine_mode;
  const privacyMode = camera.vision_privacy_mode;
  const siteType = camera.site_type;
  const hasKindergartenId = [camera.kindergarten_id, camera.garden_id].some((value) => typeof value === "string" && value.trim().length > 0);
  const explicitKindergartenSignals = [
    tenantType === "KINDERGARTEN",
    engineMode === "kindergarten_skeleton",
  ];
  const explicitStandardSignals = [
    tenantType === "STANDARD",
    engineMode === "standard_biometric",
  ];
  const inferredKindergartenSignals = [
    privacyMode === "skeleton_only",
    siteType === "kindergarten",
    camera.business_handles_children === true,
    hasKindergartenId
  ];
  const inferredStandardSignals = [
    privacyMode === "standard_consent" || privacyMode === "standard_biometric",
    typeof siteType === "string" && ["home", "office", "business", "warehouse", "store", "parking_lot", "custom"].includes(siteType)
  ];

  if (tenantType !== undefined && tenantType !== null && tenantType !== "KINDERGARTEN" && tenantType !== "STANDARD") {
    throw new Error("Observer engine boundary violation: unrecognized tenant metadata; refusing biometric fallback.");
  }
  if (engineMode !== undefined && engineMode !== null && engineMode !== "kindergarten_skeleton" && engineMode !== "standard_biometric") {
    throw new Error("Observer engine boundary violation: unrecognized tenant metadata; refusing biometric fallback.");
  }
  if (privacyMode !== undefined && privacyMode !== null && privacyMode !== "skeleton_only" && privacyMode !== "standard_consent" && privacyMode !== "standard_biometric") {
    throw new Error("Observer engine boundary violation: unrecognized tenant metadata; refusing biometric fallback.");
  }
  if (siteType !== undefined && siteType !== null && typeof siteType !== "string") {
    throw new Error("Observer engine boundary violation: unrecognized tenant metadata; refusing biometric fallback.");
  }
  const explicitKindergarten = explicitKindergartenSignals.some(Boolean);
  const explicitStandard = explicitStandardSignals.some(Boolean);
  if (explicitKindergarten && explicitStandard) throw new Error("Observer engine boundary violation: contradictory tenant metadata.");
  const inferredKindergarten = inferredKindergartenSignals.some(Boolean);
  if (explicitKindergarten || inferredKindergarten) {
    if (explicitStandard) throw new Error("Observer engine boundary violation: contradictory tenant metadata.");
    return "KINDERGARTEN";
  }
  if (explicitStandard || inferredStandardSignals.some(Boolean)) return "STANDARD";
  throw new Error("Observer engine boundary violation: incomplete tenant metadata; refusing biometric fallback.");
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
