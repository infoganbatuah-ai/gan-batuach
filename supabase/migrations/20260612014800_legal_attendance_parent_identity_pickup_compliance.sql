-- PHASE 148: Legal Attendance, Parent Identity & Child Pickup Compliance Platform

alter table if exists public.authorized_pickup_contacts
  drop constraint if exists authorized_pickup_contacts_relation_check;

alter table if exists public.authorized_pickup_contacts
  add constraint authorized_pickup_contacts_relation_check
  check (relation in (
    'mother','father','parent','second_parent','grandparent','sibling','babysitter','nanny',
    'guardian','approved_pickup_contact','emergency_contact','temporary','other'
  ));

alter table if exists public.authorized_pickup_contacts
  add column if not exists authorized_adult_id uuid,
  add column if not exists identity_verification_status text not null default 'pending',
  add column if not exists authorization_status text not null default 'approved',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists one_time_use boolean not null default false,
  add column if not exists used_at timestamptz,
  add column if not exists legal_identity_method text not null default 'parent_declared',
  add column if not exists biometric_identification_used boolean not null default false,
  add column if not exists camera_based_authorization_used boolean not null default false;

alter table if exists public.authorized_pickup_contacts
  drop constraint if exists authorized_pickup_contacts_identity_status_check;

alter table if exists public.authorized_pickup_contacts
  add constraint authorized_pickup_contacts_identity_status_check
  check (identity_verification_status in ('pending','phone_verified','mfa_verified','document_verified','manager_verified','rejected'));

alter table if exists public.authorized_pickup_contacts
  drop constraint if exists authorized_pickup_contacts_auth_status_check;

alter table if exists public.authorized_pickup_contacts
  add constraint authorized_pickup_contacts_auth_status_check
  check (authorization_status in ('pending','approved','rejected','revoked','expired','used','blocked'));

create table if not exists public.authorized_adults (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  source_pickup_contact_id uuid unique references public.authorized_pickup_contacts(id) on delete set null,
  full_name text not null,
  identity_number text,
  phone text,
  relationship text not null,
  identity_verification_status text not null default 'pending',
  authorization_status text not null default 'pending',
  authorization_scope text not null default 'pickup',
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz,
  last_verified_at timestamptz,
  biometric_identification_allowed boolean not null default false,
  camera_based_identification_allowed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authorized_adults_relationship_check check (relationship in ('mother','father','parent','grandparent','babysitter','guardian','approved_pickup_contact','emergency_contact','temporary','other')),
  constraint authorized_adults_identity_status_check check (identity_verification_status in ('pending','phone_verified','mfa_verified','document_verified','manager_verified','rejected')),
  constraint authorized_adults_authorization_status_check check (authorization_status in ('pending','approved','rejected','revoked','expired','used','blocked')),
  constraint authorized_adults_scope_check check (authorization_scope in ('attendance','pickup','attendance_and_pickup','emergency'))
);

create table if not exists public.pickup_authorizations (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  authorized_adult_id uuid references public.authorized_adults(id) on delete cascade,
  pickup_contact_id uuid references public.authorized_pickup_contacts(id) on delete set null,
  authorization_type text not null default 'permanent',
  status text not null default 'pending',
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  used_at timestamptz,
  approval_method text not null default 'parent_request',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_authorizations_type_check check (authorization_type in ('permanent','temporary','one_time','emergency')),
  constraint pickup_authorizations_status_check check (status in ('pending','approved','rejected','revoked','expired','used','blocked')),
  constraint pickup_authorizations_method_check check (approval_method in ('parent_request','manager_approval','emergency_manager_approval','admin_override','migration'))
);

