-- REVIEW ONLY. Direct execution aborts before any role, function or ACL change.
-- Compose only after the guarded canonical-v1 and atomic-freeze fixture bodies.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: function-only freeze ACL candidate';
END $review_guard$;

-- These are synthetic role names, not existing Development/Production principals.
-- No membership in the writer is granted. A real executor login and credential
-- would need independent review of direct-connection/session_user behavior.
CREATE ROLE do_freeze_writer NOLOGIN NOINHERIT;
CREATE ROLE do_freeze_executor LOGIN NOINHERIT;

GRANT USAGE ON SCHEMA review_atomic,review_digest TO do_freeze_writer;
GRANT SELECT,INSERT ON review_atomic.frozen_decision,
  review_atomic.mandatory_audit TO do_freeze_writer;
-- PostgreSQL's SELECT ... FOR SHARE in the existing replay branch requires
-- UPDATE privilege on the locked relation; the immutable trigger still rejects
-- actual UPDATE, and the executor has no direct relation privilege.
GRANT UPDATE(event_id,engine_version) ON review_atomic.frozen_decision
  TO do_freeze_writer;
GRANT EXECUTE ON FUNCTION review_atomic.freeze_canonical_v1(jsonb)
  TO do_freeze_writer;
GRANT EXECUTE ON FUNCTION review_digest.canonical_bytes_v1(jsonb,integer),
  review_digest.digest_json_v1(jsonb,text),
  review_digest.snapshot_digests_v1(jsonb,uuid,uuid)
  TO do_freeze_writer;

-- This function is the only executor-facing write path. It adds a direct-login
-- check on top of EXECUTE ACL, so SET ROLE by another login cannot impersonate
-- the executor. It does not certify the caller-provided authority references.
CREATE FUNCTION review_atomic.freeze_server_v1(p_record jsonb)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $freeze_server$
BEGIN
  IF session_user IS DISTINCT FROM 'do_freeze_executor' THEN
    RAISE EXCEPTION 'FREEZE_CALLER_DENIED' USING ERRCODE='42501';
  END IF;
  RETURN review_atomic.freeze_canonical_v1(p_record);
END;
$freeze_server$;
ALTER FUNCTION review_atomic.freeze_server_v1(jsonb) OWNER TO do_freeze_writer;

-- Keep all changes, including CREATE FUNCTION's default PUBLIC EXECUTE grant,
-- in one future reviewed transaction. The draft guard above prevents execution.
REVOKE ALL ON FUNCTION review_atomic.freeze_server_v1(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION review_atomic.freeze_canonical_v1(jsonb)
  FROM PUBLIC,anon,authenticated,service_role,do_freeze_executor;
REVOKE ALL ON review_atomic.frozen_decision,review_atomic.mandatory_audit
  FROM PUBLIC,anon,authenticated,service_role,do_freeze_executor;
GRANT USAGE ON SCHEMA review_atomic TO do_freeze_executor;
GRANT EXECUTE ON FUNCTION review_atomic.freeze_server_v1(jsonb)
  TO do_freeze_executor;
-- No change to public.immutable_audit_events or actual service_role audit grants.
