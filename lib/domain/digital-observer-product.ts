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
  { href: "/digital-observer/sites", label: "Sites" },
  { href: "/digital-observer/cameras", label: "Cameras" },
  { href: "/digital-observer/alerts", label: "Observer Alerts" },
  { href: "/digital-observer/onboarding#goals", label: "Monitoring Rules" },
  { href: "/digital-observer#packages", label: "Packages" },
  { href: "/digital-observer/billing", label: "Billing" },
  { href: "/digital-observer/settings", label: "Settings" }
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
  },
  {
    key: "parking",
    path: "/digital-observer/parking",
    title: "Parking Lot Monitoring",
    audience: "Parking operators",
    problem: "Parking lots need perimeter visibility, camera health and after-hours motion awareness without exposing camera infrastructure.",
    solution: "Connect parking cameras through the secure gateway, define monitoring hours and review unusual activity before action.",
    cameraSetup: "Parking lot DVR/NVR, RTSP, ONVIF or generic IP camera readiness.",
    alerts: "Camera offline, motion after hours, obstruction, restricted area and unusual motion.",
    benefits: ["Perimeter visibility", "After-hours awareness", "Camera health tracking", "Review-first alerts"],
    packageSuggestion: "Business Pro or Enterprise Monitoring"
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
  "digital_observer_home",
  "digital_observer_business",
  "digital_observer_office",
  "digital_observer_warehouse",
  "digital_observer_store",
  "digital_observer_parking",
  "digital_observer_demo",
  "digital_observer_pricing",
  "digital_observer_start",
  "referral",
  "campaign"
] as const;

export const DIGITAL_OBSERVER_MARKETING_CTA_EVENTS = [
  "homepage_cta_click",
  "pricing_cta_click",
  "demo_form_started",
  "demo_form_submitted",
  "start_monitoring_clicked",
  "package_selected",
  "onboarding_started"
] as const;

export const DIGITAL_OBSERVER_SAFE_COPY_RULES = [
  { avoid: "prevents all incidents", use: "helps monitor unusual activity" },
  { avoid: "guarantees safety", use: "improves visibility and response readiness" },
  { avoid: "replaces human security completely", use: "supports review and operational decisions" },
  { avoid: "identifies criminals", use: "detects activity that may require attention" },
  { avoid: "watches everything without limits", use: "monitors configured cameras, schedules and goals" }
] as const;

export const DIGITAL_OBSERVER_FAQ = [
  { question: "What cameras are supported?", answer: "Digital Observer is ready for DVR/NVR, RTSP, ONVIF and generic IP camera setup through the secure gateway." },
  { question: "Do I need a DVR/NVR?", answer: "No. A DVR/NVR is supported, but standalone IP cameras and demo cameras can also be prepared." },
  { question: "Does it work with RTSP?", answer: "Yes, RTSP readiness is included, but RTSP URLs and credentials stay server-side and are not shown in the browser." },
  { question: "Can I connect home cameras?", answer: "Yes. Home sites can start in test mode with privacy settings and controlled alert goals." },
  { question: "What happens if a camera is offline?", answer: "The system can track camera health and create a controlled alert for configured recipients." },
  { question: "Who receives alerts?", answer: "Site owners choose recipients and channels by severity, package and notification preferences." },
  { question: "What is AI monitoring?", answer: "AI monitoring means selected observer goals such as camera offline, motion after hours or restricted-area activity. It supports review and does not make unsupported conclusions." },
  { question: "Is recording required?", answer: "No. Event-only mode and camera health monitoring can be prepared without activating recording." },
  { question: "Can I cancel?", answer: "Cancellation readiness is part of the standalone billing model. Monitoring pauses according to package and retention rules." },
  { question: "Is there a trial?", answer: "Trial readiness exists for standalone sites, with test mode first and production activation only when provider settings are configured." }
] as const;

export const DIGITAL_OBSERVER_FOLLOW_UP_TEMPLATES = [
  { key: "demo_request_received", channel: "email", title: "Demo request received", purpose: "Confirm the request and explain next steps." },
  { key: "follow_up_reminder", channel: "whatsapp", title: "Follow-up reminder", purpose: "Remind the lead that a short setup call is pending." },
  { key: "onboarding_link", channel: "email", title: "Onboarding link", purpose: "Send the standalone onboarding link after qualification." },
  { key: "trial_started", channel: "email", title: "Trial started", purpose: "Explain test mode, camera setup and privacy controls." },
  { key: "camera_setup_reminder", channel: "sms", title: "Camera setup reminder", purpose: "Remind the site owner to finish camera connection." },
  { key: "package_suggestion", channel: "email", title: "Package suggestion", purpose: "Recommend Home Basic, Home Plus, Business Basic, Business Pro or Enterprise Monitoring." }
] as const;

