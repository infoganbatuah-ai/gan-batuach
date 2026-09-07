import { z } from "zod";
import { connectivityFamilyIds, connectivityRegistryVersion } from "./connectivity-registry";

export const mobileSetupVersion = "mobile-camera-setup-v1";
export const mobileSetupReceiptSchema = z.object({
  version: z.literal(mobileSetupVersion),
  sessionId: z.string().uuid(),
  siteId: z.string().uuid(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  permission: z.enum(["GRANTED", "DENIED", "NOT_SUPPORTED"]),
  // Only product-owned references may cross the boundary. No LAN inventory,
  // local addresses, QR payloads, vendor passwords or serial numbers.
  candidates: z.array(z.object({
    reference: z.string().uuid(),
    family: z.enum(connectivityFamilyIds),
    protocols: z.array(z.enum(["ONVIF", "RTSP", "HTTPS"])).max(3),
    registryVersion: z.literal(connectivityRegistryVersion)
  }).strict()).max(32)
}).strict();

export function validateMobileSetupReceipt(input: unknown, scope: {
  siteId: string; sessionId: string; nativeCapabilityAvailable: boolean;
}, now = Date.now()) {
  const receipt = mobileSetupReceiptSchema.parse(input);
  if (receipt.siteId !== scope.siteId || receipt.sessionId !== scope.sessionId) throw new Error("MOBILE_SETUP_SCOPE_DENIED");
  const issued = Date.parse(receipt.issuedAt);
  const expires = Date.parse(receipt.expiresAt);
  if (issued > now || expires <= now || expires <= issued || expires - issued > 10 * 60000) throw new Error("MOBILE_SETUP_EXPIRED");
  if ((!scope.nativeCapabilityAvailable || receipt.permission !== "GRANTED") && receipt.candidates.length) throw new Error("MOBILE_DISCOVERY_NOT_AUTHORIZED");
  return { ...receipt, temporarySetupOnly: true as const, persistentMonitoringVerified: false as const };
}

export function mobilePermissionPresentation(nativeCapabilityAvailable: boolean, permission: "GRANTED" | "DENIED" | "UNKNOWN") {
  return {
    supported: nativeCapabilityAvailable,
    message: !nativeCapabilityAvailable ? "איתור מקומי בטלפון עדיין אינו זמין בגרסה הזו. אפשר לזהות את המערכת לפי שם האפליקציה או היצרן."
      : permission === "DENIED" ? "אפשרו גישה זמנית לרשת המקומית בהגדרות האפליקציה, או המשיכו בזיהוי המערכת לפי היצרן."
      : "נדרשת גישה זמנית לרשת המקומית כדי למצוא את המצלמות. הניטור לא יסתמך על השארת הטלפון בבית.",
    monitoringActivated: false as const
  };
}
