-- REVIEW ONLY: executable body is an isolated synthetic contract, not a migration.
-- The opening guard aborts direct use before any DDL. No Production/Development
-- object, authentic session, Home authority, or legacy recipient is represented.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: authoritative Home Site source and writer not qualified';
END $guard$;

-- A disposable test harness may remove only the guard and trailing ROLLBACK.
-- These fixtures deliberately cannot establish real Model A authority.
CREATE ROLE qa_policy_owner NOLOGIN NOBYPASSRLS;
CREATE ROLE qa_policy_caller NOLOGIN NOBYPASSRLS;
CREATE ROLE qa_policy_untrusted NOLOGIN NOBYPASSRLS;
CREATE SCHEMA review_policy_writer;
REVOKE ALL ON SCHEMA review_policy_writer FROM PUBLIC;

CREATE TABLE review_policy_writer.site_authority_fixture (
  site_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  owner_profile_id uuid NOT NULL,
  authority_ref uuid NOT NULL UNIQUE,
  verified boolean NOT NULL DEFAULT false
);
CREATE TABLE review_policy_writer.owner_session_fixture (
  session_ref uuid PRIMARY KEY,
  owner_profile_id uuid NOT NULL,
  active boolean NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE review_policy_writer.site_member_fixture (
  site_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  active boolean NOT NULL,
  PRIMARY KEY(site_id, profile_id)
);
CREATE TABLE review_policy_writer.current_recipients (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL,
  profile_id uuid,
  active boolean NOT NULL,
  channels jsonb NOT NULL CHECK (jsonb_typeof(channels)='array')
);
CREATE TABLE review_policy_writer.current_channel_settings (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL,
  member_profile_id uuid,
  channel text NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp','push')),
  enabled boolean NOT NULL,
  severity_levels jsonb NOT NULL CHECK (jsonb_typeof(severity_levels)='array')
);
CREATE TABLE review_policy_writer.policy_head (
  site_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  current_version bigint NOT NULL CHECK (current_version >= 0)
);
CREATE TABLE review_policy_writer.mandatory_audit (
  id uuid PRIMARY KEY,
  site_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL,
  authority_ref uuid NOT NULL,
  version bigint NOT NULL,
  fingerprint text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE(site_id,version)
);
CREATE TABLE review_policy_writer.policy_versions (
  site_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  audit_id uuid NOT NULL UNIQUE REFERENCES review_policy_writer.mandatory_audit(id) ON DELETE RESTRICT,
  captured_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  PRIMARY KEY(site_id,version)
);

CREATE FUNCTION review_policy_writer.reject_history_mutation_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $immutable$
BEGIN
  RAISE EXCEPTION 'POLICY_HISTORY_IMMUTABLE' USING ERRCODE='42501';
END;
$immutable$;
CREATE TRIGGER policy_versions_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE
  ON review_policy_writer.policy_versions FOR EACH STATEMENT
  EXECUTE FUNCTION review_policy_writer.reject_history_mutation_v1();
CREATE TRIGGER policy_audit_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE
  ON review_policy_writer.mandatory_audit FOR EACH STATEMENT
  EXECUTE FUNCTION review_policy_writer.reject_history_mutation_v1();

-- Entire operation is one PostgreSQL statement/transaction. Caller inputs
-- identify one existing, internal profile recipient OR one existing setting.
-- New external contacts, physical delivery destinations and deletions remain
-- outside this isolated candidate and are not silently snapshotted.
CREATE FUNCTION review_policy_writer.write_policy_v1(
  p_tenant_id uuid, p_site_id uuid, p_session_ref uuid,
  p_authority_ref uuid, p_expected_version bigint,
  p_recipient_id uuid, p_recipient_active boolean,
  p_setting_id uuid, p_setting_enabled boolean
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $writer$
DECLARE
  v_authority review_policy_writer.site_authority_fixture%ROWTYPE;
  v_session review_policy_writer.owner_session_fixture%ROWTYPE;
  v_head review_policy_writer.policy_head%ROWTYPE;
  v_profile uuid;
  v_recipients jsonb;
  v_settings jsonb;
  v_snapshot jsonb;
  v_fingerprint text;
  v_next bigint;
  v_audit_id uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF p_tenant_id IS NULL OR p_site_id IS NULL OR p_session_ref IS NULL
     OR p_authority_ref IS NULL OR p_expected_version IS NULL
     OR p_expected_version < 0 THEN
    RAISE EXCEPTION 'POLICY_INPUT_INVALID' USING ERRCODE='22023';
  END IF;
  IF (p_recipient_id IS NULL) = (p_setting_id IS NULL)
     OR (p_recipient_id IS NOT NULL AND (p_recipient_active IS NULL OR p_setting_enabled IS NOT NULL))
     OR (p_setting_id IS NOT NULL AND (p_setting_enabled IS NULL OR p_recipient_active IS NOT NULL)) THEN
    RAISE EXCEPTION 'POLICY_CHANGE_INVALID' USING ERRCODE='22023';
  END IF;
  -- SYNTHETIC ONLY: real authority must come from a separately qualified,
  -- immutable Home registration/owner writer, never current Site org fields.
  SELECT * INTO v_authority FROM review_policy_writer.site_authority_fixture
   WHERE site_id=p_site_id AND tenant_id=p_tenant_id
     AND authority_ref=p_authority_ref AND verified FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLICY_AUTHORITY_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_session FROM review_policy_writer.owner_session_fixture
   WHERE session_ref=p_session_ref AND owner_profile_id=v_authority.owner_profile_id
     AND active AND expires_at > pg_catalog.clock_timestamp() FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLICY_SESSION_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM review_policy_writer.site_member_fixture m
    WHERE m.site_id=p_site_id AND m.profile_id=v_authority.owner_profile_id AND m.active) THEN
    RAISE EXCEPTION 'POLICY_OWNER_MEMBERSHIP_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_head FROM review_policy_writer.policy_head
    WHERE site_id=p_site_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLICY_HEAD_UNINITIALIZED' USING ERRCODE='42501';
  END IF;
  IF v_head.current_version <> p_expected_version THEN
    RAISE EXCEPTION 'POLICY_VERSION_STALE' USING ERRCODE='40001';
  END IF;
  v_next := p_expected_version + 1;
  -- Stable lock order within this candidate: authority, session, head,
  -- memberships, recipient rows, setting rows. All future insert/delete
  -- writers must also lock the same head; row locks alone cannot stop phantoms.
  PERFORM 1 FROM review_policy_writer.site_member_fixture
    WHERE site_id=p_site_id ORDER BY profile_id FOR SHARE;
  PERFORM 1 FROM review_policy_writer.current_recipients
    WHERE site_id=p_site_id ORDER BY id FOR SHARE;
  PERFORM 1 FROM review_policy_writer.current_channel_settings
    WHERE site_id=p_site_id ORDER BY id FOR SHARE;
  IF p_recipient_id IS NOT NULL THEN
    SELECT profile_id INTO v_profile FROM review_policy_writer.current_recipients
      WHERE id=p_recipient_id AND site_id=p_site_id FOR UPDATE;
    IF NOT FOUND OR v_profile IS NULL OR NOT EXISTS (
      SELECT 1 FROM review_policy_writer.site_member_fixture m
      WHERE m.site_id=p_site_id AND m.profile_id=v_profile AND m.active
    ) THEN
      RAISE EXCEPTION 'POLICY_RECIPIENT_INELIGIBLE' USING ERRCODE='42501';
    END IF;
    UPDATE review_policy_writer.current_recipients SET active=p_recipient_active
      WHERE id=p_recipient_id AND site_id=p_site_id;
  ELSE
    SELECT member_profile_id INTO v_profile FROM review_policy_writer.current_channel_settings
      WHERE id=p_setting_id AND site_id=p_site_id FOR UPDATE;
    IF NOT FOUND OR v_profile IS NULL OR NOT EXISTS (
      SELECT 1 FROM review_policy_writer.site_member_fixture m
      WHERE m.site_id=p_site_id AND m.profile_id=v_profile AND m.active
    ) THEN
      RAISE EXCEPTION 'POLICY_SETTING_INELIGIBLE' USING ERRCODE='42501';
    END IF;
    UPDATE review_policy_writer.current_channel_settings SET enabled=p_setting_enabled
      WHERE id=p_setting_id AND site_id=p_site_id;
  END IF;
  -- Never freeze an unqualified recipient or an unknown notification channel.
  IF EXISTS (
    SELECT 1 FROM review_policy_writer.current_recipients r
    LEFT JOIN review_policy_writer.site_member_fixture m
      ON m.site_id=r.site_id AND m.profile_id=r.profile_id AND m.active
    WHERE r.site_id=p_site_id AND r.active
      AND (m.profile_id IS NULL OR pg_catalog.jsonb_array_length(r.channels)>5
        OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements_text(r.channels) AS ch(value)
          WHERE ch.value NOT IN ('in_app','email','sms','whatsapp','push')))
  ) OR EXISTS (
    SELECT 1 FROM review_policy_writer.current_channel_settings s
    LEFT JOIN review_policy_writer.site_member_fixture m
      ON m.site_id=s.site_id AND m.profile_id=s.member_profile_id AND m.active
    WHERE s.site_id=p_site_id AND s.enabled
      AND (m.profile_id IS NULL OR pg_catalog.jsonb_array_length(s.severity_levels)>5
        OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements_text(s.severity_levels) AS level(value)
          WHERE level.value NOT IN ('info','low','medium','high','critical')))
  ) THEN
    RAISE EXCEPTION 'POLICY_CURRENT_ELIGIBILITY_UNVERIFIED' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('recipientId',r.id,'profileId',r.profile_id,
      'channels',(SELECT coalesce(pg_catalog.jsonb_agg(ch ORDER BY ch),'[]'::jsonb)
        FROM (SELECT DISTINCT value AS ch FROM pg_catalog.jsonb_array_elements_text(r.channels)) c))
    ORDER BY r.id),'[]'::jsonb) INTO v_recipients
    FROM review_policy_writer.current_recipients r WHERE r.site_id=p_site_id AND r.active;
  SELECT coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('settingId',s.id,'profileId',s.member_profile_id,
      'channel',s.channel,
      'severity',(SELECT coalesce(pg_catalog.jsonb_agg(level ORDER BY level),'[]'::jsonb)
        FROM (SELECT DISTINCT value AS level FROM pg_catalog.jsonb_array_elements_text(s.severity_levels)) l))
    ORDER BY s.id),'[]'::jsonb) INTO v_settings
    FROM review_policy_writer.current_channel_settings s WHERE s.site_id=p_site_id AND s.enabled;
  v_snapshot := pg_catalog.jsonb_build_object('schemaVersion',1,'tenantId',p_tenant_id,
    'siteId',p_site_id,'version',v_next,'recipients',v_recipients,'settings',v_settings);
  v_fingerprint := pg_catalog.encode(pg_catalog.sha256(
    pg_catalog.convert_to(v_snapshot::text,'UTF8')),'hex');
  -- Mandatory audit and version share one transaction with current writes.
  INSERT INTO review_policy_writer.mandatory_audit
    (id,site_id,tenant_id,actor_profile_id,authority_ref,version,fingerprint)
    VALUES (v_audit_id,p_site_id,p_tenant_id,v_authority.owner_profile_id,
      p_authority_ref,v_next,v_fingerprint);
  INSERT INTO review_policy_writer.policy_versions
    (site_id,tenant_id,version,snapshot,fingerprint,audit_id)
    VALUES (p_site_id,p_tenant_id,v_next,v_snapshot,v_fingerprint,v_audit_id);
  UPDATE review_policy_writer.policy_head SET current_version=v_next
    WHERE site_id=p_site_id AND tenant_id=p_tenant_id AND current_version=p_expected_version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POLICY_VERSION_STALE' USING ERRCODE='40001';
  END IF;
  RETURN v_next;