create table if not exists public.gps_attendance_validations (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.attendance(id) on delete set null,
  pickup_event_id uuid references public.child_pickup_events(id) on delete set null,
  child_id uuid references public.children(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  authorized_adult_id uuid references public.authorized_adults(id) on delete set null,
  action text not null,
  actor_lat numeric(10,7),
  actor_lng numeric(10,7),
  garden_lat numeric(10,7),
  garden_lng numeric(10,7),
  radius_meters integer not null default 30,
  distance_meters numeric,
  validation_result text not null default 'not_available',
  device_label text,
  ip inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint gps_attendance_action_check check (action in ('check_in','check_out','pickup','temporary_authorization','emergency_override')),
  constraint gps_attendance_result_check check (validation_result in ('passed','failed','not_available','manual_override','requires_review')),
  constraint gps_attendance_radius_check check (radius_meters between 5 and 500)
);

create table if not exists public.attendance_digital_signatures (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.attendance(id) on delete set null,
  pickup_event_id uuid references public.child_pickup_events(id) on delete set null,
  child_id uuid references public.children(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  signed_by_profile_id uuid references public.profiles(id) on delete set null,
  authorized_adult_id uuid references public.authorized_adults(id) on delete set null,
  action text not null,
  signature_image text,
  signature_hash text,
  signed_at timestamptz not null default now(),
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  gps_validation_id uuid references public.gps_attendance_validations(id) on delete set null,
  ip inet,
  user_agent text,
  device_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint attendance_signature_action_check check (action in ('check_in','check_out','pickup','temporary_authorization','emergency_override'))
);

create table if not exists public.attendance_compliance_audit_trail (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.attendance(id) on delete set null,
  pickup_event_id uuid references public.child_pickup_events(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  authorized_adult_id uuid references public.authorized_adults(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  status text not null default 'logged',
  gps_validation_result text,
  signature_id uuid references public.attendance_digital_signatures(id) on delete set null,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint attendance_audit_action_check check (action in ('check_in_requested','check_in_completed','check_out_requested','check_out_completed','pickup_blocked','pickup_authorization_created','temporary_authorization_created','emergency_pickup_approved','manual_override','signature_recorded','gps_validated')),
  constraint attendance_audit_status_check check (status in ('logged','success','blocked','warning','failed'))
);

create table if not exists public.attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  attendance_id uuid references public.attendance(id) on delete set null,
  pickup_event_id uuid references public.child_pickup_events(id) on delete set null,
  authorized_adult_id uuid references public.authorized_adults(id) on delete set null,
  exception_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  details text,
  resolution_notes text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint attendance_exception_type_check check (exception_type in ('failed_gps','unauthorized_pickup','expired_authorization','missing_signature','manual_override','identity_not_verified','emergency_pickup')),
  constraint attendance_exception_severity_check check (severity in ('critical','high','medium','low')),
  constraint attendance_exception_status_check check (status in ('open','reviewing','resolved','dismissed'))
);

create table if not exists public.attendance_compliance_scores (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  score_date date not null default current_date,
  attendance_compliance_score integer not null default 0,
  gps_validation_rate numeric not null default 0,
  signature_completion_rate numeric not null default 0,
  authorization_compliance_rate numeric not null default 0,
  exception_rate numeric not null default 0,
  readiness_status text not null default 'partial',
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, score_date),
  constraint attendance_compliance_score_check check (attendance_compliance_score between 0 and 100),
  constraint attendance_compliance_status_check check (readiness_status in ('ready','partial','blocked','needs_review'))
);

create table if not exists public.attendance_compliance_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  check_area text not null,
  title text not null,
  status text not null default 'partial',
  readiness_score integer not null default 0,
  severity text not null default 'medium',
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_compliance_area_check check (check_area in ('authorized_adults','pickup_authorization','gps_validation','digital_signature','audit_trail','exceptions','privacy','parent_verification')),
  constraint attendance_compliance_status_check check (status in ('ready','partial','pending','blocked','needs_legal_review')),
  constraint attendance_compliance_score_range_check check (readiness_score between 0 and 100),
  constraint attendance_compliance_severity_check check (severity in ('critical','high','medium','low'))
);

alter table if exists public.attendance
  add column if not exists authorized_adult_id uuid references public.authorized_adults(id) on delete set null,
  add column if not exists gps_validation_id uuid references public.gps_attendance_validations(id) on delete set null,
  add column if not exists gps_validation_status text not null default 'not_available',
  add column if not exists gps_distance_meters numeric,
  add column if not exists signature_id uuid references public.attendance_digital_signatures(id) on delete set null,
  add column if not exists legal_attendance_method text not null default 'adult_initiated',
  add column if not exists parent_identity_verified boolean not null default false,
  add column if not exists biometric_identification_used boolean not null default false,
  add column if not exists camera_based_attendance_used boolean not null default false;

alter table if exists public.attendance
  drop constraint if exists attendance_gps_validation_status_check;

alter table if exists public.attendance
  add constraint attendance_gps_validation_status_check
  check (gps_validation_status in ('passed','failed','not_available','manual_override','requires_review'));

alter table if exists public.attendance
  drop constraint if exists attendance_legal_method_check;

alter table if exists public.attendance
  add constraint attendance_legal_method_check
  check (legal_attendance_method in ('adult_initiated','staff_recorded','manager_override','emergency_override'));

alter table if exists public.child_pickup_events
  add column if not exists authorized_adult_id uuid references public.authorized_adults(id) on delete set null,
  add column if not exists pickup_authorization_id uuid references public.pickup_authorizations(id) on delete set null,
  add column if not exists gps_validation_id uuid references public.gps_attendance_validations(id) on delete set null,
  add column if not exists gps_validation_status text not null default 'not_available',
  add column if not exists gps_distance_meters numeric,
  add column if not exists signature_id uuid references public.attendance_digital_signatures(id) on delete set null,
  add column if not exists identity_verification_status text not null default 'pending',
  add column if not exists legal_release_status text not null default 'pending_review',
  add column if not exists biometric_identification_used boolean not null default false,
  add column if not exists camera_based_release_used boolean not null default false;

alter table if exists public.child_pickup_events
  drop constraint if exists child_pickup_events_gps_validation_status_check;

alter table if exists public.child_pickup_events
  add constraint child_pickup_events_gps_validation_status_check
  check (gps_validation_status in ('passed','failed','not_available','manual_override','requires_review'));

alter table if exists public.child_pickup_events
  drop constraint if exists child_pickup_events_identity_status_check;

alter table if exists public.child_pickup_events
  add constraint child_pickup_events_identity_status_check
  check (identity_verification_status in ('pending','phone_verified','mfa_verified','document_verified','manager_verified','rejected'));

alter table if exists public.child_pickup_events
  drop constraint if exists child_pickup_events_legal_release_status_check;

alter table if exists public.child_pickup_events
  add constraint child_pickup_events_legal_release_status_check
  check (legal_release_status in ('pending_review','authorized','blocked','emergency_approved','manual_override','completed'));

alter table if exists public.authorized_pickup_contacts
  drop constraint if exists authorized_pickup_contacts_authorized_adult_fk;

alter table if exists public.authorized_pickup_contacts
  add constraint authorized_pickup_contacts_authorized_adult_fk
  foreign key (authorized_adult_id) references public.authorized_adults(id) on delete set null;

create index if not exists authorized_adults_garden_idx on public.authorized_adults(garden_id, authorization_status);
create index if not exists authorized_adults_child_idx on public.authorized_adults(child_id, authorization_status);
create index if not exists pickup_authorizations_child_idx on public.pickup_authorizations(child_id, status, valid_until);
create index if not exists gps_attendance_validations_garden_idx on public.gps_attendance_validations(garden_id, created_at desc);
create index if not exists attendance_signatures_garden_idx on public.attendance_digital_signatures(garden_id, created_at desc);
create index if not exists attendance_audit_garden_idx on public.attendance_compliance_audit_trail(garden_id, created_at desc);
create index if not exists attendance_exceptions_status_idx on public.attendance_exceptions(status, severity, created_at desc);
create index if not exists attendance_scores_garden_idx on public.attendance_compliance_scores(garden_id, score_date desc);

alter table public.authorized_adults enable row level security;
alter table public.pickup_authorizations enable row level security;
alter table public.gps_attendance_validations enable row level security;
alter table public.attendance_digital_signatures enable row level security;
alter table public.attendance_compliance_audit_trail enable row level security;
alter table public.attendance_exceptions enable row level security;
alter table public.attendance_compliance_scores enable row level security;
alter table public.attendance_compliance_checks enable row level security;

drop policy if exists "authorized adults scoped read" on public.authorized_adults;
create policy "authorized adults scoped read" on public.authorized_adults
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or parent_profile_id = auth.uid()
  or exists (
    select 1 from public.children c
    left join public.parents p on p.id = c.primary_parent_id
    where c.id = child_id and (p.profile_id = auth.uid() or p.user_id = auth.uid())
  )
);

