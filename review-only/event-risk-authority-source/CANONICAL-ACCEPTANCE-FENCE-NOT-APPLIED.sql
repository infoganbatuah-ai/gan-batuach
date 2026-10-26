-- REVIEW ONLY. Additive synthetic fixture for the a6bd2ba5 writer body.
-- Direct execution aborts before DDL. No live migration or caller grants.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: canonical Home owner and gateway attestations absent';
END $guard$;

ALTER TABLE observer_home_review.registration_identities
  ADD COLUMN owner_epoch bigint CHECK (owner_epoch >= 0),
  ADD COLUMN revoked boolean;
ALTER TABLE observer_home_review.event_acceptances
  ADD COLUMN owner_epoch bigint CHECK (owner_epoch >= 0);
ALTER TABLE observer_home_review.registration_audit
  ADD COLUMN owner_epoch bigint;

-- Synthetic only; these rows are not a live Home ownership or Auth source.
CREATE TABLE observer_home_review.qa_owner_authority_fixture (
  registration_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);
CREATE TABLE observer_home_review.qa_owner_session_fixture (
  session_ref uuid PRIMARY KEY,
  owner_profile_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('HomeOwner','PlatformAdmin')),
  active boolean NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE observer_home_review.qa_gateway_session_fixture (
  session_ref uuid PRIMARY KEY,
  source_id uuid NOT NULL,
  active boolean NOT NULL,
  expires_at timestamptz NOT NULL
);

-- Same identity FOR UPDATE lock is first, before any state change or Signal
-- insertion. Revocation is irreversible here and advances a monotonic epoch.
CREATE FUNCTION observer_home_review.qa_revoke_registration_v1(
  p_registration_id uuid, p_expected_epoch bigint, p_owner_session_ref uuid
) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $revoke$
DECLARE
  r observer_home_review.registration_identities%ROWTYPE;
  a observer_home_review.qa_owner_authority_fixture%ROWTYPE;
  s observer_home_review.qa_owner_session_fixture%ROWTYPE;
  matched_source uuid;
  next_epoch bigint;
BEGIN
  IF p_registration_id IS NULL OR p_expected_epoch IS NULL OR p_expected_epoch < 0
    OR p_owner_session_ref IS NULL THEN
    RAISE EXCEPTION 'HOME_REVOKE_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO r FROM observer_home_review.registration_identities
    WHERE registration_id=p_registration_id FOR UPDATE;
  IF NOT FOUND OR r.revoked IS DISTINCT FROM false
    OR r.owner_epoch IS DISTINCT FROM p_expected_epoch OR r.current_version IS NULL THEN
    RAISE EXCEPTION 'HOME_REVOKE_STALE_OR_ABSENT' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM observer_home_review.qa_owner_authority_fixture
    WHERE registration_id=r.registration_id FOR SHARE;
  IF NOT FOUND OR NOT a.verified OR NOT a.active
    OR a.expires_at <= pg_catalog.clock_timestamp()
    OR a.tenant_id IS DISTINCT FROM r.tenant_id OR a.site_id IS DISTINCT FROM r.site_id
    OR a.source_id IS DISTINCT FROM r.source_id
    OR a.owner_profile_id IS DISTINCT FROM r.owner_profile_id THEN
    RAISE EXCEPTION 'HOME_REVOKE_AUTHORITY_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM observer_home_review.qa_owner_session_fixture
    WHERE session_ref=p_owner_session_ref FOR SHARE;
  IF NOT FOUND OR NOT s.active OR s.expires_at <= pg_catalog.clock_timestamp()
    OR s.kind <> 'HomeOwner' OR s.owner_profile_id IS DISTINCT FROM r.owner_profile_id THEN
    RAISE EXCEPTION 'HOME_REVOKE_OWNER_SESSION_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT c.id INTO matched_source FROM public.digital_observer_camera_sources c
    JOIN public.observer_sites t ON t.id=c.observer_site_id
    JOIN public.digital_observer_organizations o ON o.id=t.digital_observer_organization_id
    WHERE c.id=r.source_id AND c.observer_site_id=r.site_id
      AND t.id=r.site_id AND t.site_type='home' AND t.garden_id IS NULL
      AND t.owner_profile_id=r.owner_profile_id
      AND o.id=r.tenant_id AND o.owner_profile_id=r.owner_profile_id
    FOR SHARE OF c,t,o;
  IF NOT FOUND OR matched_source IS DISTINCT FROM r.source_id THEN
    RAISE EXCEPTION 'HOME_REVOKE_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';
  END IF;
  next_epoch := r.owner_epoch+1;
  UPDATE observer_home_review.registration_identities
    SET owner_epoch=next_epoch, revoked=true
    WHERE registration_id=r.registration_id AND owner_epoch=p_expected_epoch AND revoked=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'HOME_REVOKE_STALE_OR_ABSENT' USING ERRCODE='40001'; END IF;
  INSERT INTO observer_home_review.registration_audit
    (audit_ref,action,registration_id,version,actor_id,owner_epoch)
    VALUES (pg_catalog.gen_random_uuid(),'REVOKED',r.registration_id,r.current_version,
      s.owner_profile_id,next_epoch);
  RETURN next_epoch;
END $revoke$;

ALTER TABLE observer_home_review.qa_owner_authority_fixture ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_home_review.qa_owner_session_fixture ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_home_review.qa_gateway_session_fixture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA observer_home_review FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION observer_home_review.qa_revoke_registration_v1(uuid,bigint,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
-- No live application caller/adapter, ACL or grant is proposed.
ROLLBACK;
