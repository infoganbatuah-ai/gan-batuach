import "server-only";

export type CapabilityStatus =
  | "allowed"
  | "disabled"
  | "restricted"
  | "legal_review_required"
  | "consent_required"
  | "external_provider_required"
  | "future_only";

export type CapabilityDecision = {
  vertical_key: string;
  capability_key: string;
  capability_status: CapabilityStatus;
  legal_status?: CapabilityStatus;
  risk_level?: "critical" | "high" | "medium" | "low";
  enabled: boolean;
  external_legal_review_required?: boolean;
  human_review_required?: boolean;
  parent_visibility_rule?: string;
  decision_reason?: string | null;
  launch_blocker?: boolean;
  metadata?: Record<string, unknown>;
};

export type CapabilityAssertionOptions = {
  actorId?: string | null;
  legalReviewApproved?: boolean;
  consentConfirmed?: boolean;
  providerReady?: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export class CapabilityPolicyError extends Error {
  status = 403;
  capability: string;
  vertical: string;
  capabilityStatus: CapabilityStatus;

  constructor(vertical: string, capability: string, capabilityStatus: CapabilityStatus, message: string) {
    super(message);
    this.name = "CapabilityPolicyError";
    this.vertical = vertical;
    this.capability = capability;
    this.capabilityStatus = capabilityStatus;
  }
}

const GAN_BATUACH_ALLOWED = new Set([
  "pose_estimation",
  "skeleton_analytics",
  "motion_analytics",
  "fall_detection",
  "inactivity_detection",
  "crowding_detection",
  "restricted_area_detection",
  "camera_health_monitoring",
  "reviewed_safety_summaries",
  "human_review_queue",
  "watermarking",
  "anti_screen_capture",
  "audit_logs",
  "ai_telemetry"
]);

const GAN_BATUACH_DISABLED = new Set([
  "audio_recording",
  "audio_analytics",
  "keyword_detection",
  "speech_recognition",
  "distress_sound_detection",
  "face_recognition",
  "face_matching",
  "child_biometric_face_profile",
  "raw_ai_parent_visibility",
  "automatic_ai_accusations",
  "automatic_disciplinary_actions"
]);

const GAN_BATUACH_LEGAL_REVIEW = new Set([
  "live_streaming",
  "parent_viewing",
  "contextual_child_association",
  "soft_biometric_matching",
  "gait_recognition",
  "persistent_skeleton_identity",
  "cross_day_identity_tracking",
  "object_detection",
  "predictive_safety",
  "risk_scoring",
  "recording",
  "playback",
  "snapshots"
]);

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function fallbackDecision(vertical: string, capability: string): CapabilityDecision {
  const verticalKey = normalizeKey(vertical);
  const capabilityKey = normalizeKey(capability);

  if (verticalKey === "digital_observer_core") {
    return {
      vertical_key: verticalKey,
      capability_key: capabilityKey,
      capability_status: "allowed",
      legal_status: "allowed",
      enabled: true,
      human_review_required: true,
      decision_reason: "Digital Observer Core is a technical registry. Product verticals must still approve usage."
    };
  }

  if (verticalKey !== "gan_batuach") {
    return {
      vertical_key: verticalKey,
      capability_key: capabilityKey,
      capability_status: "future_only",
      legal_status: "legal_review_required",
      enabled: false,
      human_review_required: true,
      decision_reason: "Future vertical. Legal and product review required before launch."
    };
  }

  if (GAN_BATUACH_ALLOWED.has(capabilityKey)) {
    return {
      vertical_key: verticalKey,
      capability_key: capabilityKey,
      capability_status: "allowed",
      legal_status: "allowed",
      enabled: true,
      human_review_required: true,
      parent_visibility_rule: capabilityKey === "reviewed_safety_summaries" ? "approved_summary" : "internal_only",
      decision_reason: "Allowed for Gan Batuach Israel mode with human review and privacy controls."
    };
  }

  if (GAN_BATUACH_DISABLED.has(capabilityKey)) {
    return {
      vertical_key: verticalKey,
      capability_key: capabilityKey,
      capability_status: "disabled",
      legal_status: "disabled",
      enabled: false,
      human_review_required: true,
      launch_blocker: true,
      decision_reason: "Disabled for Gan Batuach Israel mode."
    };
  }

  if (GAN_BATUACH_LEGAL_REVIEW.has(capabilityKey)) {
    return {
      vertical_key: verticalKey,
      capability_key: capabilityKey,
      capability_status: "legal_review_required",
      legal_status: "legal_review_required",
      enabled: false,
      external_legal_review_required: true,
      human_review_required: true,
      decision_reason: "Requires external legal/privacy review before activation in Gan Batuach."
    };
  }

  return {
    vertical_key: verticalKey,
    capability_key: capabilityKey,
    capability_status: "restricted",
    legal_status: "legal_review_required",
    enabled: false,
    external_legal_review_required: true,
    human_review_required: true,
    decision_reason: "No approved decision exists for this capability in the selected vertical."
  };
}

async function fetchDecision(supabase: any, vertical: string, capability: string): Promise<CapabilityDecision> {
  const verticalKey = normalizeKey(vertical);
  const capabilityKey = normalizeKey(capability);

  if (!supabase?.from) {
    return fallbackDecision(verticalKey, capabilityKey);
  }

  try {
    const { data, error } = await supabase
      .from("observer_vertical_capability_decisions")
      .select(
        "vertical_key, capability_key, capability_status, legal_status, risk_level, enabled, external_legal_review_required, human_review_required, parent_visibility_rule, decision_reason, launch_blocker, metadata"
      )
      .eq("vertical_key", verticalKey)
      .eq("capability_key", capabilityKey)
      .maybeSingle();

    if (error || !data) {
      return fallbackDecision(verticalKey, capabilityKey);
    }

    return data as CapabilityDecision;
  } catch {
    return fallbackDecision(verticalKey, capabilityKey);
  }
}

async function logCapabilityBlock(
  supabase: any,
  decision: CapabilityDecision,
  options: CapabilityAssertionOptions,
  details: string
) {
  if (!supabase?.from) return;

  try {
    await supabase.from("observer_capability_audit_events").insert({
      event_key: `runtime-${decision.vertical_key}-${decision.capability_key}-${Date.now()}`,
      event_type: "runtime_guard_blocked",
      vertical_key: decision.vertical_key,
      capability_key: decision.capability_key,
      actor_profile_id: options.actorId ?? null,
      status: "blocked",
      reason: details,
      metadata: {
        reason: options.reason ?? null,
        decision_status: decision.capability_status,
        ...(options.metadata ?? {})
      }
    });
  } catch {
    // Capability checks must fail closed even if audit insertion is temporarily unavailable.
  }
}

function allowedByOptions(decision: CapabilityDecision, options: CapabilityAssertionOptions) {
  if (decision.enabled && decision.capability_status === "allowed") return true;
  if (decision.capability_status === "consent_required") return options.consentConfirmed === true;
  if (decision.capability_status === "external_provider_required") return options.providerReady === true;
  if (decision.capability_status === "legal_review_required") return options.legalReviewApproved === true;
  return false;
}

export async function isCapabilityAllowed(
  supabase: any,
  vertical: string,
  capability: string,
  options: CapabilityAssertionOptions = {}
) {
  const decision = await fetchDecision(supabase, vertical, capability);
  return allowedByOptions(decision, options);
}

export async function requireLegalReview(supabase: any, vertical: string, capability: string) {
  const decision = await fetchDecision(supabase, vertical, capability);
  return decision.capability_status === "legal_review_required" || decision.external_legal_review_required === true;
}

export async function assertCapabilityEnabled(
  supabase: any,
  vertical: string,
  capability: string,
  options: CapabilityAssertionOptions = {}
) {
  const decision = await fetchDecision(supabase, vertical, capability);

  if (allowedByOptions(decision, options)) {
    return decision;
  }

  const reason =
    decision.decision_reason ??
    `Capability ${decision.capability_key} is ${decision.capability_status} for ${decision.vertical_key}.`;

  await logCapabilityBlock(supabase, decision, options, reason);

  throw new CapabilityPolicyError(
    decision.vertical_key,
    decision.capability_key,
    decision.capability_status,
    reason
  );
}

export async function listRestrictedCapabilities(supabase: any, vertical: string) {
  const verticalKey = normalizeKey(vertical);

  if (!supabase?.from) {
    return [...GAN_BATUACH_DISABLED, ...GAN_BATUACH_LEGAL_REVIEW].map((capabilityKey) =>
      fallbackDecision(verticalKey, capabilityKey)
    );
  }

  try {
    const { data, error } = await supabase
      .from("observer_vertical_capability_decisions")
      .select(
        "vertical_key, capability_key, capability_status, legal_status, risk_level, enabled, external_legal_review_required, human_review_required, parent_visibility_rule, decision_reason, launch_blocker, metadata"
      )
      .eq("vertical_key", verticalKey)
      .in("capability_status", ["disabled", "restricted", "legal_review_required", "future_only"]);

    if (error) return [];
    return (data ?? []) as CapabilityDecision[];
  } catch {
    return [];
  }
}

export async function getCapabilityDecisionReason(supabase: any, vertical: string, capability: string) {
  const decision = await fetchDecision(supabase, vertical, capability);
  return decision.decision_reason ?? `${decision.capability_key}: ${decision.capability_status}`;
}
