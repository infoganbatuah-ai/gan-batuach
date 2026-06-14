import { Bell, Building2, Camera, Car, Factory, Home, Landmark, PackageCheck, School, ShieldCheck, ShoppingBag, Warehouse } from "lucide-react";

export const DIGITAL_OBSERVER_SITE_TYPES = [
  { key: "home", label: "Home", description: "Private home monitoring with privacy-first setup.", icon: Home },
  { key: "business", label: "Business", description: "Small business visibility, alerts and site health.", icon: Building2 },
  { key: "office", label: "Office", description: "After-hours monitoring and restricted-area awareness.", icon: Building2 },
  { key: "warehouse", label: "Warehouse", description: "Large-area camera coverage, movement and access signals.", icon: Warehouse },
  { key: "store", label: "Store", description: "Retail monitoring, camera health and operational alerts.", icon: ShoppingBag },
  { key: "parking_lot", label: "Parking lot", description: "Perimeter, motion and obstruction readiness.", icon: Car },
  { key: "school_future", label: "School future readiness", description: "Future vertical. Legal review required before launch.", icon: School },
  { key: "municipality_future", label: "Municipality future readiness", description: "Future public-sector vertical. External approvals required.", icon: Landmark },
  { key: "custom", label: "Custom", description: "Enterprise or special-purpose observer site.", icon: Factory }
] as const;

export const DIGITAL_OBSERVER_PACKAGES = [
  { key: "home_basic", name: "Home Basic", type: "home", cameras: "up to 2", hours: "event-based", retention: "14 days events", ai: ["camera offline", "motion after hours"], channels: "in-app", price: "pricing readiness" },
  { key: "home_plus", name: "Home Plus", type: "home", cameras: "up to 6", hours: "night / custom", retention: "30 days events", ai: ["restricted area", "obstruction", "person detected"], channels: "in-app, SMS, WhatsApp readiness", price: "pricing readiness" },
  { key: "business_basic", name: "Business Basic", type: "business", cameras: "up to 8", hours: "business hours", retention: "30 days events", ai: ["camera offline", "restricted area", "door/gate open"], channels: "email, SMS, WhatsApp readiness", price: "pricing readiness" },
  { key: "business_pro", name: "Business Pro", type: "business", cameras: "up to 20", hours: "custom schedule", retention: "60 days events", ai: ["crowding", "camera tampering", "unusual motion"], channels: "multi-channel readiness", price: "pricing readiness" },
  { key: "enterprise_monitoring", name: "Enterprise Monitoring", type: "enterprise", cameras: "custom", hours: "24/7 readiness", retention: "custom", ai: ["advanced policies", "multi-site", "review workflows"], channels: "custom SLA readiness", price: "custom" }
] as const;

export const DIGITAL_OBSERVER_AI_GOALS = [
  "camera offline",
  "motion after hours",
  "restricted area",
  "person detected",
  "crowding",
  "no motion too long",
  "camera obstruction",
  "suspicious motion"
] as const;

export const DIGITAL_OBSERVER_SHARED_CORE = [
  { name: "Camera infrastructure", table: "camera_streams", note: "Shared gateway, health and stream metadata. RTSP stays server-side." },
  { name: "Video gateway", table: "camera_gateway_configs", note: "MediaMTX/go2rtc/custom gateway readiness." },
  { name: "Observer signals", table: "observer_intelligence_signals", note: "Human review required before action." },
  { name: "AI events", table: "ai_camera_events", note: "Signals are advisory and policy-gated per vertical." },
  { name: "Risk scoring", table: "observer_network_score_snapshots", note: "Readiness scoring reused without kindergarten-only assumptions." },
  { name: "Audit logs", table: "audit_logs", note: "Viewer, admin and sensitive actions remain logged." },
  { name: "Notifications", table: "notifications", note: "Existing delivery infrastructure reused by product type." },
  { name: "Subscriptions", table: "observer_site_subscriptions", note: "Standalone packages stay separate from Gan Batuach billing." }
] as const;

export const DIGITAL_OBSERVER_DOMAIN_OPTIONS = [
  "observer.gan-batuach.co.il",
  "app.digitalobserver.ai",
  "digital-observer.co.il"
] as const;

export const DIGITAL_OBSERVER_PRODUCT_BOUNDARIES = {
  ganBatuach: ["kindergartens", "parents", "children", "staff", "inspectors", "Israeli regulation", "Gan Batuach Israel Mode"],
  digitalObserver: ["observer sites", "site owners", "site members", "standalone cameras", "observer subscriptions", "security/safety monitoring", "multi-vertical capability policy"]
} as const;

export const DIGITAL_OBSERVER_SETUP_ACTIONS = [
  { title: "Create observer site", text: "Choose home, business, office, warehouse, store, parking lot or custom.", icon: ShieldCheck },
  { title: "Connect cameras", text: "Use DVR/NVR, RTSP, ONVIF or generic camera through the secure gateway.", icon: Camera },
  { title: "Choose monitoring package", text: "Select limits, monitoring hours, retention and alert channels.", icon: PackageCheck },
  { title: "Configure alert goals", text: "Select what the observer should watch for and keep human review enabled.", icon: Bell }
] as const;
