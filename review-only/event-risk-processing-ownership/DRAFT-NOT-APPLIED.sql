-- DRAFT-NOT-APPLIED. Not a Supabase migration. Never source this file.
-- No authorization to execute DDL, alter grants/RLS, or activate an RPC.
-- The deliberately aborted transaction blocks every statement below even if
-- a SQL client continues after errors. There is intentionally no COMMIT.
BEGIN;
DO $draft_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: owner approval and review required';
END;
$draft_guard$;

-- REVIEW SKETCH ONLY. Rewrite as a canonical ordered migration after approval.
-- Historical Site preflight must precede the cross-Site constraints below.
-- PROPOSED Model A Tenant identity: existing digital_observer_organizations.id.
-- This candidate is BLOCKED until Home/business ownership and one-customer
-- cardinality are proven; do not synthesize or backfill historical IDs.
ALTER TABLE public.observer_sites
  ADD CONSTRAINT observer_site_tenant_required_draft_check
  CHECK (site_type = 'kindergarten' OR digital_observer_organization_id IS NOT NULL) NOT VALID;

CREATE UNIQUE INDEX observer_sites_id_org_draft_uidx
  ON public.observer_sites(id, digital_observer_organization_id);
CREATE UNIQUE INDEX observer_camera_id_site_draft_uidx
  ON public.digital_observer_camera_sources(id, observer_site_id);

-- NULL tenant_id bypasses a composite FK, so this is not a legacy backfill.
-- New hardened enrollments need a separately reviewed non-null gate.
ALTER TABLE public.video_gateway_device_enrollments
  ADD CONSTRAINT observer_gateway_site_tenant_draft_fk
  FOREIGN KEY (observer_site_id, tenant_id)
  REFERENCES public.observer_sites(id, digital_observer_organization_id) NOT VALID;

CREATE TABLE public.observer_event_risk_claims (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  -- tenant_id is derived from the candidate canonical Site mapping, never
  -- from caller input or an optional enrollment claim alone.
  status text NOT NULL DEFAULT 'CLAIMED',
  owner_nonce uuid NOT NULL,
  owner_epoch bigint NOT NULL DEFAULT 1,
  lease_expires_at timestamptz NOT NULL,
  risk_evaluation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (signal_id, risk_engine_version),
  CONSTRAINT observer_event_risk_claim_version_check
    CHECK (length(risk_engine_version) BETWEEN 1 AND 80),
  CONSTRAINT observer_event_risk_claim_epoch_check
    CHECK (owner_epoch > 0),
  CONSTRAINT observer_event_risk_claim_status_check
    CHECK (
      (status = 'CLAIMED' AND risk_evaluation_id IS NULL AND completed_at IS NULL)
      OR (status = 'RISK_PERSISTED' AND risk_evaluation_id IS NOT NULL AND completed_at IS NULL)
      OR (status = 'EFFECTS_PENDING' AND risk_evaluation_id IS NOT NULL AND completed_at IS NULL)
      OR (status = 'COMPLETED' AND risk_evaluation_id IS NOT NULL AND completed_at IS NOT NULL)
    ),
  CONSTRAINT observer_event_risk_claim_signal_fk
    FOREIGN KEY (signal_id) REFERENCES public.observer_intelligence_signals(id),
  CONSTRAINT observer_event_risk_claim_incident_fk
    FOREIGN KEY (incident_id) REFERENCES public.observer_correlated_events(id),
  CONSTRAINT observer_event_risk_claim_site_fk
    FOREIGN KEY (observer_site_id) REFERENCES public.observer_sites(id),
  CONSTRAINT observer_event_risk_claim_site_tenant_fk
    FOREIGN KEY (observer_site_id, tenant_id)
    REFERENCES public.observer_sites(id, digital_observer_organization_id),
  CONSTRAINT observer_event_risk_claim_evaluation_fk
    FOREIGN KEY (risk_evaluation_id) REFERENCES public.digital_observer_risk_evaluations(id)
);

CREATE INDEX observer_event_risk_claim_recovery_idx
  ON public.observer_event_risk_claims (lease_expires_at)
  WHERE status <> 'COMPLETED';

-- This column is Incident-wide. Per-Event owner_epoch alone cannot fence a
-- different Event's later projection; a future RPC must CAS this generation.
ALTER TABLE public.observer_correlated_events
  ADD COLUMN risk_projection_generation bigint NOT NULL DEFAULT 0,
  ADD COLUMN verification_projection_generation bigint NOT NULL DEFAULT 0,
  ADD CONSTRAINT observer_incident_projection_generation_draft_check
    CHECK (risk_projection_generation >= 0 AND verification_projection_generation >= 0) NOT VALID;

-- A durable decision-time plan precedes effect writes. These JSON payloads
-- are bounded and schema-validated by future RPCs; this SQL alone is NOT
-- sufficient to prove semantic completeness or recipient authorization.
CREATE TABLE public.observer_event_risk_effect_plans (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  risk_evaluation_id uuid NOT NULL,
  recipient_settings_version text NOT NULL,
  recipient_snapshot jsonb NOT NULL,
  recipient_snapshot_digest text NOT NULL,
  expected_fingerprints jsonb NOT NULL,
  media_fault_audit_required boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, risk_engine_version),
  CONSTRAINT observer_event_risk_plan_claim_fk
    FOREIGN KEY (signal_id, risk_engine_version)
    REFERENCES public.observer_event_risk_claims(signal_id, risk_engine_version),
  CONSTRAINT observer_event_risk_plan_digest_check
    CHECK (recipient_snapshot_digest ~ '^[a-f0-9]{64}$'),
  CONSTRAINT observer_event_risk_plan_json_check
    CHECK (jsonb_typeof(recipient_snapshot) = 'array'
      AND jsonb_typeof(expected_fingerprints) = 'object')
);