drop policy if exists "authorized adults scoped write" on public.authorized_adults;
create policy "authorized adults scoped write" on public.authorized_adults
for all using (public.is_admin() or public.can_access_garden(garden_id) or parent_profile_id = auth.uid())
with check (public.is_admin() or public.can_access_garden(garden_id) or parent_profile_id = auth.uid());

drop policy if exists "pickup authorizations scoped read" on public.pickup_authorizations;
create policy "pickup authorizations scoped read" on public.pickup_authorizations
for select using (public.is_admin() or public.can_access_garden(garden_id) or exists (
  select 1 from public.children c
  left join public.parents p on p.id = c.primary_parent_id
  where c.id = child_id and (p.profile_id = auth.uid() or p.user_id = auth.uid())
));

drop policy if exists "pickup authorizations scoped write" on public.pickup_authorizations;
create policy "pickup authorizations scoped write" on public.pickup_authorizations
for all using (public.is_admin() or public.can_access_garden(garden_id) or created_by = auth.uid())
with check (public.is_admin() or public.can_access_garden(garden_id) or created_by = auth.uid());

drop policy if exists "gps attendance scoped read" on public.gps_attendance_validations;
create policy "gps attendance scoped read" on public.gps_attendance_validations
for select using (public.is_admin() or public.can_access_garden(garden_id) or actor_profile_id = auth.uid());

