-- REVIEW ONLY. Synthetic fence around an existing qualified registration.
-- This is not the canonical Signal/acceptance writer from a6bd2ba5.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: no live Home authority or acceptance adapter';
END $guard$;

ALTER TABLE review_registration_writer.registration_identities
  ADD COLUMN owner_epoch bigint NOT NULL DEFAULT 0 CHECK (owner_epoch >= 0);

CREATE TABLE review_registration_writer.fence_audit (
  audit_ref uuid PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('ACCEPTED','REVOKED')),
  registration_id uuid NOT NULL,
  owner_epoch bigint NOT NULL,
  version bigint NOT NULL,
  actor_id uuid NOT NULL,
  event_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((action='ACCEPTED') = (event_id IS NOT NULL))
);
-- The guarded registration proposal has only (registration_id,version) as
-- primary key; this supporting unique key is synthetic and review-only.
ALTER TABLE review_registration_writer.registration_versions
  ADD CONSTRAINT synthetic_fence_version_scope_unique
  UNIQUE(registration_id,version,tenant_id,site_id,source_id,owner_profile_id);
CREATE TABLE review_registration_writer.synthetic_acceptance_receipts (
  event_id uuid PRIMARY KEY,
  registration_id uuid NOT NULL,
  owner_epoch bigint NOT NULL,
  registration_version bigint NOT NULL,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  observation_fingerprint text NOT NULL CHECK (observation_fingerprint ~ '^[0-9a-f]{64}$'),
  audit_ref uuid NOT NULL UNIQUE REFERENCES review_registration_writer.fence_audit(audit_ref) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY(registration_id,registration_version,tenant_id,site_id,source_id,owner_profile_id)
    REFERENCES review_registration_writer.registration_versions
      (registration_id,version,tenant_id,site_id,source_id,owner_profile_id) ON DELETE RESTRICT
);
CREATE TRIGGER fence_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON review_registration_writer.fence_audit FOR EACH STATEMENT
  EXECUTE FUNCTION review_registration_writer.reject_history_mutation_v1();
CREATE TRIGGER acceptance_receipts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON review_registration_writer.synthetic_acceptance_receipts FOR EACH STATEMENT
  EXECUTE FUNCTION review_registration_writer.reject_history_mutation_v1();