CREATE TABLE public.observer_event_risk_effect_receipts (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  effect_key text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  risk_evaluation_id uuid NOT NULL,
  owner_epoch bigint NOT NULL,
  effect_fingerprint text NOT NULL,
  recipient_snapshot_digest text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, risk_engine_version, effect_key),
  CONSTRAINT observer_event_risk_receipt_plan_fk
    FOREIGN KEY (signal_id, risk_engine_version)
    REFERENCES public.observer_event_risk_effect_plans(signal_id, risk_engine_version),
  CONSTRAINT observer_event_risk_receipt_epoch_check CHECK (owner_epoch > 0),
  CONSTRAINT observer_event_risk_receipt_key_check CHECK (length(effect_key) BETWEEN 1 AND 200),
  CONSTRAINT observer_event_risk_receipt_fingerprint_check
    CHECK (length(effect_fingerprint) BETWEEN 1 AND 256)
);
CREATE INDEX observer_event_risk_receipt_site_idx
  ON public.observer_event_risk_effect_receipts(observer_site_id, completed_at);

-- These redundant composite unique keys are prerequisites for Site-matching
-- FKs. Assess existing table sizes and lock duration; choose an approved
-- concurrent-index sequence if needed. Do not run this sketch as-is.
CREATE UNIQUE INDEX observer_signal_id_site_draft_uidx
  ON public.observer_intelligence_signals(id, observer_site_id);
CREATE UNIQUE INDEX observer_incident_id_site_draft_uidx
  ON public.observer_correlated_events(id, observer_site_id);
CREATE UNIQUE INDEX observer_risk_result_scope_draft_uidx
  ON public.digital_observer_risk_evaluations
    (id, observer_site_id, triggering_event_id, risk_engine_version);

ALTER TABLE public.observer_event_risk_claims
  ADD CONSTRAINT observer_event_risk_claim_signal_site_fk
    FOREIGN KEY (signal_id, observer_site_id)
    REFERENCES public.observer_intelligence_signals(id, observer_site_id),
  ADD CONSTRAINT observer_event_risk_claim_incident_site_fk
    FOREIGN KEY (incident_id, observer_site_id)
    REFERENCES public.observer_correlated_events(id, observer_site_id),
  ADD CONSTRAINT observer_event_risk_claim_result_scope_fk
    FOREIGN KEY (risk_evaluation_id, observer_site_id, signal_id, risk_engine_version)
    REFERENCES public.digital_observer_risk_evaluations
      (id, observer_site_id, triggering_event_id, risk_engine_version);

-- Only the Incident side of the polymorphic link can be represented by a
-- normal FK. Signal-side Site equality must be checked by a reviewed RPC or
-- narrowly scoped trigger, including existing rows before validation.
ALTER TABLE public.observer_correlated_event_links
  ADD CONSTRAINT observer_link_incident_site_draft_fk
    FOREIGN KEY (correlated_event_id, observer_site_id)
    REFERENCES public.observer_correlated_events(id, observer_site_id) NOT VALID;

-- NOT VALID still protects new writes, but historical mismatches remain until
-- separately reviewed and repaired. Never auto-fix, delete, or hide them.
ALTER TABLE public.digital_observer_risk_evaluations
  ADD CONSTRAINT observer_risk_incident_site_draft_fk
    FOREIGN KEY (incident_id, observer_site_id)
    REFERENCES public.observer_correlated_events(id, observer_site_id) NOT VALID,
  ADD CONSTRAINT observer_risk_signal_site_draft_fk
    FOREIGN KEY (triggering_event_id, observer_site_id)
    REFERENCES public.observer_intelligence_signals(id, observer_site_id) NOT VALID;

ALTER TABLE public.observer_event_risk_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observer_event_risk_effect_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observer_event_risk_effect_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.observer_event_risk_claims FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.observer_event_risk_effect_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.observer_event_risk_effect_receipts FROM PUBLIC, anon, authenticated;
-- Proposed service_role grants and RPC EXECUTE are deliberately omitted:
-- effective role/schema/API settings and dependent callers are unverified.

-- BLOCKED DESIGN ITEMS; no functions or grants are created by this sketch:
-- 1. A service-only, SECURITY INVOKER claim RPC must derive Site/tenant from
--    canonical rows, reject mismatches, atomically claim one key, and return
--    OWNED/BUSY/RESUME_EFFECTS/COMPLETED/NOT_APPLICABLE. RESUME_EFFECTS
--    requires ownership; another live owner must still return BUSY.
-- 2. A fenced risk-persist RPC must verify owner_nonce, owner_epoch and live
--    lease, then insert immutable evaluation and mark RISK_PERSISTED in the
--    *same transaction*. Replays must verify the stored input fingerprint.
-- 3. A fenced completion/reconciliation boundary must cover Incident risk
--    projection, watch-rule evaluations, verification, decision intent and
--    required in-app journal/outbox rows. Each stage needs a durable expected
--    effect set and replay-safe proof before COMPLETED. Existing separate
--    HTTP writes do not satisfy this automatically. Media-fault audit and
--    Guard dispatch are separate route-level effects; COMPLETED must not be
--    mistaken for the full Gateway acknowledgement boundary.
-- 4. Function EXECUTE grants, service_role table privileges and exposure to
--    the Data API require a separate least-privilege security review.
-- 5. Home tenant derivation, historical mismatch handling, claim
--    retention and data-size limits require explicit decisions.
-- 6. Model A's existing organization-row candidate still needs verified
--    customer cardinality, Home mapping and new-write compatibility.
-- 7. The proposed plan/receipt and projection columns are storage only; the
--    atomic SQL functions, semantic verification, audit and recovery remain
--    BLOCKED. No status in this draft proves end-to-end completion.
