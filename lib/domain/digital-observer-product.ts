import { BarChart3, Bell, Building2, Camera, Car, Factory, Home, Landmark, PackageCheck, Radar, School, Settings2, ShieldCheck, ShoppingBag, Warehouse } from "lucide-react";

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

export const DIGITAL_OBSERVER_NAVIGATION = [
  { href: "/digital-observer/dashboard", label: "Overview" },
  { href: "/digital-observer/dashboard#sites", label: "Sites" },
  { href: "/digital-observer/dashboard#cameras", label: "Cameras" },
  { href: "/digital-observer/dashboard#alerts", label: "Observer Alerts" },
  { href: "/digital-observer/onboarding#goals", label: "Monitoring Rules" },
  { href: "/digital-observer#packages", label: "Packages" },
  { href: "/digital-observer/billing", label: "Billing" },
  { href: "/digital-observer/onboarding#settings", label: "Settings" }
] as const;

export const DIGITAL_OBSERVER_PUBLIC_SECTIONS = [
  { title: "Use cases", text: "Homes, offices, businesses, warehouses, stores, parking lots and custom monitored sites.", icon: Building2 },
  { title: "Camera connection", text: "DVR/NVR, RTSP, ONVIF and generic IP camera readiness through the existing secure gateway.", icon: Camera },
  { title: "AI monitoring", text: "Observer goals are policy-gated and reviewed before real action.", icon: Radar },
  { title: "Alerts", text: "In-app, email, SMS, WhatsApp and push readiness through existing provider safety modes.", icon: Bell },
  { title: "Privacy and control", text: "Capabilities are separated by vertical and do not enable sensitive features automatically.", icon: ShieldCheck },
  { title: "Packages", text: "Home, business and enterprise package readiness without activating real billing.", icon: PackageCheck }
] as const;

export const DIGITAL_OBSERVER_USE_CASES = [
  {
    key: "home",
    path: "/digital-observer/home",
    title: "Home Monitoring",
    audience: "Home owners",
    problem: "Home owners need visibility when they are away without exposing camera credentials or creating noisy alerts.",
    solution: "Connect home cameras through a gateway, monitor selected goals and keep alerts controlled by privacy settings.",
    cameraSetup: "Home camera, generic IP camera, RTSP or ONVIF readiness.",
    alerts: "Camera offline, motion after hours, restricted area and obstruction.",
    benefits: ["Always-on visibility", "Simple test mode", "Privacy-first controls", "Human-reviewed observer events"],
    packageSuggestion: "Home Basic or Home Plus"
  },
  {
    key: "business",
    path: "/digital-observer/business",
    title: "Business Monitoring",
    audience: "Business owners",
    problem: "Small businesses need camera health, after-hours awareness and operational alerts without building a security platform.",
    solution: "Reuse camera gateway and observer signals to monitor business goals, site health and recent events.",
    cameraSetup: "Business DVR/NVR, RTSP, ONVIF, Hikvision, Dahua or generic camera readiness.",
    alerts: "Motion after hours, person detected, restricted area, obstruction and camera offline.",
    benefits: ["Multi-camera readiness", "Package-based limits", "Operations-friendly alerts", "No direct RTSP exposure"],
    packageSuggestion: "Business Basic or Business Pro"
  },
  {
    key: "warehouse",
    path: "/digital-observer/warehouse",
    title: "Warehouse Monitoring",
    audience: "Warehouse operators",
    problem: "Warehouses need coverage across larger zones, restricted areas and activity patterns.",
    solution: "Define zones, monitoring goals and schedules while keeping camera credentials server-side.",
    cameraSetup: "DVR/NVR, RTSP and ONVIF readiness with zone mapping.",
    alerts: "Restricted area, crowding, no motion too long, unusual motion and obstruction.",
    benefits: ["Zone-based monitoring", "Operational visibility", "After-hours awareness", "Scalable camera limits"],
    packageSuggestion: "Business Pro or Enterprise Monitoring"
  },
  {
    key: "office",
    path: "/digital-observer/office",
    title: "Office Monitoring",
    audience: "Office managers",
    problem: "Offices need after-hours visibility, access-area awareness and camera health without overcomplicating setup.",
    solution: "Configure office monitoring goals, alert channels and business-hours rules in test mode first.",
    cameraSetup: "Office IP cameras, generic camera, RTSP or ONVIF readiness.",
    alerts: "Motion after hours, restricted area, camera offline and obstruction.",
    benefits: ["Business-hours rules", "Simple alerts", "Privacy settings", "Package readiness"],
    packageSuggestion: "Business Basic"
  },
  {
    key: "store",
    path: "/digital-observer/store",
    title: "Store Monitoring",
    audience: "Store owners",
    problem: "Stores need camera availability, after-hours activity and quick visibility across customer and staff areas.",
    solution: "Connect existing cameras and select monitoring goals that fit retail operations.",
    cameraSetup: "Store DVR/NVR, IP camera, RTSP or ONVIF readiness.",
    alerts: "Camera offline, obstruction, motion after hours, crowding and restricted area.",
    benefits: ["Retail visibility", "Camera health tracking", "Alert readiness", "Human-reviewed signals"],
    packageSuggestion: "Business Basic or Business Pro"
  }
] as const;