drop policy if exists "gps attendance scoped insert" on public.gps_attendance_validations;
create policy "gps attendance scoped insert" on public.gps_attendance_validations
for insert with check (public.is_admin() or public.can_access_garden(garden_id) or actor_profile_id = auth.uid());

drop policy if exists "attendance signatures scoped read" on public.attendance_digital_signatures;
create policy "attendance signatures scoped read" on public.attendance_digital_signatures
for select using (public.is_admin() or public.can_access_garden(garden_id) or signed_by_profile_id = auth.uid());

drop policy if exists "attendance signatures scoped insert" on public.attendance_digital_signatures;
create policy "attendance signatures scoped insert" on public.attendance_digital_signatures
for insert with check (public.is_admin() or public.can_access_garden(garden_id) or signed_by_profile_id = auth.uid());

drop policy if exists "attendance audit scoped read" on public.attendance_compliance_audit_trail;
create policy "attendance audit scoped read" on public.attendance_compliance_audit_trail
for select using (public.is_admin() or public.can_access_garden(garden_id) or actor_profile_id = auth.uid());

drop policy if exists "attendance audit scoped insert" on public.attendance_compliance_audit_trail;
create policy "attendance audit scoped insert" on public.attendance_compliance_audit_trail
for insert with check (public.is_admin() or public.can_access_garden(garden_id) or actor_profile_id = auth.uid());

drop policy if exists "attendance exceptions admin manager" on public.attendance_exceptions;
create policy "attendance exceptions admin manager" on public.attendance_exceptions
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "attendance scores admin manager" on public.attendance_compliance_scores;
create policy "attendance scores admin manager" on public.attendance_compliance_scores
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "attendance checks admin only" on public.attendance_compliance_checks;
create policy "attendance checks admin only" on public.attendance_compliance_checks
for all using (public.is_admin()) with check (public.is_admin());

insert into public.authorized_adults (
  garden_id,
  child_id,
  source_pickup_contact_id,
  full_name,
  identity_number,
  phone,
  relationship,
  identity_verification_status,
  authorization_status,
  authorization_scope,
  created_by,
  approved_by,
  approved_at,
  expires_at,
  biometric_identification_allowed,
  camera_based_identification_allowed,
  notes,
  metadata
)
select
  contact.kindergarten_id,
  contact.child_id,
  contact.id,
  contact.full_name,
  contact.identity_number,
  contact.phone,
  case
    when contact.relation = 'second_parent' then 'parent'
    when contact.relation = 'nanny' then 'babysitter'
    when contact.relation in ('mother','father','parent','grandparent','babysitter','guardian','approved_pickup_contact','emergency_contact','temporary','other') then contact.relation
    else 'other'
  end,
  coalesce(nullif(contact.identity_verification_status, ''), 'pending'),
  case
    when contact.active = false then 'revoked'
    when contact.valid_until is not null and contact.valid_until < now() then 'expired'
    else coalesce(nullif(contact.authorization_status, ''), 'approved')
  end,
  'pickup',
  contact.created_by,
  contact.approved_by,
  contact.approved_at,
  contact.valid_until,
  false,
  false,
  contact.notes,
  jsonb_build_object('source', 'authorized_pickup_contacts_backfill', 'no_face_recognition', true)
