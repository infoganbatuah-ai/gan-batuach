-- PUSH 41 — Enterprise tenancy, RBAC, SSO/SCIM foundations and service accounts.
-- Additive Development schema only. No external IdP/provider or Production mode is activated.

alter table public.digital_observer_organizations
  add column if not exists slug text,
  add column if not exists status text not null default 'active',
  add column if not exists default_timezone text not null default 'Asia/Jerusalem',
  add column if not exists support_tier text not null default 'standard';

alter table public.digital_observer_organizations drop constraint if exists digital_observer_organizations_type_check;
alter table public.digital_observer_organizations add constraint digital_observer_organizations_type_check check (organization_type in (
  'business','family','enterprise','monitoring_center','security_company','manufacturer','oem_partner','white_label_partner','custom'
));
alter table public.digital_observer_organizations drop constraint if exists digital_observer_organizations_status_check;
alter table public.digital_observer_organizations add constraint digital_observer_organizations_status_check
  check (status in ('active','suspended','closed'));
create unique index if not exists digital_observer_organizations_slug_idx
  on public.digital_observer_organizations(lower(slug)) where slug is not null;

create table if not exists public.digital_observer_organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  enterprise_role text not null,
  active boolean not null default true,
  all_sites boolean not null default false,
  permission_overrides jsonb not null default '[]'::jsonb,
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  last_authorization_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, profile_id),
  constraint do_org_membership_role_check check (enterprise_role in (
    'platform_admin','organization_owner','organization_admin','site_admin','security_operator','investigator','viewer','billing_admin'
  )),
  constraint do_org_membership_override_check check (jsonb_typeof(permission_overrides)='array'),
  constraint do_org_membership_revocation_check check (not active or revoked_at is null)
);

create table if not exists public.digital_observer_organization_member_sites (
  membership_id uuid not null references public.digital_observer_organization_memberships(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(membership_id, observer_site_id)
);

create table if not exists public.digital_observer_enterprise_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  invited_email_hash text not null,
  invited_email_hint text not null,
  token_hash text not null unique,
  enterprise_role text not null,
  all_sites boolean not null default false,
  site_scope uuid[] not null default '{}'::uuid[],
  status text not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_enterprise_invitation_role_check check (enterprise_role in (
    'organization_owner','organization_admin','site_admin','security_operator','investigator','viewer','billing_admin'
  )),
  constraint do_enterprise_invitation_status_check check (status in ('pending','accepted','cancelled','revoked','expired')),
  constraint do_enterprise_invitation_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);

create table if not exists public.digital_observer_auth_policies (
  organization_id uuid primary key references public.digital_observer_organizations(id) on delete cascade,
  policy_version text not null default 'do-auth-policy-2026-10-19',
  email_verification_enabled boolean not null default true,
  passkeys_enabled boolean not null default true,
  totp_enabled boolean not null default true,
  sso_mfa_enforced boolean not null default false,
  whatsapp_verification_mode text not null default 'disabled',
  sms_authentication_enabled boolean not null default false,
  automatic_sms_fallback_enabled boolean not null default false,
  recovery_factors jsonb not null default '["email","passkey","totp","admin_assisted"]'::jsonb,
  session_idle_minutes integer not null default 60,
  session_absolute_hours integer not null default 12,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_auth_policy_whatsapp_check check (whatsapp_verification_mode in ('disabled','sandbox','approved')),
  constraint do_auth_policy_sms_disabled check (sms_authentication_enabled=false and automatic_sms_fallback_enabled=false),
  constraint do_auth_policy_recovery_check check (jsonb_typeof(recovery_factors)='array' and jsonb_array_length(recovery_factors)>=2),
  constraint do_auth_policy_session_check check (session_idle_minutes between 5 and 1440 and session_absolute_hours between 1 and 168)
);

create table if not exists public.digital_observer_sso_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  connection_key text not null,
  protocol text not null,
  provider_mode text not null default 'disabled',
  status text not null default 'draft',
  issuer text not null,
  audience text not null,
  metadata_url text,
  secret_reference text,
  redirect_allowlist jsonb not null default '[]'::jsonb,
  domain_allowlist jsonb not null default '[]'::jsonb,
  group_role_mapping jsonb not null default '{}'::jsonb,
  jit_provisioning_enabled boolean not null default false,
  require_provider_mfa boolean not null default true,
  last_verified_at timestamptz,
  last_error_code text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, connection_key),
  constraint do_sso_protocol_check check (protocol in ('oidc','saml2')),
  constraint do_sso_mode_check check (provider_mode in ('disabled','sandbox')),
  constraint do_sso_status_check check (status in ('draft','configured','verified','suspended','revoked')),
  constraint do_sso_redirect_check check (jsonb_typeof(redirect_allowlist)='array'),
  constraint do_sso_secret_reference_check check (secret_reference is null or secret_reference like 'secret://%')
);

