-- REVIEW ONLY. Align two prior guarded candidates in ONE disposable schema.
-- Direct execution aborts before DDL. No deployed objects or caller grants.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: Home authority and caller provenance absent';
END $guard$;

-- a1089050 names an audit UUID but lacks the one-use request and fingerprint
-- columns used by 296aa990. Nullable columns reject unqualified old rows;
-- the runner never backfills historical registrations.
ALTER TABLE observer_home_review.registration_versions
  ADD COLUMN request_ref uuid UNIQUE,
  ADD COLUMN fingerprint text CHECK (fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE observer_home_review.registration_audit
  ADD COLUMN request_ref uuid UNIQUE,
  ADD COLUMN authority_ref uuid,
  ADD COLUMN fingerprint text;
ALTER TABLE observer_home_review.registration_audit
  DROP CONSTRAINT registration_audit_action_check;
ALTER TABLE observer_home_review.registration_audit
  ADD CONSTRAINT registration_audit_action_check
  CHECK (action IN ('QUALIFIED','RENEWED','ACCEPTED','BOUND','DENIED','REVOKED'));

-- A synthetic provenance fixture, not a live ownership source.
ALTER TABLE observer_home_review.qa_owner_authority_fixture
  ADD COLUMN authority_ref uuid UNIQUE,
  ADD COLUMN authorized_actor_id uuid,
  ADD COLUMN fingerprint text CHECK (fingerprint ~ '^[0-9a-f]{64}$');
CREATE TABLE observer_home_review.qa_current_scope_fixture (
  registration_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  active boolean NOT NULL
);
ALTER TABLE observer_home_review.qa_current_scope_fixture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON observer_home_review.qa_current_scope_fixture
  FROM PUBLIC,anon,authenticated,service_role;

-- The 296aa990 writer body is adapted by exact anchors in memory, remains
-- ungranted, and requires an independently verified fixture authority.
-- No migration, adapter, recipient change, backfill, or public RPC is supplied.
ROLLBACK;
