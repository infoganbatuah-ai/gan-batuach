-- REVIEW ONLY. Synthetic transaction contract, not a migration or live authority.
-- Direct execution fails before DDL. The isolated runner removes this guard in memory.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: authoritative Home owner adapter absent';
END $guard$;

CREATE ROLE qa_registration_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE qa_registration_caller NOLOGIN NOBYPASSRLS;
CREATE ROLE qa_registration_untrusted LOGIN NOBYPASSRLS;
CREATE SCHEMA review_registration_writer;
REVOKE ALL ON SCHEMA review_registration_writer FROM PUBLIC;

-- Fixtures are populated only by the disposable runner. No live source can
-- derive verified ownership from a supplied UUID, created_by or app_metadata.
CREATE TABLE review_registration_writer.authority_fixture (
  authority_ref uuid PRIMARY KEY,
  registration_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  authorized_actor_id uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  provenance_verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);
CREATE TABLE review_registration_writer.session_fixture (
  session_ref uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('HomeOwner','PlatformAdmin')),
  active boolean NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE review_registration_writer.current_scope_fixture (
  registration_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL UNIQUE,
  owner_profile_id uuid NOT NULL,
  active boolean NOT NULL
);
CREATE TABLE review_registration_writer.registration_identities (
  registration_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL UNIQUE,
  owner_profile_id uuid NOT NULL,
  current_version bigint NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  revoked boolean NOT NULL DEFAULT false,
  UNIQUE(registration_id,tenant_id,site_id,source_id,owner_profile_id)
);
CREATE TABLE review_registration_writer.registration_audit (
  audit_ref uuid PRIMARY KEY,
  request_ref uuid NOT NULL UNIQUE,
  registration_id uuid NOT NULL,
  version bigint NOT NULL,
  actor_id uuid NOT NULL,
  authority_ref uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('QUALIFIED','RENEWED')),
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(registration_id,version)
);
CREATE TABLE review_registration_writer.registration_versions (
  registration_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  request_ref uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  authority_ref uuid NOT NULL,
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  audit_ref uuid NOT NULL UNIQUE REFERENCES review_registration_writer.registration_audit(audit_ref) ON DELETE RESTRICT,
  qualified_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(registration_id,version),
  FOREIGN KEY (registration_id,tenant_id,site_id,source_id,owner_profile_id)
    REFERENCES review_registration_writer.registration_identities
    (registration_id,tenant_id,site_id,source_id,owner_profile_id) ON DELETE RESTRICT
);
CREATE FUNCTION review_registration_writer.reject_history_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $immutable$
BEGIN
  RAISE EXCEPTION 'REGISTRATION_HISTORY_IMMUTABLE' USING ERRCODE='42501';
END $immutable$;
CREATE TRIGGER registration_versions_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON review_registration_writer.registration_versions FOR EACH STATEMENT
  EXECUTE FUNCTION review_registration_writer.reject_history_mutation_v1();
CREATE TRIGGER registration_audit_immutable BEFORE UPDATE OR DELETE OR TRUNCATE
  ON review_registration_writer.registration_audit FOR EACH STATEMENT
  EXECUTE FUNCTION review_registration_writer.reject_history_mutation_v1();