CREATE FUNCTION review_registration_writer.synthetic_accept_first_v1(
  p_registration_id uuid, p_event_id uuid, p_session_ref uuid,
  p_expected_epoch bigint, p_tenant_id uuid, p_site_id uuid, p_source_id uuid,
  p_observation_fingerprint text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $accept$
DECLARE
  h review_registration_writer.registration_identities%ROWTYPE;
  s review_registration_writer.session_fixture%ROWTYPE;
  c review_registration_writer.current_scope_fixture%ROWTYPE;
  a review_registration_writer.authority_fixture%ROWTYPE;
  r review_registration_writer.synthetic_acceptance_receipts%ROWTYPE;
  q review_registration_writer.fence_audit%ROWTYPE;
  new_audit uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF p_registration_id IS NULL OR p_event_id IS NULL OR p_session_ref IS NULL
    OR p_expected_epoch IS NULL OR p_expected_epoch < 0
    OR p_tenant_id IS NULL OR p_site_id IS NULL OR p_source_id IS NULL
    OR p_observation_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'FENCE_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO h FROM review_registration_writer.registration_identities
    WHERE registration_id=p_registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FENCE_REGISTRATION_ABSENT' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM review_registration_writer.session_fixture
    WHERE session_ref=p_session_ref FOR SHARE;
  IF NOT FOUND OR NOT s.active OR s.expires_at <= pg_catalog.clock_timestamp()
    OR s.actor_kind <> 'HomeOwner' OR s.actor_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'FENCE_SESSION_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  -- Replay after revocation may use the original immutable receipt only. It
  -- does not consult a new authority version, but still requires an active
  -- same-owner session. No newly accepted event is inferred from replay.
  SELECT * INTO r FROM review_registration_writer.synthetic_acceptance_receipts
    WHERE event_id=p_event_id;
  IF FOUND THEN
    SELECT * INTO q FROM review_registration_writer.fence_audit WHERE audit_ref=r.audit_ref;
    IF r.registration_id IS DISTINCT FROM h.registration_id
      OR r.owner_epoch IS DISTINCT FROM p_expected_epoch
      OR r.tenant_id IS DISTINCT FROM p_tenant_id OR r.site_id IS DISTINCT FROM p_site_id
      OR r.source_id IS DISTINCT FROM p_source_id
      OR r.owner_profile_id IS DISTINCT FROM h.owner_profile_id
      OR r.actor_id IS DISTINCT FROM s.actor_id
      OR r.observation_fingerprint IS DISTINCT FROM p_observation_fingerprint
      OR q.action IS DISTINCT FROM 'ACCEPTED' OR q.event_id IS DISTINCT FROM p_event_id
      OR q.registration_id IS DISTINCT FROM r.registration_id
      OR q.owner_epoch IS DISTINCT FROM r.owner_epoch
      OR q.version IS DISTINCT FROM r.registration_version
      OR q.actor_id IS DISTINCT FROM r.actor_id THEN
      RAISE EXCEPTION 'FENCE_REPLAY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN r.event_id;
  END IF;
  IF h.revoked OR h.owner_epoch <> p_expected_epoch OR h.current_version <> 1
    OR h.tenant_id IS DISTINCT FROM p_tenant_id OR h.site_id IS DISTINCT FROM p_site_id
    OR h.source_id IS DISTINCT FROM p_source_id THEN
    RAISE EXCEPTION 'FENCE_NEW_ACCEPTANCE_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO c FROM review_registration_writer.current_scope_fixture
    WHERE registration_id=h.registration_id FOR SHARE;
  IF NOT FOUND OR NOT c.active OR c.tenant_id IS DISTINCT FROM h.tenant_id
    OR c.site_id IS DISTINCT FROM h.site_id OR c.source_id IS DISTINCT FROM h.source_id
    OR c.owner_profile_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'FENCE_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM review_registration_writer.authority_fixture
    WHERE registration_id=h.registration_id AND tenant_id=h.tenant_id
      AND site_id=h.site_id AND source_id=h.source_id
      AND owner_profile_id=h.owner_profile_id AND authorized_actor_id=s.actor_id
      AND provenance_verified AND active AND expires_at > pg_catalog.clock_timestamp()
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FENCE_AUTHORITY_UNVERIFIED' USING ERRCODE='42501'; END IF;
  INSERT INTO review_registration_writer.fence_audit
    (audit_ref,action,registration_id,owner_epoch,version,actor_id,event_id)
    VALUES (new_audit,'ACCEPTED',h.registration_id,h.owner_epoch,h.current_version,s.actor_id,p_event_id);
  INSERT INTO review_registration_writer.synthetic_acceptance_receipts
    (event_id,registration_id,owner_epoch,registration_version,tenant_id,site_id,
     source_id,owner_profile_id,actor_id,observation_fingerprint,audit_ref)
    VALUES (p_event_id,h.registration_id,h.owner_epoch,h.current_version,h.tenant_id,h.site_id,
      h.source_id,h.owner_profile_id,s.actor_id,p_observation_fingerprint,new_audit);
  RETURN p_event_id;
END $accept$;

CREATE FUNCTION review_registration_writer.revoke_registration_v1(
  p_registration_id uuid, p_expected_epoch bigint, p_session_ref uuid
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $revoke$
DECLARE
  h review_registration_writer.registration_identities%ROWTYPE;
  s review_registration_writer.session_fixture%ROWTYPE;
  c review_registration_writer.current_scope_fixture%ROWTYPE;
  a review_registration_writer.authority_fixture%ROWTYPE;
  next_epoch bigint;
BEGIN
  IF p_registration_id IS NULL OR p_expected_epoch IS NULL OR p_expected_epoch < 0
    OR p_session_ref IS NULL THEN
    RAISE EXCEPTION 'FENCE_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  SELECT * INTO h FROM review_registration_writer.registration_identities
    WHERE registration_id=p_registration_id FOR UPDATE;
  IF NOT FOUND OR h.revoked OR h.owner_epoch <> p_expected_epoch OR h.current_version < 1 THEN
    RAISE EXCEPTION 'FENCE_REVOKE_STALE_OR_ABSENT' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM review_registration_writer.session_fixture
    WHERE session_ref=p_session_ref FOR SHARE;
  IF NOT FOUND OR NOT s.active OR s.expires_at <= pg_catalog.clock_timestamp()
    OR s.actor_kind <> 'HomeOwner' OR s.actor_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'FENCE_SESSION_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO c FROM review_registration_writer.current_scope_fixture
    WHERE registration_id=h.registration_id FOR SHARE;
  IF NOT FOUND OR NOT c.active OR c.tenant_id IS DISTINCT FROM h.tenant_id
    OR c.site_id IS DISTINCT FROM h.site_id OR c.source_id IS DISTINCT FROM h.source_id
    OR c.owner_profile_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'FENCE_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM review_registration_writer.authority_fixture
    WHERE registration_id=h.registration_id AND tenant_id=h.tenant_id
      AND site_id=h.site_id AND source_id=h.source_id
      AND owner_profile_id=h.owner_profile_id AND authorized_actor_id=s.actor_id
      AND provenance_verified AND active AND expires_at > pg_catalog.clock_timestamp()
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FENCE_AUTHORITY_UNVERIFIED' USING ERRCODE='42501'; END IF;
  next_epoch := h.owner_epoch+1;
  UPDATE review_registration_writer.registration_identities
    SET revoked=true, owner_epoch=next_epoch
    WHERE registration_id=h.registration_id AND owner_epoch=p_expected_epoch AND NOT revoked;
  IF NOT FOUND THEN RAISE EXCEPTION 'FENCE_REVOKE_STALE_OR_ABSENT' USING ERRCODE='40001'; END IF;
  INSERT INTO review_registration_writer.fence_audit
    (audit_ref,action,registration_id,owner_epoch,version,actor_id)
    VALUES (pg_catalog.gen_random_uuid(),'REVOKED',h.registration_id,next_epoch,h.current_version,s.actor_id);
  RETURN next_epoch;
END $revoke$;

ALTER TABLE review_registration_writer.fence_audit OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.synthetic_acceptance_receipts OWNER TO qa_registration_owner;
ALTER FUNCTION review_registration_writer.synthetic_accept_first_v1(uuid,uuid,uuid,bigint,uuid,uuid,uuid,text)
  OWNER TO qa_registration_owner;
ALTER FUNCTION review_registration_writer.revoke_registration_v1(uuid,bigint,uuid)
  OWNER TO qa_registration_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA review_registration_writer FROM PUBLIC,qa_registration_caller,qa_registration_untrusted;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA review_registration_writer FROM PUBLIC,qa_registration_untrusted;
GRANT EXECUTE ON FUNCTION review_registration_writer.synthetic_accept_first_v1(uuid,uuid,uuid,bigint,uuid,uuid,uuid,text)
  TO qa_registration_caller;
GRANT EXECUTE ON FUNCTION review_registration_writer.revoke_registration_v1(uuid,bigint,uuid)
  TO qa_registration_caller;
-- Only synthetic qa_registration_caller is granted for this disposable test.
ROLLBACK;