create table if not exists public.digital_observer_sso_transactions (
  id uuid primary key default gen_random_uuid(),
  sso_connection_id uuid not null references public.digital_observer_sso_connections(id) on delete cascade,
  state_hash text not null unique,
  nonce_hash text not null,
  redirect_uri text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint do_sso_transaction_status_check check (status in ('pending','consumed','expired','rejected')),
  constraint do_sso_transaction_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);

create table if not exists public.digital_observer_scim_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  connection_key text not null,
  provider_mode text not null default 'disabled',
  status text not null default 'draft',
  credential_hash text,
  credential_prefix text,
  credential_expires_at timestamptz,
  group_role_mapping jsonb not null default '{}'::jsonb,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, connection_key),
  constraint do_scim_mode_check check (provider_mode in ('disabled','sandbox')),
  constraint do_scim_status_check check (status in ('draft','configured','verified','suspended','revoked')),
  constraint do_scim_credential_check check ((credential_hash is null and credential_prefix is null) or (credential_hash is not null and credential_prefix is not null))
);

create table if not exists public.digital_observer_scim_subjects (
  id uuid primary key default gen_random_uuid(),
  scim_connection_id uuid not null references public.digital_observer_scim_connections(id) on delete cascade,
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  external_subject_hash text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  enterprise_role text not null default 'viewer',
  site_scope uuid[] not null default '{}'::uuid[],
  subject_status text not null default 'pending',
  last_provider_event_id text,
  suspended_at timestamptz,
  deprovisioned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scim_connection_id, external_subject_hash),
  constraint do_scim_subject_role_check check (enterprise_role in ('organization_admin','site_admin','security_operator','investigator','viewer','billing_admin')),
  constraint do_scim_subject_status_check check (subject_status in ('pending','active','suspended','deprovisioned'))
);

create table if not exists public.digital_observer_scim_event_receipts (
  id uuid primary key default gen_random_uuid(),
  scim_connection_id uuid not null references public.digital_observer_scim_connections(id) on delete cascade,
  provider_event_id text not null,
  operation text not null,
  result_status text not null,
  external_subject_hash text not null,
  safe_error_code text,
  created_at timestamptz not null default now(),
  delete_after timestamptz not null default (now() + interval '90 days'),
  unique(scim_connection_id,provider_event_id),
  constraint do_scim_event_operation_check check (operation in ('create_user','update_membership','suspend_user','deprovision_user','map_group')),
  constraint do_scim_event_result_check check (result_status in ('accepted','duplicate','denied','failed')),
  constraint do_scim_event_retention_check check (delete_after > created_at and delete_after <= created_at + interval '90 days')
);

create table if not exists public.digital_observer_service_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  display_name text not null,
  account_status text not null default 'active',
  all_sites boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_service_account_status_check check (account_status in ('active','suspended','revoked','expired')),
  constraint do_service_account_permissions_check check (jsonb_typeof(permissions)='array' and jsonb_array_length(permissions)>0),
  constraint do_service_account_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '365 days')
);

create table if not exists public.digital_observer_service_account_sites (
  service_account_id uuid not null references public.digital_observer_service_accounts(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(service_account_id, observer_site_id)
);

create table if not exists public.digital_observer_service_account_credentials (
  id uuid primary key default gen_random_uuid(),
  service_account_id uuid not null references public.digital_observer_service_accounts(id) on delete cascade,
  credential_hash text not null unique,
  credential_prefix text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  rotation_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint do_service_credential_expiry_check check (expires_at > issued_at and expires_at <= issued_at + interval '365 days')
);

create table if not exists public.digital_observer_enterprise_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_hash text not null unique,
  device_label text,
  ip_hash text,
  user_agent_family text,
  assurance_level text not null default 'password',
  suspicious boolean not null default false,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint do_enterprise_session_assurance_check check (assurance_level in ('password','email_otp','passkey','totp','sso_mfa')),
  constraint do_enterprise_session_expiry_check check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);