export const DIGITAL_OBSERVER_PACKAGES = [
  { key: "home_basic", name: "Home Basic", type: "home", cameras: "up to 2", cameraLimit: 2, hours: "event-only mode", monitoringMode: "event_only", retention: "14 days events", retentionDays: 14, recordingRetention: "not included", ai: ["camera offline", "motion after hours"], channels: "in-app", monthlyPrice: "99 ILS readiness", annualPrice: "990 ILS readiness", liveView: true, multiUser: false, advancedAnalytics: false },
  { key: "home_plus", name: "Home Plus", type: "home", cameras: "up to 6", cameraLimit: 6, hours: "night / custom", monitoringMode: "night_only", retention: "30 days events", retentionDays: 30, recordingRetention: "7 days readiness", ai: ["restricted area", "obstruction", "person detected"], channels: "in-app, SMS, WhatsApp readiness", monthlyPrice: "179 ILS readiness", annualPrice: "1,790 ILS readiness", liveView: true, multiUser: true, advancedAnalytics: false },
  { key: "business_basic", name: "Business Basic", type: "business", cameras: "up to 8", cameraLimit: 8, hours: "business hours / night monitoring", monitoringMode: "business_hours", retention: "30 days events", retentionDays: 30, recordingRetention: "7 days readiness", ai: ["camera offline", "restricted area", "door/gate open"], channels: "email, SMS, WhatsApp readiness", monthlyPrice: "299 ILS readiness", annualPrice: "2,990 ILS readiness", liveView: true, multiUser: true, advancedAnalytics: false },
  { key: "business_pro", name: "Business Pro", type: "business", cameras: "up to 20", cameraLimit: 20, hours: "custom schedule", monitoringMode: "custom_schedule", retention: "60 days events", retentionDays: 60, recordingRetention: "14 days readiness", ai: ["crowding", "camera tampering", "unusual motion"], channels: "multi-channel readiness", monthlyPrice: "599 ILS readiness", annualPrice: "5,990 ILS readiness", liveView: true, multiUser: true, advancedAnalytics: true },
  { key: "enterprise_monitoring", name: "Enterprise Monitoring", type: "enterprise", cameras: "custom", cameraLimit: null, hours: "custom / 24/7 readiness", monitoringMode: "always_on", retention: "custom", retentionDays: 180, recordingRetention: "custom readiness", ai: ["advanced policies", "multi-site", "review workflows"], channels: "custom SLA readiness", monthlyPrice: "custom", annualPrice: "custom", liveView: true, multiUser: true, advancedAnalytics: true }
] as const;