export const DIGITAL_OBSERVER_PILOT_CAMERA_SYSTEMS = [
  "RTSP",
  "ONVIF readiness",
  "DVR",
  "NVR",
  "Hikvision",
  "Dahua",
  "Generic IP Camera",
  "Demo Camera"
] as const;

export const DIGITAL_OBSERVER_PILOT_SUPPORT_CATEGORIES = [
  "camera connection",
  "gateway issue",
  "playback issue",
  "alert issue",
  "billing/trial issue",
  "onboarding issue",
  "UX confusion",
  "feature request"
] as const;

export const DIGITAL_OBSERVER_PILOT_REVIEW_LIFECYCLE = [
  "detected",
  "pending_review",
  "dismissed",
  "confirmed",
  "needs_followup",
  "uncertain",
  "action_suggested",
  "closed"
] as const;

export const DIGITAL_OBSERVER_PILOT_PRIVACY_RULES = [
  "No kindergarten data",
  "No Gan Batuach parent/child/staff flows",
  "RTSP URLs stay server-side",
  "Camera credentials are encrypted or server-only",
  "Playback uses secure token readiness",
  "Shadow mode first",
  "Human review required",
  "No restricted capability activation by default"
] as const;

export const DIGITAL_OBSERVER_STABILIZATION_AREAS = [
  "camera",
  "gateway",
  "playback",
  "alerts",
  "AI accuracy",
  "UX",
  "pricing",
  "support",
  "onboarding",
  "billing"
] as const;

export const DIGITAL_OBSERVER_SUPPORT_PLAYBOOKS = [
  { key: "camera_connection_failed", title: "Camera connection failed", summary: "Check camera type, local network, gateway health and server-side credentials without exposing RTSP." },
  { key: "rtsp_not_working", title: "RTSP not working", summary: "Validate RTSP path server-side, confirm port and credentials, then retry gateway registration." },
  { key: "dvr_channel_unknown", title: "DVR channel unknown", summary: "Guide owner to identify channel number and stream quality before another test." },
  { key: "gateway_unavailable", title: "Gateway unavailable", summary: "Check provider health, base URL, auth secret readiness and reconnect status." },
  { key: "playback_not_loading", title: "Playback not loading", summary: "Check token scope, stream availability, schedule policy and camera health." },
  { key: "alerts_too_noisy", title: "Alerts too noisy", summary: "Review false positives, schedule, zone boundaries and sensitivity before changing thresholds." },
  { key: "subscription_issue", title: "Subscription issue", summary: "Confirm Digital Observer billing stream only; do not touch Gan Batuach or parent tuition." },
  { key: "onboarding_stuck", title: "Onboarding stuck", summary: "Move owner through monitor target, camera count, connection method, schedule, recipients and test mode." }
] as const;

export const DIGITAL_OBSERVER_KNOWLEDGE_BASE_ARTICLES = [
  "How to connect a camera",
  "What is RTSP?",
  "What is DVR/NVR?",
  "What is ONVIF?",
  "Why do I need a gateway?",
  "Why is my camera offline?",
  "How alerts work",
  "How to reduce false alerts"
] as const;

export const DIGITAL_OBSERVER_PACKAGE_RECOMMENDATIONS = [
  { rule: "1-2 cameras at home", packageKey: "home_basic", packageName: "Home Basic" },
  { rule: "3-6 cameras at home", packageKey: "home_plus", packageName: "Home Plus" },
  { rule: "Business with night monitoring", packageKey: "business_basic", packageName: "Business Basic" },
  { rule: "Multiple users / advanced analytics", packageKey: "business_pro", packageName: "Business Pro" },
  { rule: "Custom sites / high camera count", packageKey: "enterprise_monitoring", packageName: "Enterprise Monitoring" }
] as const;