create table if not exists public.digital_observer_enterprise_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  tenant_id uuid,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  service_account_id uuid references public.digital_observer_service_accounts(id) on delete set null,
  scim_connection_id uuid references public.digital_observer_scim_connections(id) on delete set null,
  resource_type text not null,
  resource_id text,
  action text not null,
  authorization_decision text not null,
  result_status text not null,
  correlation_id text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint do_enterprise_audit_actor_check check (
    (actor_profile_id is not null)::int + (service_account_id is not null)::int + (scim_connection_id is not null)::int = 1
  ),
  constraint do_enterprise_audit_decision_check check (authorization_decision in ('allowed','denied')),
  constraint do_enterprise_audit_result_check check (result_status in ('success','failed','blocked','unknown'))
);

create table if not exists public.digital_observer_slo_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  policy_version integer not null default 1,
  policy_status text not null default 'draft',
  availability_target numeric(6,3) not null,
  response_minutes integer not null,
  resolution_hours integer not null,
  support_escalation jsonb not null default '[]'::jsonb,
  contractual boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  effective_from timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, policy_version),
  constraint do_slo_policy_status_check check (policy_status in ('draft','internal','approved','retired')),
  constraint do_slo_policy_target_check check (availability_target between 90 and 100 and response_minutes>0 and resolution_hours>0),
  constraint do_slo_contract_guard check (not contractual or (policy_status='approved' and approved_by is not null))
);

create index if not exists do_org_membership_profile_idx on public.digital_observer_organization_memberships(profile_id,active,organization_id);
create index if not exists do_org_membership_role_idx on public.digital_observer_organization_memberships(organization_id,enterprise_role,active);
create index if not exists do_org_member_sites_site_idx on public.digital_observer_organization_member_sites(observer_site_id,membership_id);
create index if not exists do_enterprise_invitation_org_idx on public.digital_observer_enterprise_invitations(organization_id,status,expires_at);
create index if not exists do_sso_connections_org_idx on public.digital_observer_sso_connections(organization_id,status);
create index if not exists do_scim_connections_org_idx on public.digital_observer_scim_connections(organization_id,status);
create index if not exists do_scim_receipts_retention_idx on public.digital_observer_scim_event_receipts(delete_after);
create index if not exists do_service_accounts_org_idx on public.digital_observer_service_accounts(organization_id,account_status,expires_at);
create unique index if not exists do_service_account_one_active_credential_idx
  on public.digital_observer_service_account_credentials(service_account_id) where revoked_at is null;
create index if not exists do_enterprise_sessions_profile_idx on public.digital_observer_enterprise_sessions(profile_id,revoked_at,expires_at desc);
create index if not exists do_enterprise_audit_org_idx on public.digital_observer_enterprise_audit_events(organization_id,created_at desc);
create index if not exists do_enterprise_audit_site_idx on public.digital_observer_enterprise_audit_events(observer_site_id,created_at desc) where observer_site_id is not null;

drop policy if exists "digital observer organizations scoped read" on public.digital_observer_organizations;
drop policy if exists "digital observer organizations owner update" on public.digital_observer_organizations;
create policy "digital observer organizations scoped read" on public.digital_observer_organizations
for select to authenticated using (
  public.is_admin() or owner_profile_id=auth.uid()
  or exists(select 1 from public.digital_observer_organization_memberships m
    where m.organization_id=digital_observer_organizations.id and m.profile_id=auth.uid()
      and m.active=true and m.revoked_at is null)
  or exists(select 1 from public.observer_sites s join public.observer_site_memberships m on m.observer_site_id=s.id
    where s.digital_observer_organization_id=digital_observer_organizations.id and m.profile_id=auth.uid() and m.active=true)
);
create policy "digital observer organizations owner update" on public.digital_observer_organizations
for update to authenticated using (public.is_admin() or owner_profile_id=auth.uid())
with check (public.is_admin() or owner_profile_id=auth.uid());

-- Organization state, type, owner, support tier and metadata remain server-controlled.
revoke update on public.digital_observer_organizations from authenticated;
grant update(name,slug,default_timezone) on public.digital_observer_organizations to authenticated;