from public.authorized_pickup_contacts contact
where not exists (
  select 1 from public.authorized_adults adult where adult.source_pickup_contact_id = contact.id
);

update public.authorized_pickup_contacts contact
set authorized_adult_id = adult.id
from public.authorized_adults adult
where adult.source_pickup_contact_id = contact.id
  and contact.authorized_adult_id is null;

insert into public.pickup_authorizations (
  child_id,
  garden_id,
  authorized_adult_id,
  pickup_contact_id,
  authorization_type,
  status,
  created_by,
  approved_by,
  approved_at,
  valid_from,
  valid_until,
  approval_method,
  notes,
  metadata
)
select
  contact.child_id,
  contact.kindergarten_id,
  contact.authorized_adult_id,
  contact.id,
  case when contact.authorization_type = 'temporary' then 'temporary' when contact.one_time_use then 'one_time' else 'permanent' end,
  case
    when contact.active = false then 'revoked'
    when contact.valid_until is not null and contact.valid_until < now() then 'expired'
    else 'approved'
  end,
  contact.created_by,
  contact.approved_by,
  contact.approved_at,
  contact.valid_from,
  contact.valid_until,
  'migration',
  contact.notes,
  jsonb_build_object('source', 'authorized_pickup_contacts_backfill')
from public.authorized_pickup_contacts contact
where contact.authorized_adult_id is not null
  and not exists (
    select 1 from public.pickup_authorizations auth where auth.pickup_contact_id = contact.id
  );

insert into public.attendance_compliance_checks (check_key, check_area, title, status, readiness_score, severity, evidence_summary, recommended_action, metadata)
values
  ('authorized-adults-registry', 'authorized_adults', 'Authorized adults registry', 'ready', 84, 'critical', 'authorized_adults is aligned with pickup contacts and separates adult identity from child records.', 'Keep parent and manager approval flows synced with the registry.', '{"no_face_recognition":true}'::jsonb),
  ('pickup-authorization-engine', 'pickup_authorization', 'Pickup authorization engine', 'partial', 76, 'critical', 'Permanent, temporary, one-time and emergency authorization records are modeled.', 'Enforce one-time use and expiration in all pickup UI paths.', '{}'::jsonb),
  ('gps-attendance-validation', 'gps_validation', 'GPS attendance validation', 'partial', 68, 'high', 'GPS validation stores adult location, kindergarten location, radius and result.', 'Connect parent mobile check-in/out to live geolocation.', '{"default_radius_meters":30}'::jsonb),
  ('digital-attendance-signatures', 'digital_signature', 'Digital signature platform', 'partial', 66, 'high', 'Signatures can be attached to attendance and pickup records with device, IP and GPS evidence.', 'Add signature pad to parent pickup and check-in flows.', '{}'::jsonb),
  ('attendance-audit-trail', 'audit_trail', 'Attendance audit trail', 'ready', 82, 'critical', 'Attendance, pickup, GPS and signature actions can be recorded in attendance_compliance_audit_trail.', 'Treat audit rows as append-only operational records.', '{}'::jsonb),
  ('unauthorized-pickup-prevention', 'exceptions', 'Unauthorized pickup prevention', 'partial', 72, 'critical', 'Expired or unauthorized pickup attempts are represented as exceptions and blocked statuses.', 'Create manager alert automation for unauthorized pickup attempts.', '{}'::jsonb),
  ('parent-verification-layer', 'parent_verification', 'Parent verification layer', 'partial', 64, 'high', 'Parent verification is modeled through MFA, phone and document verification statuses.', 'Require MFA for parent-initiated attendance and pickup approval.', '{}'::jsonb),
  ('no-biometric-attendance', 'privacy', 'No biometric or camera-based attendance', 'ready', 92, 'critical', 'Attendance and pickup records explicitly track biometric_identification_used=false and camera_based_*_used=false.', 'Keep face recognition disabled for Gan Batuach attendance.', '{"legal_mode":"GAN_BATUACH_ISRAEL_MODE"}'::jsonb)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  title = excluded.title,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.attendance_compliance_scores (
  garden_id,
  score_date,
  attendance_compliance_score,
  gps_validation_rate,
  signature_completion_rate,
  authorization_compliance_rate,
  exception_rate,
  readiness_status,
  findings,
  recommendations
)
select
  g.id,
  current_date,
  greatest(0, least(100,
    55
    + case when count(distinct contact.id) > 0 then 15 else 0 end
    + case when count(distinct gps.id) > 0 then 10 else 0 end
    + case when count(distinct sig.id) > 0 then 10 else 0 end
    - least(25, count(distinct ex.id) * 5)
  ))::int,
  case when count(distinct a.id) = 0 then 0 else round((count(distinct gps.id)::numeric / greatest(count(distinct a.id), 1)) * 100, 2) end,
  case when count(distinct coalesce(a.id, pickup.id)) = 0 then 0 else round((count(distinct sig.id)::numeric / greatest(count(distinct coalesce(a.id, pickup.id)), 1)) * 100, 2) end,
  case when count(distinct pickup.id) = 0 then 100 else round((count(distinct auth.id)::numeric / greatest(count(distinct pickup.id), 1)) * 100, 2) end,
  case when count(distinct pickup.id) + count(distinct a.id) = 0 then 0 else round((count(distinct ex.id)::numeric / greatest(count(distinct pickup.id) + count(distinct a.id), 1)) * 100, 2) end,
  'partial',
  jsonb_build_array('Initial compliance score generated from existing attendance and pickup records.'),
  jsonb_build_array('Enable parent GPS and digital signatures before production.')