END;
$writer$;

-- Only the isolated harness supplies these role owners. In real Supabase,
-- session and Site authority provenance, role mapping, Data API exposure and
-- RLS need independent review. No authenticated/anon/service_role grant.
ALTER SCHEMA review_policy_writer OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.site_authority_fixture OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.owner_session_fixture OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.site_member_fixture OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.current_recipients OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.current_channel_settings OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.policy_head OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.mandatory_audit OWNER TO qa_policy_owner;
ALTER TABLE review_policy_writer.policy_versions OWNER TO qa_policy_owner;
ALTER FUNCTION review_policy_writer.reject_history_mutation_v1() OWNER TO qa_policy_owner;
ALTER FUNCTION review_policy_writer.write_policy_v1(uuid,uuid,uuid,uuid,bigint,uuid,boolean,uuid,boolean)
  OWNER TO qa_policy_owner;
REVOKE ALL ON ALL TABLES IN SCHEMA review_policy_writer FROM PUBLIC,qa_policy_caller,qa_policy_untrusted;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA review_policy_writer FROM PUBLIC,qa_policy_untrusted;
GRANT USAGE ON SCHEMA review_policy_writer TO qa_policy_caller;
GRANT EXECUTE ON FUNCTION review_policy_writer.write_policy_v1(uuid,uuid,uuid,uuid,bigint,uuid,boolean,uuid,boolean)
  TO qa_policy_caller;

-- The guard and this ROLLBACK must both be removed deliberately in a
-- disposable synthetic test. There is no proposed live grant or migration.
ROLLBACK;