export const DIGITAL_OBSERVER_SITE_OWNER_JOURNEY = [
  "Create account",
  "Choose site type",
  "Choose package",
  "Add site details",
  "Add cameras",
  "Configure monitoring goals",
  "Configure alert channels",
  "Review privacy/security settings",
  "Start trial or subscription"
] as const;

export const DIGITAL_OBSERVER_BILLING_STREAMS = [
  { stream: "Digital Observer", payer: "Digital Observer customer", destination: "Digital Observer product account" },
  { stream: "Gan Batuach", payer: "Kindergarten", destination: "Gan Batuach subscription account" },
  { stream: "Parent tuition", payer: "Parent", destination: "Kindergarten account" }
] as const;

export const DIGITAL_OBSERVER_PAYMENT_PROVIDERS = ["Stripe", "Cardcom", "Tranzila", "Meshulam", "Pelecard"] as const;

export const DIGITAL_OBSERVER_MEMBER_ROLES = [
  { role: "owner", permissions: ["billing", "package", "cameras", "users", "alerts"] },
  { role: "admin", permissions: ["cameras", "users", "alerts", "settings"] },
  { role: "viewer", permissions: ["view_dashboard", "view_allowed_cameras", "view_allowed_events"] },
  { role: "reviewer", permissions: ["review_observer_alerts", "comment_on_events"] }
] as const;

export const DIGITAL_OBSERVER_AI_GOALS = [
  "camera offline",
  "motion after hours",
  "person detected",
  "no motion too long",
  "restricted area",
  "camera obstruction",
  "crowding",
  "unusual motion",
  "business hours monitoring",
  "night monitoring"
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
  "digital-observer.co.il",
  "app.digital-observer.co.il"
] as const;

export const DIGITAL_OBSERVER_DOMAIN_ENV = [
  "DIGITAL_OBSERVER_PUBLIC_HOST",
  "DIGITAL_OBSERVER_APP_HOST",
  "GAN_BATUACH_PUBLIC_HOST"
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

export const DIGITAL_OBSERVER_ANALYTICS_EVENTS = [
  "visitor_source",
  "demo_request",
  "package_interest",
  "onboarding_started",
  "cameras_added",
  "first_alert_created",
  "active_observer_site",
  "churn_risk"
] as const;

export const DIGITAL_OBSERVER_LEAD_SOURCES = [
  "home",
  "business",
  "office",
  "warehouse",
  "store",
  "custom"
] as const;

export const DIGITAL_OBSERVER_PRODUCT_SWITCHER = [
  { product: "Gan Batuach", href: "/", description: "Kindergarten management, parents, children, staff, inspectors and Israeli regulation." },
  { product: "Digital Observer", href: "/digital-observer", description: "Standalone camera monitoring for homes, businesses and organizations." }
] as const;

export const DIGITAL_OBSERVER_ADMIN_OVERVIEW = [
  { label: "Gan Batuach gardens", source: "gardens", note: "Kindergarten vertical remains separate." },
  { label: "Digital Observer sites", source: "observer_sites", note: "Standalone sites use observer_site_id." },
  { label: "Product type", source: "observer_sites.site_type", note: "Do not mix parent/child flows into standalone observer." },
  { label: "Subscriptions", source: "observer_site_subscriptions", note: "Separate from Gan Batuach kindergarten subscription billing." },
  { label: "Usage", source: "observer_site_usage_snapshots", note: "Cameras, alerts, playback and monitoring usage." },
  { label: "Camera health", source: "camera_streams", note: "Shared infrastructure, scoped by observer_site_id." },
  { label: "Observer health", source: "observer_intelligence_signals", note: "Human-reviewed signals only." },
  { label: "Billing status", source: "observer_site_subscriptions.status", note: "Billing remains provider-gated readiness." }
] as const;