alter table public.digital_observer_organization_memberships enable row level security;
alter table public.digital_observer_organization_member_sites enable row level security;
alter table public.digital_observer_enterprise_invitations enable row level security;
alter table public.digital_observer_auth_policies enable row level security;
alter table public.digital_observer_sso_connections enable row level security;
alter table public.digital_observer_sso_transactions enable row level security;
alter table public.digital_observer_scim_connections enable row level security;
alter table public.digital_observer_scim_subjects enable row level security;
alter table public.digital_observer_scim_event_receipts enable row level security;
alter table public.digital_observer_service_accounts enable row level security;
alter table public.digital_observer_service_account_sites enable row level security;
alter table public.digital_observer_service_account_credentials enable row level security;
alter table public.digital_observer_enterprise_sessions enable row level security;
alter table public.digital_observer_enterprise_audit_events enable row level security;
alter table public.digital_observer_slo_policies enable row level security;

drop policy if exists "do org membership scoped read" on public.digital_observer_organization_memberships;
drop policy if exists "do org member sites scoped read" on public.digital_observer_organization_member_sites;
drop policy if exists "do enterprise invitations scoped read" on public.digital_observer_enterprise_invitations;
drop policy if exists "do auth policies scoped read" on public.digital_observer_auth_policies;
drop policy if exists "do sso connections scoped read" on public.digital_observer_sso_connections;
drop policy if exists "do scim connections scoped read" on public.digital_observer_scim_connections;
drop policy if exists "do scim subjects scoped read" on public.digital_observer_scim_subjects;
drop policy if exists "do service accounts scoped read" on public.digital_observer_service_accounts;
drop policy if exists "do service account sites scoped read" on public.digital_observer_service_account_sites;
drop policy if exists "do enterprise sessions own or admin read" on public.digital_observer_enterprise_sessions;
drop policy if exists "do enterprise audit scoped read" on public.digital_observer_enterprise_audit_events;
drop policy if exists "do enterprise slo scoped read" on public.digital_observer_slo_policies;

create or replace function public.digital_observer_has_org_permission(
  target_organization_id uuid,
  requested_permission text,
  target_site_id uuid default null
) returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select public.is_admin() or exists (
    select 1 from public.digital_observer_organization_memberships m
    where m.organization_id=target_organization_id and m.profile_id=auth.uid() and m.active=true and m.revoked_at is null
      and (
        m.all_sites or target_site_id is null or exists (
          select 1 from public.digital_observer_organization_member_sites ms
          where ms.membership_id=m.id and ms.observer_site_id=target_site_id
        )
      )
      and requested_permission = any(case m.enterprise_role
        when 'platform_admin' then array['camera.live.view','recordings.view','evidence.view','evidence.export','events.view','incidents.manage','investigation.run','notifications.manage','watch_rules.manage','device_actions.execute','camera.configure','site.configure','users.manage','billing.read','billing.manage','api.credentials.manage','audit.read','sso.manage','sessions.manage']
        when 'organization_owner' then array['camera.live.view','recordings.view','evidence.view','evidence.export','events.view','incidents.manage','investigation.run','notifications.manage','watch_rules.manage','device_actions.execute','camera.configure','site.configure','users.manage','billing.read','billing.manage','api.credentials.manage','audit.read','sso.manage','sessions.manage']
        when 'organization_admin' then array['camera.live.view','recordings.view','evidence.view','evidence.export','events.view','incidents.manage','investigation.run','notifications.manage','watch_rules.manage','device_actions.execute','camera.configure','site.configure','users.manage','billing.read','api.credentials.manage','audit.read','sso.manage','sessions.manage']
        when 'site_admin' then array['camera.live.view','recordings.view','evidence.view','evidence.export','events.view','incidents.manage','investigation.run','notifications.manage','watch_rules.manage','device_actions.execute','camera.configure','site.configure','users.manage','audit.read','sessions.manage']
        when 'security_operator' then array['camera.live.view','recordings.view','evidence.view','events.view','incidents.manage','investigation.run','notifications.manage','watch_rules.manage','device_actions.execute']
        when 'investigator' then array['recordings.view','evidence.view','evidence.export','events.view','investigation.run']
        when 'viewer' then array['camera.live.view','recordings.view','evidence.view','events.view']
        when 'billing_admin' then array['billing.read','billing.manage']
        else array[]::text[] end)
  );
$$;

revoke all on function public.digital_observer_has_org_permission(uuid,text,uuid) from public;
grant execute on function public.digital_observer_has_org_permission(uuid,text,uuid) to authenticated, service_role;

