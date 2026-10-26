-- REVIEW ONLY / NOT APPLIED. This is a missing-source sketch, not a migration.
-- Direct execution aborts before any schema, table, function, or ACL change.
BEGIN;
DO $review_guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: recipient version source and writer unqualified';
END $review_guard$;

-- Existing mutable recipient and channel rows have no decision-time version.
-- One append-only site policy version is the minimum durable source proposed
-- for *future* decisions; it cannot reconstruct historical settings.
CREATE SCHEMA observer_authority_review;
REVOKE ALL ON SCHEMA observer_authority_review FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE observer_authority_review.recipient_policy_versions (
  tenant_id uuid NOT NULL REFERENCES public.digital_observer_organizations(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.observer_sites(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK (version > 0),
  -- Canonical, server-selected IDs/channels/severity eligibility only: no
  -- destination, provider secret reference, contact value or raw profile data.
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  snapshot_fingerprint text NOT NULL CHECK (snapshot_fingerprint ~ '^[0-9a-f]{64}$'),
  audit_event_id uuid NOT NULL UNIQUE REFERENCES public.immutable_audit_events(id) ON DELETE RESTRICT,
  captured_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (site_id,version),
  UNIQUE (site_id,version,tenant_id)
);
ALTER TABLE observer_authority_review.recipient_policy_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON observer_authority_review.recipient_policy_versions
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION observer_authority_review.reject_version_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,pg_temp AS $immutable$
BEGIN
  RAISE EXCEPTION 'RECIPIENT_POLICY_VERSION_IMMUTABLE' USING ERRCODE='42501';
END;
$immutable$;
CREATE TRIGGER recipient_version_no_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE
  ON observer_authority_review.recipient_policy_versions
  FOR EACH STATEMENT EXECUTE FUNCTION observer_authority_review.reject_version_mutation_v1();
REVOKE ALL ON FUNCTION observer_authority_review.reject_version_mutation_v1()
  FROM PUBLIC,anon,authenticated,service_role;

-- BLOCKED WRITER: app/api/digital-observer/access-settings/route.ts currently
-- INSERTs/DELETEs authorized recipients directly; settings/route.ts UPDATEs
-- channel settings row-by-row. A future single DB transaction must lock the
-- authoritative Site/Tenant, validate all current recipient/settings rows,
-- CAS the policy version, write mandatory audit and this immutable snapshot,
-- and update current settings atomically. The existing routes do not do so.
-- Do not grant INSERT or treat this table as live authority before that writer,
-- ownership source, retention, ACL/RLS, and rollback are separately qualified.
-- No legacy backfill: prior values were not durably versioned.
-- No COMMIT is provided. Removing the guard alone still cannot apply this file.
ROLLBACK;
