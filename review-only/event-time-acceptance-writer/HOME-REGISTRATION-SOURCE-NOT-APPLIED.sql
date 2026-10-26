-- REVIEW-ONLY / NOT APPLIED. This is not a migration or an activation script.
-- The first transaction is deliberately aborted. No COMMIT is present.
BEGIN;
DO $not_applied$
BEGIN
  RAISE EXCEPTION 'NOT_APPLIED: Home registration authority, retention and isolated PostgreSQL qualification required';
END;
$not_applied$;

-- Proposed additive objects. Existing production objects are not altered.
-- This schema must NOT be added to PostgREST exposed schemas. Even a private
-- schema is not an authorization boundary for privileged/inherited DB roles.
CREATE SCHEMA observer_home_review;
REVOKE ALL ON SCHEMA observer_home_review FROM PUBLIC, anon, authenticated, service_role;

-- One immutable customer/Home/Source identity. No historical backfill.
CREATE TABLE observer_home_review.registration_identities (
  registration_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.digital_observer_organizations(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.observer_sites(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL UNIQUE REFERENCES public.digital_observer_camera_sources(id) ON DELETE RESTRICT,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  current_version bigint CHECK (current_version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (registration_id, tenant_id, site_id, source_id, owner_profile_id)
);

-- Append-only qualified versions. The actor is the authenticated approver,
-- not necessarily the installer who originally created the Source row.
CREATE TABLE observer_home_review.registration_versions (
  registration_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  registering_actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  authorized_actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  authority_ref uuid NOT NULL UNIQUE,
  qualification_audit_ref uuid NOT NULL UNIQUE,
  qualified_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY (registration_id, version),
  UNIQUE (registration_id, version, tenant_id, site_id, source_id, owner_profile_id, authority_ref),
  FOREIGN KEY (registration_id, tenant_id, site_id, source_id, owner_profile_id)
    REFERENCES observer_home_review.registration_identities
      (registration_id, tenant_id, site_id, source_id, owner_profile_id) ON DELETE RESTRICT
);

-- NULL marks a not-yet-qualified Source. The deferrable pointer FK allows
-- initial version and pointer to be installed atomically; it does not itself
-- authenticate the approver or prevent mutation by the table owner.
ALTER TABLE observer_home_review.registration_identities
  ADD CONSTRAINT registration_current_version_fk
  FOREIGN KEY (registration_id, current_version)
  REFERENCES observer_home_review.registration_versions(registration_id, version)
  DEFERRABLE INITIALLY DEFERRED;
-- A future qualification RPC must require 1 when current_version is NULL and
-- exactly current_version + 1 otherwise, then CAS the pointer and insert audit.

-- The acceptance writer MUST insert the canonical Signal and this receipt in
-- ONE transaction. No standalone writer is supplied: the active HTTP route
-- inserts a Signal separately and cannot meet this atomicity contract.
CREATE TABLE observer_home_review.event_acceptances (
  event_id uuid PRIMARY KEY REFERENCES public.observer_intelligence_signals(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  registration_version bigint NOT NULL CHECK (registration_version > 0),
  authority_ref uuid NOT NULL,
  acceptance_ref uuid NOT NULL UNIQUE,
  -- Server-owned immutable observation projection; not device time or the
  -- Signal's later mutable metadata. Its canonicalization needs qualification.
  observation_snapshot jsonb NOT NULL CHECK (jsonb_typeof(observation_snapshot) = 'object'),
  accepted_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (event_id, registration_id, registration_version, tenant_id, site_id,
          source_id, owner_profile_id, authority_ref, acceptance_ref),
  FOREIGN KEY (registration_id, registration_version, tenant_id, site_id,
               source_id, owner_profile_id, authority_ref)
    REFERENCES observer_home_review.registration_versions
      (registration_id, version, tenant_id, site_id, source_id, owner_profile_id, authority_ref)
      ON DELETE RESTRICT
);

-- Event binding preserves the original acceptance/version across renewals.
CREATE TABLE observer_home_review.event_bindings (
  event_id uuid PRIMARY KEY,
  registration_id uuid NOT NULL,
  registration_version bigint NOT NULL,
  tenant_id uuid NOT NULL,
  site_id uuid NOT NULL,
  source_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  authority_ref uuid NOT NULL,
  acceptance_ref uuid NOT NULL,
  binding_ref uuid NOT NULL UNIQUE,
  binding_audit_ref uuid NOT NULL UNIQUE,
  bound_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  FOREIGN KEY (event_id, registration_id, registration_version, tenant_id, site_id,
               source_id, owner_profile_id, authority_ref, acceptance_ref)
    REFERENCES observer_home_review.event_acceptances
      (event_id, registration_id, registration_version, tenant_id, site_id,
       source_id, owner_profile_id, authority_ref, acceptance_ref) ON DELETE RESTRICT
);

-- Proposed minimal mandatory audit, not a substitute for the existing
-- immutable_audit_events contract until atomic linkage is reviewed.
CREATE TABLE observer_home_review.registration_audit (
  audit_ref uuid PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('QUALIFIED', 'ACCEPTED', 'BOUND', 'DENIED', 'REVOKED')),
  registration_id uuid NOT NULL,
  version bigint,
  event_id uuid,
  actor_id uuid,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

-- History is append-only even if a future narrowly scoped writer receives
-- table privileges. The pointer table alone is mutable by CAS. A DB owner
-- can still disable a trigger, so owner/role provenance remains a review gate.
CREATE FUNCTION observer_home_review.reject_history_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $immutable$
BEGIN
  RAISE EXCEPTION 'HOME_REGISTRATION_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
END;
$immutable$;
CREATE TRIGGER registration_versions_no_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON observer_home_review.registration_versions
  FOR EACH STATEMENT EXECUTE FUNCTION observer_home_review.reject_history_mutation_v1();
CREATE TRIGGER event_acceptances_no_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON observer_home_review.event_acceptances
  FOR EACH STATEMENT EXECUTE FUNCTION observer_home_review.reject_history_mutation_v1();
CREATE TRIGGER event_bindings_no_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON observer_home_review.event_bindings
  FOR EACH STATEMENT EXECUTE FUNCTION observer_home_review.reject_history_mutation_v1();
CREATE TRIGGER registration_audit_no_mutation
  BEFORE UPDATE OR DELETE OR TRUNCATE ON observer_home_review.registration_audit
  FOR EACH STATEMENT EXECUTE FUNCTION observer_home_review.reject_history_mutation_v1();

-- Fail closed for direct Data API roles; no policies and no effective grants.
ALTER TABLE observer_home_review.registration_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_home_review.registration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_home_review.event_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_home_review.event_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE observer_home_review.registration_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA observer_home_review FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA observer_home_review FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION observer_home_review.reject_history_mutation_v1()
  FROM PUBLIC, anon, authenticated, service_role;

-- BLOCKED: no registration-qualification RPC. Existing profiles.role='admin',
-- app_metadata and camera_sources.created_by are not approved authority.
-- A future owner-only adapter must recheck the live session, organization,
-- Site, Source and owner under locks; CAS current_version; insert immutable
-- version and mandatory audit in the same transaction. PlatformAdmin denied.
-- BLOCKED: no acceptance RPC. It must own the canonical Signal INSERT and
-- receipt INSERT in one transaction, compare the complete immutable
-- observation on duplicate IDs, and serialize on registration identity.
-- Do not call this draft from the active cloud-events route.

-- Supported conditional suboperation: bind an EXISTING server acceptance to
-- its frozen qualified version, never the current Source version. The function
-- is SECURITY INVOKER, ungranted and unreachable until caller/table grants,
-- audit semantics and PostgreSQL race tests are independently reviewed.
CREATE FUNCTION observer_home_review.bind_accepted_event_v1(p_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $bind$
DECLARE
  a observer_home_review.event_acceptances%ROWTYPE;
  b observer_home_review.event_bindings%ROWTYPE;
  new_binding_ref uuid := pg_catalog.gen_random_uuid();
  new_audit_ref uuid := pg_catalog.gen_random_uuid();
  inserted_count integer;
BEGIN
  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'HOME_EVENT_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO a FROM observer_home_review.event_acceptances
    WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'HOME_EVENT_ACCEPTANCE_UNVERIFIED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM observer_home_review.registration_versions v
    WHERE v.registration_id = a.registration_id AND v.version = a.registration_version
      AND v.tenant_id = a.tenant_id AND v.site_id = a.site_id
      AND v.source_id = a.source_id AND v.owner_profile_id = a.owner_profile_id
      AND v.authority_ref = a.authority_ref
  ) THEN
    RAISE EXCEPTION 'HOME_EVENT_AUTHORITY_HISTORY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO observer_home_review.event_bindings
    (event_id, registration_id, registration_version, tenant_id, site_id,
     source_id, owner_profile_id, authority_ref, acceptance_ref,
     binding_ref, binding_audit_ref)
  VALUES
    (a.event_id, a.registration_id, a.registration_version, a.tenant_id, a.site_id,
     a.source_id, a.owner_profile_id, a.authority_ref, a.acceptance_ref,
     new_binding_ref, new_audit_ref)
  ON CONFLICT (event_id) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  SELECT * INTO b FROM observer_home_review.event_bindings WHERE event_id = p_event_id;
  IF NOT FOUND OR b.registration_id IS DISTINCT FROM a.registration_id
    OR b.registration_version IS DISTINCT FROM a.registration_version
    OR b.tenant_id IS DISTINCT FROM a.tenant_id OR b.site_id IS DISTINCT FROM a.site_id
    OR b.source_id IS DISTINCT FROM a.source_id
    OR b.owner_profile_id IS DISTINCT FROM a.owner_profile_id
    OR b.authority_ref IS DISTINCT FROM a.authority_ref
    OR b.acceptance_ref IS DISTINCT FROM a.acceptance_ref THEN
    RAISE EXCEPTION 'HOME_EVENT_BINDING_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF inserted_count = 1 THEN
    INSERT INTO observer_home_review.registration_audit
      (audit_ref, action, registration_id, version, event_id)
    VALUES (new_audit_ref, 'BOUND', a.registration_id, a.registration_version, a.event_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM observer_home_review.registration_audit q
    WHERE q.audit_ref = b.binding_audit_ref AND q.action = 'BOUND'
      AND q.registration_id = b.registration_id AND q.version = b.registration_version
      AND q.event_id = b.event_id
  ) THEN
    RAISE EXCEPTION 'HOME_EVENT_MANDATORY_AUDIT_MISSING' USING ERRCODE = 'P0001';
  END IF;
  RETURN b.binding_ref;
END;
$bind$;
REVOKE ALL ON FUNCTION observer_home_review.bind_accepted_event_v1(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- No GRANT, adapter wiring, backfill, deletion, TTL or retention activation.
