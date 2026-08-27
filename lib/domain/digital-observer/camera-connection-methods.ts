import type { DigitalObserverConnectorType } from "@/lib/domain/digital-observer/connectors";

export const observerCameraPairingMethods = [
  "qr_scan",
  "manufacturer_app",
  "network_discovery",
  "recorder",
  "manual_network",
  "secure_gateway",
  "demo"
] as const;

export type ObserverCameraPairingMethod = (typeof observerCameraPairingMethods)[number];

export type ObserverCameraConnectionMethod = {
  key: ObserverCameraPairingMethod;
  label: string;
  shortDescription: string;
  connectorType: DigitalObserverConnectorType;
  badge: string;
  requiresGateway: boolean;
  steps: readonly string[];
  requiredItems: readonly string[];
};

export const observerCameraConnectionMethods: readonly ObserverCameraConnectionMethod[] = [
  {
    key: "qr_scan",
    label: "סריקת QR",
    shortDescription: "סריקת הקוד שעל המצלמה או באריזה ובחירת מסלול החיבור המתאים.",
    connectorType: "cloud_provider",
    badge: "הכי פשוט",
    requiresGateway: false,
    steps: [
      "מאשרים גישה למצלמת הטלפון וסורקים את קוד ה-QR.",
      "הקוד מסווג במכשיר ואינו נשמר במערכת.",
      "אם היצרן דורש אפליקציה, ממשיכים באפליקציית היצרן ומחזירים אישור חיבור.",
      "מבצעים בדיקת תמונה ורק אחריה מפעילים ניטור."
    ],
    requiredItems: ["המצלמה מחוברת לחשמל", "טלפון עם מצלמה", "קוד QR של המכשיר"]
  },
  {
    key: "manufacturer_app",
    label: "אפליקציית היצרן",
    shortDescription: "למצלמה שכבר פועלת באפליקציה של היצרן או בחשבון ענן.",
    connectorType: "cloud_provider",
    badge: "מצלמה קיימת",
    requiresGateway: false,
    steps: [
      "מוודאים שהמצלמה מופיעה ומקוונת באפליקציית היצרן.",
      "בוחרים את היצרן והדגם או בוחרים 'יצרן אחר'.",
      "כאשר קיים מחבר מאושר, ההרשאה תינתן אצל היצרן ולא באמצעות מסירת סיסמה לתצפיתן.",
      "אם אין API מאושר, המערכת תציע ONVIF, RTSP או Gateway מקומי."
    ],
    requiredItems: ["שם היצרן", "האפליקציה שבה המצלמה פועלת", "גישה לחשבון הבעלים"]
  },
  {
    key: "network_discovery",
    label: "איתור אוטומטי ברשת",
    shortDescription: "איתור מצלמות IP תואמות ONVIF באותה רשת מקומית.",
    connectorType: "onvif",
    badge: "מומלץ ל-IP",
    requiresGateway: true,
    steps: [
      "מחברים את המצלמה ואת ה-Gateway לאותה רשת.",
      "מריצים איתור מאובטח מהמכשיר המקומי, לא מהדפדפן הציבורי.",
      "בוחרים מצלמה מתוצאות האיתור ומזינים הרשאת צפייה ייעודית ב-Gateway.",
      "בודקים preview, השהיה ובריאות חיבור."
    ],
    requiredItems: ["מצלמת IP תואמת ONVIF", "רשת מקומית", "Gateway של התצפיתן"]
  },
  {
    key: "recorder",
    label: "מערכת NVR / DVR",
    shortDescription: "חיבור מערכת הקלטה ובחירת הערוצים שיופיעו כתצוגות מצלמה.",
    connectorType: "nvr",
    badge: "מספר מצלמות",
    requiresGateway: true,
    steps: [
      "מזהים יצרן ודגם של ה-NVR או ה-DVR.",
      "מחברים Gateway לאותה רשת ומגדירים משתמש צפייה מוגבל.",
      "בודקים את המערכת ובוחרים את ערוצי המצלמות הרצויים.",
      "כל ערוץ נשמר כמצלמה נפרדת עם סטטוס משלו."
    ],
    requiredItems: ["יצרן ודגם המקליט", "מספר ערוץ", "Gateway באותה רשת"]
  },
  {
    key: "manual_network",
    label: "חיבור ידני מתקדם",
    shortDescription: "RTSP, כתובת IP או פרטי חיבור מתקדמים דרך כספת ה-Gateway.",
    connectorType: "rtsp",
    badge: "לטכנאי",
    requiresGateway: true,
    steps: [
      "מפיקים כתובת RTSP או כתובת מצלמה מתיעוד היצרן.",
      "מזינים את הפרטים רק ב-Gateway או בכספת השרת.",
      "מריצים בדיקת stream ובוחרים איכות ראשית או משנית.",
      "הדפדפן מקבל רק סטטוס וידאו מאובטח, ללא הכתובת או הסיסמה."
    ],
    requiredItems: ["כתובת IP או RTSP", "משתמש צפייה מוגבל", "Gateway מאובטח"]
  },
  {
    key: "secure_gateway",
    label: "Gateway מקומי",
    shortDescription: "למערכת סגורה, מצלמות שאינן חשופות לאינטרנט או אתר עסקי מורכב.",
    connectorType: "edge_gateway",
    badge: "רשת סגורה",
    requiresGateway: true,
    steps: [
      "מתקינים את רכיב ה-Gateway במחשב או יחידת Edge ברשת המקומית.",
      "מזווגים אותו לאתר באמצעות קוד קצר וחולף.",
      "ה-Gateway מאתר ומאמת את מקורות הווידאו בתוך הרשת.",
      "רק HLS/WebRTC מאובטח וסטטוס בריאות יוצאים החוצה."
    ],
    requiredItems: ["מחשב או יחידת Edge פעילה", "גישה לרשת המקומית", "הרשאת מנהל האתר"]
  },
  {
    key: "demo",
    label: "מצלמת הדמיה",
    shortDescription: "בדיקת הממשק בלבד, ללא מצלמה, וידאו חי או ניתוח אמיתי.",
    connectorType: "demo",
    badge: "דמו בלבד",
    requiresGateway: false,
    steps: [
      "נותנים שם למצלמת ההדמיה.",
      "בוחרים מטרות ניטור לצורך בדיקת הממשק.",
      "המערכת מציגה תמונת הדגמה ומסמנת אותה כדמו.",
      "אין קליטת וידאו, AI חי או התראות חיצוניות."
    ],
    requiredItems: ["אין צורך בציוד"]
  }
] as const;

