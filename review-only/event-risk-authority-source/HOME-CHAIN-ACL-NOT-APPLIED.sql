-- REVIEW ONLY. This candidate is deliberately incompatible with unqualified
-- live public-table grants, Supabase authenticator routing and real provenance.
-- Direct execution aborts BEFORE any role, ACL or function mutation.
BEGIN;
DO $guard$ BEGIN
  RAISE EXCEPTION 'DRAFT_NOT_APPLIED: Home caller identity and live ACL unverified';
END $guard$;

-- Synthetic direct-login role is for an isolated container only. No password
-- or real server credential is proposed; no role membership is granted.
CREATE ROLE qa_home_chain_writer NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE qa_home_chain_executor LOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE qa_home_chain_shadow LOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA qa_home_shadow AUTHORIZATION qa_home_chain_shadow;
GRANT USAGE ON SCHEMA qa_home_shadow TO qa_home_chain_executor;

GRANT USAGE ON SCHEMA observer_home_review TO qa_home_chain_writer,qa_home_chain_executor;
GRANT USAGE ON SCHEMA public TO qa_home_chain_writer;
GRANT SELECT ON public.profiles,public.digital_observer_organizations,
  public.observer_sites,public.digital_observer_camera_sources,
  public.observer_intelligence_signals,public.observer_correlated_events,
  public.observer_correlated_event_links TO qa_home_chain_writer;
GRANT INSERT ON public.observer_intelligence_signals,
  public.observer_correlated_events,public.observer_correlated_event_links
  TO qa_home_chain_writer;
-- PostgreSQL FOR SHARE/FOR UPDATE may require UPDATE privilege on locked
-- relations. Test column-scoped grants; no such grant reaches the executor.
GRANT UPDATE(id) ON public.digital_observer_organizations,
  public.observer_sites,public.digital_observer_camera_sources,
  public.observer_intelligence_signals,public.observer_correlated_events
  TO qa_home_chain_writer;
GRANT SELECT ON observer_home_review.registration_identities,
  observer_home_review.registration_versions,observer_home_review.registration_audit,
  observer_home_review.event_acceptances,observer_home_review.event_bindings,
  observer_home_review.qa_owner_authority_fixture,
  observer_home_review.qa_owner_session_fixture,
  observer_home_review.qa_gateway_session_fixture,
  observer_home_review.qa_current_scope_fixture TO qa_home_chain_writer;
GRANT UPDATE(current_version,owner_epoch,revoked)
  ON observer_home_review.registration_identities TO qa_home_chain_writer;
GRANT UPDATE(registration_id) ON observer_home_review.qa_owner_authority_fixture,
  observer_home_review.qa_current_scope_fixture TO qa_home_chain_writer;
GRANT UPDATE(session_ref) ON observer_home_review.qa_owner_session_fixture,
  observer_home_review.qa_gateway_session_fixture TO qa_home_chain_writer;
GRANT UPDATE(event_id) ON observer_home_review.event_acceptances
  TO qa_home_chain_writer;
-- Qualification history is immutable by trigger; this narrowly scoped
-- UPDATE privilege is needed for FOR SHARE, not for a permitted mutation.
GRANT UPDATE(version) ON observer_home_review.registration_versions
  TO qa_home_chain_writer;
GRANT INSERT ON observer_home_review.registration_versions,
  observer_home_review.registration_audit,observer_home_review.event_acceptances,
  observer_home_review.event_bindings TO qa_home_chain_writer;

-- Synthetic RLS qualification for this NOLOGIN function owner only. These
-- policies are NOT a live migration: real authority and source-row policies
-- need independent design before any role/table change on Development.
CREATE POLICY qa_writer_identity ON observer_home_review.registration_identities
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_version ON observer_home_review.registration_versions
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_audit ON observer_home_review.registration_audit
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_acceptance ON observer_home_review.event_acceptances
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_binding ON observer_home_review.event_bindings
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_authority ON observer_home_review.qa_owner_authority_fixture
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_owner_session ON observer_home_review.qa_owner_session_fixture
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_gateway_session ON observer_home_review.qa_gateway_session_fixture
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);
CREATE POLICY qa_writer_current_scope ON observer_home_review.qa_current_scope_fixture
  FOR ALL TO qa_home_chain_writer USING (true) WITH CHECK (true);

-- Preserve the pinned SQL bodies and their search_path=''; change only the
-- execution boundary of the two original INVOKER functions in this fixture.
ALTER FUNCTION observer_home_review.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
  OWNER TO qa_home_chain_writer;
ALTER FUNCTION observer_home_review.qa_revoke_registration_v1(uuid,bigint,uuid)
  OWNER TO qa_home_chain_writer;
ALTER FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)
  OWNER TO qa_home_chain_writer;
ALTER FUNCTION observer_home_review.qa_revoke_registration_v1(uuid,bigint,uuid)
  SECURITY DEFINER;
ALTER FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)
  SECURITY DEFINER;

-- The canonical bind helper stays INVOKER and is callable only from the
-- definer execution context, not directly by the executor or Data API roles.
GRANT EXECUTE ON FUNCTION observer_home_review.bind_accepted_event_v1(uuid)
  TO qa_home_chain_writer;
REVOKE ALL ON FUNCTION observer_home_review.bind_accepted_event_v1(uuid)
  FROM PUBLIC,anon,authenticated,service_role,qa_home_chain_executor;

REVOKE ALL ON FUNCTION observer_home_review.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION observer_home_review.qa_revoke_registration_v1(uuid,bigint,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION observer_home_review.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
  TO qa_home_chain_executor;
GRANT EXECUTE ON FUNCTION observer_home_review.qa_revoke_registration_v1(uuid,bigint,uuid)
  TO qa_home_chain_executor;
GRANT EXECUTE ON FUNCTION observer_home_review.accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)
  TO qa_home_chain_executor;

-- The executor receives NO table DML. Existing live grants on public Signal
-- tables must be catalog-qualified; this file does not revoke shared grants.
-- Shared postgres/supabase_admin default ACLs are deliberately not changed.
ROLLBACK;