export const DIGITAL_OBSERVER_LAUNCH_DECISION_STATES = [
  "not_ready",
  "needs_more_pilots",
  "pilot_ready",
  "paid_beta_ready",
  "standalone_launch_ready"
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

export const DIGITAL_OBSERVER_PAID_BETA_FUNNEL_STAGES = [
  { key: "lead", label: "Lead", description: "Qualified Digital Observer lead, not a Gan Batuach kindergarten record." },
  { key: "demo", label: "Demo", description: "Product value explained for the selected site type." },
  { key: "trial", label: "Trial", description: "Trial started with safe provider mode and test monitoring first." },
  { key: "camera_setup", label: "Camera setup", description: "Camera/gateway connected without exposing RTSP or credentials." },
  { key: "first_alerts", label: "First alerts", description: "Observer creates reviewed, non-automatic alerts." },
  { key: "customer_feedback", label: "Customer feedback", description: "Alert value, setup friction and willingness to pay captured." },
  { key: "package_confirmation", label: "Package confirmation", description: "Home Basic, Home Plus, Business Basic, Business Pro or Enterprise selected." },
  { key: "payment", label: "Payment", description: "Payment readiness or configured payment. No raw card data." },
  { key: "paid_beta", label: "Paid beta", description: "Auditable paid beta subscription, separate from Gan Batuach revenue." }
] as const;

export const DIGITAL_OBSERVER_PAID_BETA_SUCCESS_CRITERIA = [
  { metric: "paid_beta_customers", label: "Paid beta customers", threshold: "5 or more", defaultTarget: 5 },
  { metric: "camera_setup_completion", label: "Camera setup completion", threshold: "70% or more", defaultTarget: 70 },
  { metric: "alert_usefulness", label: "Useful alerts reported", threshold: "60% or more", defaultTarget: 60 },
  { metric: "support_load", label: "Support load", threshold: "manageable", defaultTarget: 75 },
  { metric: "paid_continuation", label: "Willing to continue paid", threshold: "50% or more", defaultTarget: 50 },
  { metric: "critical_security_privacy_issues", label: "Critical security/privacy issues", threshold: "0", defaultTarget: 0 }
] as const;

export const DIGITAL_OBSERVER_PAID_BETA_SUPPORT_PLAYBOOKS = [
  { key: "camera_cannot_connect", title: "Camera cannot connect", category: "camera", summary: "Validate camera type, network reachability, gateway health and server-side credentials." },
  { key: "rtsp_path_unknown", title: "RTSP path unknown", category: "camera", summary: "Identify DVR/NVR brand and channel, then test candidate paths server-side only." },
  { key: "dvr_channel_issue", title: "DVR channel issue", category: "camera", summary: "Confirm channel number, main/sub stream and camera index before another gateway test." },
  { key: "gateway_unavailable", title: "Gateway unavailable", category: "gateway", summary: "Check provider status, credentials, latency and retry readiness before escalating." },
  { key: "alert_too_noisy", title: "Alert too noisy", category: "alerts", summary: "Review schedule, zones, sensitivity and false positives before changing thresholds." },
  { key: "alert_missed", title: "Alert missed", category: "alerts", summary: "Record false negative context and add calibration recommendation." },
  { key: "payment_failed", title: "Payment failed", category: "billing", summary: "Keep revenue in the Digital Observer stream and verify provider mode before retry." },
  { key: "invoice_issue", title: "Invoice issue", category: "billing", summary: "Use Digital Observer invoice wording and never reuse Gan Batuach kindergarten invoice labels." },
  { key: "package_upgrade_request", title: "Package upgrade request", category: "package", summary: "Check usage limits, upgrade interest, renewal timing and provider readiness." },
  { key: "cancellation_request", title: "Cancellation request", category: "billing", summary: "Pause monitoring according to retention rules and keep support/billing access available." }
] as const;

export const DIGITAL_OBSERVER_BETA_COMMUNICATION_TEMPLATES = [
  { key: "welcome_paid_beta", channel: "email", title: "Welcome to paid beta", purpose: "Set expectations, support contact and safe test mode rules." },
  { key: "trial_ending", channel: "email", title: "Trial ending", purpose: "Explain package confirmation and payment readiness." },
  { key: "payment_required", channel: "whatsapp", title: "Payment required", purpose: "Request payment setup only when provider mode allows it." },
  { key: "payment_successful", channel: "email", title: "Payment successful", purpose: "Confirm paid beta activation and invoice readiness." },
  { key: "camera_setup_reminder", channel: "sms", title: "Camera setup reminder", purpose: "Help the site owner complete camera/gateway setup." },
  { key: "alert_calibration_reminder", channel: "in_app", title: "Alert calibration reminder", purpose: "Ask for feedback after noisy or missed alerts." },
  { key: "feedback_request", channel: "email", title: "Feedback request", purpose: "Collect setup, value, price and support feedback." },
  { key: "upgrade_suggestion", channel: "email", title: "Upgrade suggestion", purpose: "Suggest a package only from observed usage and limits." },
  { key: "cancellation_confirmation", channel: "email", title: "Cancellation confirmation", purpose: "Confirm monitoring suspension and retention next steps." }
] as const;

export const DIGITAL_OBSERVER_PAID_BETA_DECISION_STATES = [
  "not_ready",
  "needs_more_beta",
  "paid_beta_validated",
  "ready_for_standalone_launch",
  "ready_for_infrastructure_extraction"
] as const;

export const DIGITAL_OBSERVER_SEPARATION_DECISION_STATES = [
  "not_ready",
  "keep_inside_gan_batuach",
  "monorepo_recommended",
  "separate_vercel_ready",
  "separate_supabase_ready",
  "separate_repo_ready",
  "full_separation_ready"
] as const;

export const DIGITAL_OBSERVER_SEPARATION_FACTORS = [
  "paying customers",
  "product usage",
  "camera setup success",
  "support load",
  "billing separation",
  "legal readiness",
  "data boundaries",
  "technical complexity"
] as const;

export const DIGITAL_OBSERVER_FUTURE_MONOREPO_PLAN = {
  apps: ["gan-batuach", "digital-observer"],
  packages: ["observer-core", "camera-core", "ai-core", "workflow-core", "audit-core", "notification-core", "billing-core", "analytics-core", "ui-core"]
} as const;

export const DIGITAL_OBSERVER_GITHUB_STRATEGIES = [
  { key: "single_monorepo", title: "Single Monorepo", recommendation: "recommended_next", pros: ["shared packages", "one source of truth", "easier shared engine development"], cons: ["larger repo", "requires careful project boundaries"] },
  { key: "separate_repositories", title: "Separate Repositories", recommendation: "later", pros: ["stronger product separation", "cleaner permissions"], cons: ["shared package complexity", "duplicated setup", "harder synchronization"] }
] as const;

export const DIGITAL_OBSERVER_VERCEL_STRATEGIES = [
  { key: "same_project_route_based", title: "Same Vercel project, route-based separation", recommendation: "current", note: "Keep /digital-observer while traction is still being validated." },
  { key: "separate_projects_same_monorepo", title: "Separate Vercel projects from same monorepo", recommendation: "next_after_paid_beta", note: "Best first infrastructure split once beta is validated." },
  { key: "separate_projects_separate_repos", title: "Separate Vercel projects and separate repos", recommendation: "future_only", note: "Use only after shared package boundaries are stable." }
] as const;

export const DIGITAL_OBSERVER_SUPABASE_STRATEGIES = [
  { key: "same_project_product_type", title: "Same Supabase project with product_type / observer_site_id separation", recommendation: "current", risk: "Requires strict RLS and reporting separation." },
  { key: "separate_project", title: "Separate Supabase project for Digital Observer", recommendation: "later", risk: "Higher migration, auth and rollback complexity." },
  { key: "hybrid_transition", title: "Hybrid transition model", recommendation: "recommended_for_extraction", risk: "Requires bridge views, export tooling and careful cutover." }
] as const;

export const DIGITAL_OBSERVER_DATA_BOUNDARY_GROUPS = {
  ganBatuachOnly: ["children", "parents", "staff", "inspections", "kindergarten billing", "parent tuition payments", "child medical records"],
  digitalObserverOnly: ["observer_sites", "observer_subscriptions", "observer_usage_tracking", "observer_site_members", "standalone observer billing"],
  sharedCore: ["camera infrastructure", "observer signals", "audit logs", "AI models", "workflows", "notifications", "capability matrix"]
} as const;

export const DIGITAL_OBSERVER_EXTRACTION_RISK_CATEGORIES = [
  "data migration",
  "auth",
  "billing",
  "camera gateway",
  "shared packages",
  "deployment",
  "DNS/domain",
  "Supabase",
  "Vercel",
  "support",
  "legal",
  "customer disruption"
] as const;
