-- GB-M35: the legacy credential table remains only as non-secret history.
-- ci: destructive-reviewed. Deliberate secret erasure; existing Auth accounts
-- and their password hashes are unaffected. Production execution is deferred
-- to the owner-controlled release with a verified recovery backup.
-- Existing Auth password hashes and user accounts are unaffected.
-- This forward migration removes the recoverable temporary secret from all
-- ordinary SQL/API projections. Backups require separate retention review.
alter table public.generated_credentials
  drop column if exists temporary_password;

drop policy if exists "generated credentials admin only" on public.generated_credentials;
create policy "generated credential history admin read only" on public.generated_credentials
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.generated_credentials from anon, authenticated;
revoke select on public.generated_credentials from anon;

comment on table public.generated_credentials is
  'Legacy non-secret credential issuance metadata. New accounts use Auth Email invitations; plaintext temporary passwords are prohibited.';
