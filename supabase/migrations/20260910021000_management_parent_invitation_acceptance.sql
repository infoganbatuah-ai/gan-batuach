alter table public.management_invitations
  drop constraint if exists management_invitations_status_check;

alter table public.management_invitations
  add constraint management_invitations_status_check check (status in (
    'pending', 'delivered', 'processing', 'accepted', 'rejected', 'revoked', 'expired', 'superseded'
  ));

comment on column public.management_invitations.status is
  'processing is an optimistic lock while an authenticated recipient acceptance is activated.';