-- In a future live design the authority/session/current-scope rows MUST be
-- written by a distinct authenticated server adapter with independent Home
-- provenance. This function alone cannot create that authority. No live role
-- receives EXECUTE and no adapter is connected by this package.
CREATE FUNCTION review_registration_writer.qualify_registration_v1(
  p_registration_id uuid, p_request_ref uuid, p_authority_ref uuid,
  p_session_ref uuid, p_expected_version bigint
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $writer$
DECLARE
  h review_registration_writer.registration_identities%ROWTYPE;
  a review_registration_writer.authority_fixture%ROWTYPE;
  s review_registration_writer.session_fixture%ROWTYPE;
  c review_registration_writer.current_scope_fixture%ROWTYPE;
  old review_registration_writer.registration_versions%ROWTYPE;
  old_audit review_registration_writer.registration_audit%ROWTYPE;
  next_version bigint;
  new_audit uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF p_registration_id IS NULL OR p_request_ref IS NULL OR p_authority_ref IS NULL
    OR p_session_ref IS NULL OR p_expected_version IS NULL OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'REGISTRATION_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  -- Identity lock serializes renewal, replay, revocation and version CAS.
  SELECT * INTO h FROM review_registration_writer.registration_identities
    WHERE registration_id=p_registration_id FOR UPDATE;
  IF NOT FOUND OR h.revoked THEN
    RAISE EXCEPTION 'REGISTRATION_ABSENT_OR_REVOKED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO a FROM review_registration_writer.authority_fixture
    WHERE authority_ref=p_authority_ref FOR SHARE;
  IF NOT FOUND OR NOT a.provenance_verified OR NOT a.active
    OR a.expires_at <= pg_catalog.clock_timestamp()
    OR a.registration_id IS DISTINCT FROM h.registration_id
    OR a.tenant_id IS DISTINCT FROM h.tenant_id OR a.site_id IS DISTINCT FROM h.site_id
    OR a.source_id IS DISTINCT FROM h.source_id
    OR a.owner_profile_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'REGISTRATION_AUTHORITY_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO c FROM review_registration_writer.current_scope_fixture
    WHERE registration_id=h.registration_id FOR SHARE;
  IF NOT FOUND OR NOT c.active OR c.tenant_id IS DISTINCT FROM h.tenant_id
    OR c.site_id IS DISTINCT FROM h.site_id OR c.source_id IS DISTINCT FROM h.source_id
    OR c.owner_profile_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'REGISTRATION_CURRENT_SCOPE_CHANGED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM review_registration_writer.session_fixture
    WHERE session_ref=p_session_ref FOR SHARE;
  IF NOT FOUND OR NOT s.active OR s.expires_at <= pg_catalog.clock_timestamp()
    OR s.actor_kind <> 'HomeOwner' OR s.actor_id IS DISTINCT FROM a.authorized_actor_id
    OR s.actor_id IS DISTINCT FROM h.owner_profile_id THEN
    RAISE EXCEPTION 'REGISTRATION_ACTOR_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO old FROM review_registration_writer.registration_versions
    WHERE request_ref=p_request_ref;
  IF FOUND THEN
    SELECT * INTO old_audit FROM review_registration_writer.registration_audit
      WHERE audit_ref=old.audit_ref;
    IF old.registration_id IS DISTINCT FROM h.registration_id
      OR old.version IS DISTINCT FROM p_expected_version+1
      OR old.tenant_id IS DISTINCT FROM h.tenant_id OR old.site_id IS DISTINCT FROM h.site_id
      OR old.source_id IS DISTINCT FROM h.source_id
      OR old.owner_profile_id IS DISTINCT FROM h.owner_profile_id
      OR old.actor_id IS DISTINCT FROM s.actor_id
      OR old.authority_ref IS DISTINCT FROM a.authority_ref
      OR old.fingerprint IS DISTINCT FROM a.fingerprint
      OR old_audit.request_ref IS DISTINCT FROM p_request_ref
      OR old_audit.registration_id IS DISTINCT FROM h.registration_id
      OR old_audit.version IS DISTINCT FROM old.version
      OR old_audit.actor_id IS DISTINCT FROM s.actor_id
      OR old_audit.authority_ref IS DISTINCT FROM a.authority_ref
      OR old_audit.action IS DISTINCT FROM
        (CASE WHEN old.version=1 THEN 'QUALIFIED' ELSE 'RENEWED' END) THEN
      RAISE EXCEPTION 'REGISTRATION_REPLAY_CONFLICT' USING ERRCODE='23505';
    END IF;
    RETURN old.version;
  END IF;
  IF h.current_version <> p_expected_version THEN
    RAISE EXCEPTION 'REGISTRATION_VERSION_STALE' USING ERRCODE='40001';
  END IF;
  next_version := p_expected_version+1;
  INSERT INTO review_registration_writer.registration_audit
    (audit_ref,request_ref,registration_id,version,actor_id,authority_ref,action)
    VALUES (new_audit,p_request_ref,h.registration_id,next_version,s.actor_id,a.authority_ref,
      CASE WHEN next_version=1 THEN 'QUALIFIED' ELSE 'RENEWED' END);
  INSERT INTO review_registration_writer.registration_versions
    (registration_id,version,request_ref,tenant_id,site_id,source_id,
     owner_profile_id,actor_id,authority_ref,fingerprint,audit_ref)
    VALUES (h.registration_id,next_version,p_request_ref,h.tenant_id,h.site_id,h.source_id,
      h.owner_profile_id,s.actor_id,a.authority_ref,a.fingerprint,new_audit);
  UPDATE review_registration_writer.registration_identities SET current_version=next_version
    WHERE registration_id=h.registration_id AND current_version=p_expected_version AND NOT revoked;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REGISTRATION_VERSION_STALE' USING ERRCODE='40001';
  END IF;
  RETURN next_version;
END $writer$;

ALTER SCHEMA review_registration_writer OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.authority_fixture OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.session_fixture OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.current_scope_fixture OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.registration_identities OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.registration_audit OWNER TO qa_registration_owner;
ALTER TABLE review_registration_writer.registration_versions OWNER TO qa_registration_owner;
ALTER FUNCTION review_registration_writer.reject_history_mutation_v1() OWNER TO qa_registration_owner;
ALTER FUNCTION review_registration_writer.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
  OWNER TO qa_registration_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA review_registration_writer FROM PUBLIC,qa_registration_caller,qa_registration_untrusted;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA review_registration_writer FROM PUBLIC,qa_registration_untrusted;
GRANT USAGE ON SCHEMA review_registration_writer TO qa_registration_caller;
GRANT EXECUTE ON FUNCTION review_registration_writer.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
  TO qa_registration_caller;
-- qa_registration_caller is synthetic and must not be mapped to a real role.
ROLLBACK;