from public.gardens g
left join public.authorized_pickup_contacts contact on contact.kindergarten_id = g.id
left join public.attendance a on a.garden_id = g.id and a.attendance_date >= current_date - 30
left join public.child_pickup_events pickup on pickup.kindergarten_id = g.id and pickup.pickup_time >= now() - interval '30 days'
left join public.pickup_authorizations auth on auth.garden_id = g.id and auth.status = 'approved'
left join public.gps_attendance_validations gps on gps.garden_id = g.id and gps.created_at >= now() - interval '30 days'
left join public.attendance_digital_signatures sig on sig.garden_id = g.id and sig.created_at >= now() - interval '30 days'
left join public.attendance_exceptions ex on ex.garden_id = g.id and ex.status in ('open','reviewing')
group by g.id
on conflict (garden_id, score_date) do update set
  attendance_compliance_score = excluded.attendance_compliance_score,
  gps_validation_rate = excluded.gps_validation_rate,
  signature_completion_rate = excluded.signature_completion_rate,
  authorization_compliance_rate = excluded.authorization_compliance_rate,
  exception_rate = excluded.exception_rate,
  readiness_status = excluded.readiness_status,
  findings = excluded.findings,
  recommendations = excluded.recommendations,
  updated_at = now();

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('privacy', 'legal-attendance-no-biometrics', 'Legal attendance without biometrics', 'partial', 'critical', 'Attendance and pickup compliance now use authorized adults, GPS, signatures and audit logs instead of child face recognition or camera attendance.', 'Complete parent mobile signature and live GPS UX before production.', '{"phase":148,"no_child_face_recognition":true}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.authorized_adults is 'Legal parent/adult identity registry for attendance and pickup. No facial identification or passive biometric processing.';
comment on table public.pickup_authorizations is 'Permanent, temporary, one-time and emergency pickup authorizations linked to authorized adults.';
comment on table public.gps_attendance_validations is 'GPS validation evidence for check-in, check-out and pickup workflows.';
comment on table public.attendance_digital_signatures is 'Digital signatures for attendance and pickup actions with GPS, IP and device metadata.';
comment on table public.attendance_compliance_audit_trail is 'Append-only compliance-oriented audit trail for attendance, pickup, GPS and signature actions.';
comment on table public.attendance_exceptions is 'Attendance and pickup exception center for failed GPS, unauthorized pickup, missing signatures and manual overrides.';
comment on table public.attendance_compliance_scores is '0-100 attendance compliance score based on GPS, signatures, authorizations and exception rate.';
comment on table public.attendance_compliance_checks is 'Admin readiness checks for legal attendance and child pickup compliance.';
