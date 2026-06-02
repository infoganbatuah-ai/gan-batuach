create table if not exists public.authorized_pickup_contacts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  full_name text not null,
  relation text not null,
  phone text,
  identity_number text,
  photo_required boolean not null default false,
  face_reference_image text,
  face_reference_id text,
  active boolean not null default true,
  authorization_type text not null default 'permanent',
  valid_from timestamptz,
  valid_until timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authorized_pickup_contacts_relation_check check (relation in ('parent','second_parent','grandparent','sibling','nanny','emergency_contact','temporary','other')),
  constraint authorized_pickup_contacts_type_check check (authorization_type in ('permanent','temporary','emergency'))
);

create table if not exists public.child_pickup_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  pickup_contact_id uuid references public.authorized_pickup_contacts(id) on delete set null,
  pickup_person text not null,
  authorization_type text not null default 'manual_review',
  pickup_time timestamptz not null default now(),
  status text not null default 'recorded',
  verified_by uuid references public.profiles(id) on delete set null,
  notes text,
  camera_event_id uuid references public.ai_camera_events(id) on delete set null,
  unusual_reason text,
  parent_confirmation_requested boolean not null default false,
  parent_confirmation_status text not null default 'not_requested',
  face_reference_id text,
  face_match_score numeric,
  face_match_provider text,
  face_match_status text not null default 'not_run',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_pickup_events_status_check check (status in ('recorded','verified_by_staff','unusual','parent_confirmation_requested','cancelled')),
  constraint child_pickup_events_auth_type_check check (authorization_type in ('permanent','temporary','emergency','manual_review','unauthorized')),
  constraint child_pickup_events_parent_confirmation_check check (parent_confirmation_status in ('not_requested','pending','confirmed','rejected')),
  constraint child_pickup_events_face_status_check check (face_match_status in ('not_run','future_ready','matched','not_matched','needs_review'))
);

create index if not exists idx_authorized_pickup_contacts_child on public.authorized_pickup_contacts(child_id, active);
create index if not exists idx_authorized_pickup_contacts_kindergarten on public.authorized_pickup_contacts(kindergarten_id, active);
create index if not exists idx_authorized_pickup_contacts_validity on public.authorized_pickup_contacts(valid_from, valid_until);
create index if not exists idx_child_pickup_events_child_time on public.child_pickup_events(child_id, pickup_time desc);
create index if not exists idx_child_pickup_events_kindergarten_time on public.child_pickup_events(kindergarten_id, pickup_time desc);
create index if not exists idx_child_pickup_events_status on public.child_pickup_events(status, pickup_time desc);

alter table public.authorized_pickup_contacts enable row level security;
alter table public.child_pickup_events enable row level security;

drop policy if exists "authorized pickup admin access" on public.authorized_pickup_contacts;
drop policy if exists "authorized pickup parent read" on public.authorized_pickup_contacts;
drop policy if exists "authorized pickup parent write" on public.authorized_pickup_contacts;
drop policy if exists "authorized pickup garden read" on public.authorized_pickup_contacts;
drop policy if exists "authorized pickup garden update" on public.authorized_pickup_contacts;

create policy "authorized pickup admin access" on public.authorized_pickup_contacts
  for all using (public.is_admin())
  with check (public.is_admin());

create policy "authorized pickup parent read" on public.authorized_pickup_contacts
  for select using (
    exists (
      select 1
      from public.children c
      left join public.parents p on p.id = c.primary_parent_id
      where c.id = child_id
        and (p.profile_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy "authorized pickup parent write" on public.authorized_pickup_contacts
  for insert with check (
    exists (
      select 1
      from public.children c
      left join public.parents p on p.id = c.primary_parent_id
      where c.id = child_id
        and (p.profile_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy "authorized pickup parent update" on public.authorized_pickup_contacts
  for update using (
    exists (
      select 1
      from public.children c
      left join public.parents p on p.id = c.primary_parent_id
      where c.id = child_id
        and (p.profile_id = auth.uid() or p.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.children c
      left join public.parents p on p.id = c.primary_parent_id
      where c.id = child_id
        and (p.profile_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy "authorized pickup garden read" on public.authorized_pickup_contacts
  for select using (public.can_access_garden(kindergarten_id));

create policy "authorized pickup garden update" on public.authorized_pickup_contacts
  for update using (public.can_access_garden(kindergarten_id))
  with check (public.can_access_garden(kindergarten_id));

drop policy if exists "child pickup events admin access" on public.child_pickup_events;
drop policy if exists "child pickup events parent read" on public.child_pickup_events;
drop policy if exists "child pickup events garden read" on public.child_pickup_events;
drop policy if exists "child pickup events garden insert" on public.child_pickup_events;
drop policy if exists "child pickup events garden update" on public.child_pickup_events;

create policy "child pickup events admin access" on public.child_pickup_events
  for all using (public.is_admin())
  with check (public.is_admin());

create policy "child pickup events parent read" on public.child_pickup_events
  for select using (
    exists (
      select 1
      from public.children c
      left join public.parents p on p.id = c.primary_parent_id
      where c.id = child_id
        and (p.profile_id = auth.uid() or p.user_id = auth.uid())
    )
  );

create policy "child pickup events garden read" on public.child_pickup_events
  for select using (public.can_access_garden(kindergarten_id));

create policy "child pickup events garden insert" on public.child_pickup_events
  for insert with check (public.can_access_garden(kindergarten_id));

create policy "child pickup events garden update" on public.child_pickup_events
  for update using (public.can_access_garden(kindergarten_id))
  with check (public.can_access_garden(kindergarten_id));

insert into public.authorized_pickup_contacts (
  child_id,
  kindergarten_id,
  full_name,
  relation,
  phone,
  identity_number,
  face_reference_image,
  active,
  authorization_type,
  notes,
  metadata
)
select
  c.id,
  c.garden_id,
  coalesce(nullif(contact->>'name', ''), nullif(contact->>'full_name', ''), 'מורשה איסוף'),
  case
    when contact->>'relation' in ('parent','second_parent','grandparent','sibling','nanny','emergency_contact','temporary','other') then contact->>'relation'
    else 'other'
  end,
  nullif(contact->>'phone', ''),
  nullif(contact->>'identity_number', ''),
  nullif(contact->>'photo_url', ''),
  true,
  'permanent',
  'נוצר מנתוני pickup_authorized קיימים',
  jsonb_build_object('migrated_from_child_json', true)
from public.children c
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(coalesce(c.pickup_authorized, '[]'::jsonb)) = 'array' then coalesce(c.pickup_authorized, '[]'::jsonb)
    else '[]'::jsonb
  end
) as contact
where jsonb_typeof(coalesce(c.pickup_authorized, '[]'::jsonb)) = 'array'
  and not exists (
    select 1
    from public.authorized_pickup_contacts existing
    where existing.child_id = c.id
      and existing.full_name = coalesce(nullif(contact->>'name', ''), nullif(contact->>'full_name', ''), 'מורשה איסוף')
      and coalesce(existing.phone, '') = coalesce(nullif(contact->>'phone', ''), '')
  );

comment on table public.authorized_pickup_contacts is 'Authorized pickup contacts and temporary pickup windows. Human review remains required for child release.';
comment on table public.child_pickup_events is 'Pickup event audit trail. Face verification fields are future-ready only and no automatic release is allowed.';
