-- OFFLINE, SIGNATURE-SPECIFIC PROPOSAL ONLY. Never source this file.
-- The aborting guard and absence of COMMIT prevent application. Forward and
-- rollback is in a separate guarded file. Do not strip this guard or copy
-- this file into migrations now.
BEGIN;
DO $draft_guard$
BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: caller and role-boundary approval required';
END;
$draft_guard$;

-- FORWARD, contingent on verified service-only callers and isolated role
-- probes. Keep postgres owner and service_role EXECUTE unchanged.
REVOKE EXECUTE ON FUNCTION
  public.record_digital_observer_watch_rule_evaluation(
    uuid,integer,uuid,uuid,uuid,boolean,jsonb,jsonb,text,timestamptz
  ) FROM anon, authenticated;

-- This proposal does not change PUBLIC, service_role, postgres, other functions,
-- shared pg_default_acl, RLS or table privileges. This file is never a
-- deployable migration without a separate caller and role-boundary review.