export const observerCameraManufacturers = [
  { value: "unknown", label: "לא יודע / זיהוי אוטומטי" },
  { value: "hikvision", label: "Hikvision" },
  { value: "dahua", label: "Dahua" },
  { value: "uniview", label: "Uniview" },
  { value: "axis", label: "Axis" },
  { value: "reolink", label: "Reolink" },
  { value: "tapo", label: "TP-Link Tapo" },
  { value: "xiaomi", label: "Xiaomi / Mi Home" },
  { value: "eufy", label: "Eufy" },
  { value: "arlo", label: "Arlo" },
  { value: "ring", label: "Ring" },
  { value: "nest", label: "Google Nest" },
  { value: "unifi", label: "UniFi Protect" },
  { value: "synology", label: "Synology Surveillance Station" },
  { value: "other", label: "יצרן אחר" }
] as const;

export type ObserverPairingPayloadKind = "rtsp" | "onvif" | "web_link" | "vendor_code" | "unknown";

export function classifyObserverPairingPayload(rawValue: string): ObserverPairingPayloadKind {
  const value = rawValue.trim().toLowerCase();
  if (!value) return "unknown";
  if (value.startsWith("rtsp://") || value.includes("\"rtsp\"")) return "rtsp";
  if (value.includes("onvif")) return "onvif";
  if (value.startsWith("https://") || value.startsWith("http://")) return "web_link";
  if (/^[a-z0-9:_\-.]{4,256}$/i.test(value)) return "vendor_code";
  return "unknown";
}

export function connectorTypeForPairing(
  method: ObserverCameraPairingMethod,
  payloadKind?: ObserverPairingPayloadKind,
  recorderType?: "nvr" | "dvr"
): DigitalObserverConnectorType {
  if (payloadKind === "rtsp") return "rtsp";
  if (payloadKind === "onvif") return "onvif";
  if (method === "recorder") return recorderType ?? "nvr";
  return observerCameraConnectionMethods.find((item) => item.key === method)?.connectorType ?? "ip_camera";
}
