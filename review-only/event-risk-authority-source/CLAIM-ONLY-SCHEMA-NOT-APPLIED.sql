-- REVIEW ONLY: claim-table extraction, not a migration or executable assembly.
-- Source: 341ff2bfb6ae0a297cbecce47a8cacac57c51a37:
-- review-only/event-risk-processing-ownership/DRAFT-NOT-APPLIED.sql
-- Source SHA-256: 6a007b402564b819f6459b65dcd22a73bea29a3e70f8548e9f111a9f5eb5183b
-- This file intentionally excludes the source's Plan/Receipt, Site, Signal,
-- Incident, Risk-result, Gateway and polymorphic-link DDL.
-- Even after the abort guard is removed in a future review, this candidate is
-- BLOCKED until referenced composite unique keys, historical rows, owner
-- provenance, effective ACL and rollback are independently qualified.
BEGIN;
DO $claim_only_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: claim-only schema dependencies unverified';
END;
$claim_only_guard$;

-- BUSINESS NEED: one durable active owner/epoch per canonical Signal and engine.
-- OWNER: Digital Observer Model A customer Tenant/Site; no client-derived Tenant.
-- SENSITIVITY: internal incident/processing metadata; no media or recipients.
-- RETENTION: ENGINEERING_BASELINE_ONLY; no row deletion policy approved.
-- VOLUME/COST: one row per accepted Signal+engine; workload/retention not measured.
-- QUERY PATTERN: PK lookup/CAS, expired-lease scan; index cost unmeasured.
CREATE TABLE public.observer_event_risk_claims (
  signal_id uuid NOT NULL,
  risk_engine_version text NOT NULL,
  tenant_id uuid NOT NULL,
  observer_site_id uuid NOT NULL,
  incident_id uuid NOT NULL,
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
  -- BLOCKED: referenced (id, organization) uniqueness and all historical
  -- Home/business Tenant mappings must be verified before this can compile.
  CONSTRAINT observer_event_risk_claim_site_tenant_fk
    FOREIGN KEY (observer_site_id, tenant_id)
    REFERENCES public.observer_sites(id, digital_observer_organization_id),
  CONSTRAINT observer_event_risk_claim_evaluation_fk
    FOREIGN KEY (risk_evaluation_id) REFERENCES public.digital_observer_risk_evaluations(id),
  -- BLOCKED: referenced composite unique keys are auxiliary DDL, not owned
  -- by this claim-only extraction. Do not silently omit these scope fences.
  CONSTRAINT observer_event_risk_claim_signal_site_fk
    FOREIGN KEY (signal_id, observer_site_id)
    REFERENCES public.observer_intelligence_signals(id, observer_site_id),
  CONSTRAINT observer_event_risk_claim_incident_site_fk
    FOREIGN KEY (incident_id, observer_site_id)
    REFERENCES public.observer_correlated_events(id, observer_site_id),
  CONSTRAINT observer_event_risk_claim_result_scope_fk
    FOREIGN KEY (risk_evaluation_id, observer_site_id, signal_id, risk_engine_version)
    REFERENCES public.digital_observer_risk_evaluations
      (id, observer_site_id, triggering_event_id, risk_engine_version)
);

CREATE INDEX observer_event_risk_claim_recovery_idx
  ON public.observer_event_risk_claims (lease_expires_at)
  WHERE status <> 'COMPLETED';

ALTER TABLE public.observer_event_risk_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.observer_event_risk_claims FROM PUBLIC, anon, authenticated;
-- No service_role grant, function EXECUTE grant, default-ACL change or Data API
-- exposure is decided here. SECURITY INVOKER writers need qualified grants.
-- No COMMIT. No historical repair, backfill, retention purge or activation.
