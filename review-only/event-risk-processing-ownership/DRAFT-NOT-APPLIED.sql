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
CREATE TABLE public.observer_event_risk_claims (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  -- No tenant key is invented here. Home tenant derivation is a blocking
  -- decision; observer_site_id is only the canonical processing partition.
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
      OR (status = 'COMPLETED' AND risk_evaluation_id IS NOT NULL AND completed_at IS NOT NULL)
    ),
  CONSTRAINT observer_event_risk_claim_signal_fk
    FOREIGN KEY (signal_id) REFERENCES public.observer_intelligence_signals(id),
  CONSTRAINT observer_event_risk_claim_incident_fk
    FOREIGN KEY (incident_id) REFERENCES public.observer_correlated_events(id),
  CONSTRAINT observer_event_risk_claim_site_fk
    FOREIGN KEY (observer_site_id) REFERENCES public.observer_sites(id),
  CONSTRAINT observer_event_risk_claim_evaluation_fk
    FOREIGN KEY (risk_evaluation_id) REFERENCES public.digital_observer_risk_evaluations(id)
);

CREATE INDEX observer_event_risk_claim_recovery_idx
  ON public.observer_event_risk_claims (lease_expires_at)
  WHERE status <> 'COMPLETED';

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
REVOKE ALL ON TABLE public.observer_event_risk_claims FROM PUBLIC, anon, authenticated;

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