create or replace function public.can_access_observer_site(target_site_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (select 1 from public.observer_sites s where s.id=target_site_id and (
      s.owner_profile_id=auth.uid() or (s.garden_id is not null and public.can_access_garden(s.garden_id))))
    or exists (select 1 from public.observer_site_memberships m where m.observer_site_id=target_site_id
      and m.profile_id=auth.uid() and m.active=true and m.member_role in ('owner','admin','operator','viewer','reviewer'))
    or exists (select 1 from public.observer_sites s where s.id=target_site_id and s.garden_id is null
      and s.digital_observer_organization_id is not null
      and (public.digital_observer_has_org_permission(s.digital_observer_organization_id,'camera.live.view',s.id)
        or public.digital_observer_has_org_permission(s.digital_observer_organization_id,'recordings.view',s.id)
        or public.digital_observer_has_org_permission(s.digital_observer_organization_id,'events.view',s.id)))
  );
$$;

create or replace function public.can_manage_observer_site(target_site_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (select 1 from public.observer_sites s where s.id=target_site_id and (
      s.owner_profile_id=auth.uid() or (s.garden_id is not null and public.can_manage_garden(s.garden_id))))
    or exists (select 1 from public.observer_site_memberships m where m.observer_site_id=target_site_id
      and m.profile_id=auth.uid() and m.active=true and m.member_role in ('owner','admin','operator'))
    or exists (select 1 from public.observer_sites s where s.id=target_site_id and s.garden_id is null
      and s.digital_observer_organization_id is not null
      and public.digital_observer_has_org_permission(s.digital_observer_organization_id,'site.configure',s.id))
  );
$$;

create or replace function public.digital_observer_can_read_billing_site(target_site_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select public.is_admin() or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id=target_site_id and m.profile_id=auth.uid() and m.active=true and m.member_role in ('owner','admin','billing')
  ) or exists (select 1 from public.observer_sites s where s.id=target_site_id and s.owner_profile_id=auth.uid() and s.garden_id is null and s.site_type <> 'kindergarten')
    or exists (select 1 from public.observer_sites s where s.id=target_site_id and s.garden_id is null
      and s.digital_observer_organization_id is not null
      and public.digital_observer_has_org_permission(s.digital_observer_organization_id,'billing.read',s.id));
$$;

revoke all on function public.can_access_observer_site(uuid) from public;
revoke all on function public.can_manage_observer_site(uuid) from public;
revoke all on function public.digital_observer_can_read_billing_site(uuid) from public;
grant execute on function public.can_access_observer_site(uuid) to authenticated, service_role;
grant execute on function public.can_manage_observer_site(uuid) to authenticated, service_role;
grant execute on function public.digital_observer_can_read_billing_site(uuid) to authenticated, service_role;

create policy "do org membership scoped read" on public.digital_observer_organization_memberships for select to authenticated
  using (profile_id=auth.uid() or public.digital_observer_has_org_permission(organization_id,'users.manage',null));
create policy "do org member sites scoped read" on public.digital_observer_organization_member_sites for select to authenticated
  using (exists(select 1 from public.digital_observer_organization_memberships m where m.id=membership_id and
    (m.profile_id=auth.uid() or public.digital_observer_has_org_permission(m.organization_id,'users.manage',observer_site_id))));
create policy "do enterprise invitations scoped read" on public.digital_observer_enterprise_invitations for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'users.manage',null));
create policy "do auth policies scoped read" on public.digital_observer_auth_policies for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'sso.manage',null));
create policy "do sso connections scoped read" on public.digital_observer_sso_connections for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'sso.manage',null));
create policy "do scim connections scoped read" on public.digital_observer_scim_connections for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'sso.manage',null));
create policy "do scim subjects scoped read" on public.digital_observer_scim_subjects for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'users.manage',null));
create policy "do service accounts scoped read" on public.digital_observer_service_accounts for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'api.credentials.manage',null));
create policy "do service account sites scoped read" on public.digital_observer_service_account_sites for select to authenticated
  using (exists(select 1 from public.digital_observer_service_accounts a where a.id=service_account_id
    and public.digital_observer_has_org_permission(a.organization_id,'api.credentials.manage',observer_site_id)));
create policy "do enterprise sessions own or admin read" on public.digital_observer_enterprise_sessions for select to authenticated
  using (profile_id=auth.uid() or public.digital_observer_has_org_permission(organization_id,'sessions.manage',null));
create policy "do enterprise audit scoped read" on public.digital_observer_enterprise_audit_events for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'audit.read',observer_site_id));
create policy "do enterprise slo scoped read" on public.digital_observer_slo_policies for select to authenticated
  using (exists(select 1 from public.digital_observer_organization_memberships m where m.organization_id=digital_observer_slo_policies.organization_id
    and m.profile_id=auth.uid() and m.active=true and m.revoked_at is null));

