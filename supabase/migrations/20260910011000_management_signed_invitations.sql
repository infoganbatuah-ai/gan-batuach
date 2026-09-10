create table if not exists public.management_invitations (
  id uuid primary key default gen_random_uuid(),
  invitation_type text not null,
  intended_role text not null,
  garden_id uuid references public.gardens(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text,
  recipient_phone text,
  recipient_fingerprint text not null,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  legacy_affiliation_request_id uuid references public.user_affiliation_requests(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  delivery_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint management_invitations_type_check check (invitation_type in ('parent_guardian', 'staff', 'inspector', 'garden_management')),
  constraint management_invitations_role_check check (intended_role in ('parent', 'staff', 'inspector', 'kindergarten_manager', 'kindergarten_owner')),
  constraint management_invitations_status_check check (status in ('pending', 'delivered', 'accepted', 'rejected', 'revoked', 'expired', 'superseded')),
  constraint management_invitations_recipient_check check (recipient_email is not null or recipient_phone is not null),
  constraint management_invitations_hash_check check (length(token_hash) = 64),
  constraint management_invitations_fingerprint_check check (length(recipient_fingerprint) = 64)
);

create index if not exists management_invitations_garden_idx
  on public.management_invitations(garden_id, status, created_at desc);
create index if not exists management_invitations_recipient_idx
  on public.management_invitations(recipient_fingerprint, status, created_at desc);
create index if not exists management_invitations_expiry_idx
  on public.management_invitations(expires_at)
  where status in ('pending', 'delivered');
create unique index if not exists management_invitations_one_active_recipient_idx
  on public.management_invitations(invitation_type, coalesce(garden_id, '00000000-0000-0000-0000-000000000000'::uuid), recipient_fingerprint)
  where status in ('pending', 'delivered');

alter table public.management_invitations enable row level security;

drop policy if exists "management invitations scoped read" on public.management_invitations;
create policy "management invitations scoped read" on public.management_invitations
for select using (
  public.is_admin()
  or target_profile_id = auth.uid()
  or (garden_id is not null and public.can_manage_garden(garden_id))
);

drop policy if exists "management invitations scoped insert" on public.management_invitations;
create policy "management invitations scoped insert" on public.management_invitations
for insert with check (
  public.is_admin()
  or (garden_id is not null and public.can_manage_garden(garden_id) and created_by = auth.uid())
);

drop policy if exists "management invitations scoped update" on public.management_invitations;
create policy "management invitations scoped update" on public.management_invitations
for update using (
  public.is_admin()
  or (garden_id is not null and public.can_manage_garden(garden_id))
) with check (
  public.is_admin()
  or (garden_id is not null and public.can_manage_garden(garden_id))
);

revoke all on table public.management_invitations from anon;
grant select, insert, update on table public.management_invitations to authenticated;

comment on column public.management_invitations.token_hash is
  'SHA-256 digest only. Plain invitation tokens must never be persisted or logged.';
