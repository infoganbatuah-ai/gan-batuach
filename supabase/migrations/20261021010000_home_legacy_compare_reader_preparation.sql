-- PR #235: the earlier NOLOGIN reader/function proposal was withdrawn before
-- application to any environment. It would have exposed verifier material to
-- a direct database login that inherited PUBLIC function EXECUTE grants.
-- Preserve the ordered migration identity as an explicit no-op so migration
-- ledgers and existing PR review history remain reconcilable. Any future
-- Production permission correction requires a separate owner-approved change.
begin;
commit;