-- Sensitive writes use server-only services after explicit permission evaluation.
revoke all on public.digital_observer_organization_memberships, public.digital_observer_organization_member_sites,
  public.digital_observer_enterprise_invitations, public.digital_observer_auth_policies,
  public.digital_observer_sso_connections, public.digital_observer_sso_transactions,
  public.digital_observer_scim_connections, public.digital_observer_scim_subjects, public.digital_observer_scim_event_receipts,
  public.digital_observer_service_accounts, public.digital_observer_service_account_sites,
  public.digital_observer_service_account_credentials, public.digital_observer_enterprise_sessions,
  public.digital_observer_enterprise_audit_events, public.digital_observer_slo_policies from anon;
revoke insert, update, delete on public.digital_observer_organization_memberships, public.digital_observer_organization_member_sites,
  public.digital_observer_enterprise_invitations, public.digital_observer_auth_policies,
  public.digital_observer_sso_connections, public.digital_observer_sso_transactions,
  public.digital_observer_scim_connections, public.digital_observer_scim_subjects, public.digital_observer_scim_event_receipts,
  public.digital_observer_service_accounts, public.digital_observer_service_account_sites,
  public.digital_observer_service_account_credentials, public.digital_observer_enterprise_sessions,
  public.digital_observer_enterprise_audit_events, public.digital_observer_slo_policies from authenticated;
revoke select on public.digital_observer_service_account_credentials, public.digital_observer_sso_transactions,
  public.digital_observer_scim_event_receipts from authenticated;
grant select on public.digital_observer_organization_memberships, public.digital_observer_organization_member_sites,
  public.digital_observer_enterprise_invitations, public.digital_observer_auth_policies,
  public.digital_observer_sso_connections, public.digital_observer_scim_connections,
  public.digital_observer_scim_subjects, public.digital_observer_service_accounts,
  public.digital_observer_service_account_sites, public.digital_observer_enterprise_sessions,
  public.digital_observer_enterprise_audit_events, public.digital_observer_slo_policies to authenticated;

create or replace function public.block_digital_observer_enterprise_audit_mutation()
returns trigger language plpgsql set search_path=public as $$
begin raise exception 'Digital Observer enterprise audit is append-only'; end;
$$;
drop trigger if exists do_enterprise_audit_block_mutation on public.digital_observer_enterprise_audit_events;
create trigger do_enterprise_audit_block_mutation before update or delete on public.digital_observer_enterprise_audit_events
for each row execute function public.block_digital_observer_enterprise_audit_mutation();

insert into public.digital_observer_organization_memberships(organization_id,profile_id,enterprise_role,active,all_sites,accepted_at,metadata)
select o.id,o.owner_profile_id,'organization_owner',true,true,now(),'{"source":"push41_owner_backfill"}'::jsonb
from public.digital_observer_organizations o
on conflict(organization_id,profile_id) do nothing;

insert into public.digital_observer_auth_policies(organization_id,updated_by)
select o.id,o.owner_profile_id from public.digital_observer_organizations o
on conflict(organization_id) do nothing;

comment on table public.digital_observer_organization_memberships is 'Canonical PUSH 41 organization identity. Existing Site memberships remain the bounded compatibility layer.';
comment on table public.digital_observer_auth_policies is 'Email/Passkey/TOTP/SSO-MFA policy. SMS authentication and automatic SMS fallback are structurally disabled; generic PUSH 39 SMS delivery remains separate.';
comment on table public.digital_observer_sso_connections is 'OIDC/SAML configuration foundation. Signature verification remains delegated to an established identity provider; Production mode is not accepted by this schema.';
comment on table public.digital_observer_scim_connections is 'Governed SCIM provisioning connection. Tokens are hashed and external activation remains disabled/sandbox only.';
comment on table public.digital_observer_scim_event_receipts is 'Bounded 90-day idempotency receipts. No raw SCIM payload or identity-provider secret is stored.';
comment on table public.digital_observer_service_account_credentials is 'Hashed, expiring, rotatable service credentials. Raw credentials are returned once and never stored.';
comment on table public.digital_observer_enterprise_audit_events is 'Append-only enterprise authorization audit without secrets, raw tokens or private media.';
comment on table public.digital_observer_slo_policies is 'Internal SLA/SLO objective foundation. Contractual=true requires explicit approval and does not prove achieved service levels.';

notify pgrst, 'reload schema';
