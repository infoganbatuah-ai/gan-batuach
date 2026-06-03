create table if not exists public.face_reference_images (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.parents(id) on delete set null,
  authorized_pickup_contact_id uuid references public.authorized_pickup_contacts(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  subject_type text not null,
  subject_name text,
  image_path text not null,
  image_url text,
  provider_reference_id text,
  consent_status text not null default 'pending',
  active boolean not null default true,
  captured_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint face_reference_images_subject_type_check check (subject_type in ('parent','authorized_pickup_person','temporary_pickup_person','staff')),
  constraint face_reference_images_consent_check check (consent_status in ('pending','granted','revoked','expired'))
);

create table if not exists public.face_match_results (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  camera_event_id uuid references public.ai_camera_events(id) on delete set null,
  pickup_event_id uuid references public.child_pickup_events(id) on delete set null,
  reference_image_id uuid references public.face_reference_images(id) on delete set null,
  authorized_pickup_contact_id uuid references public.authorized_pickup_contacts(id) on delete set null,
  detected_person_label text,
  match_score numeric(5,4),
  provider text not null default 'mock',
  confidence numeric(5,4),
  review_status text not null default 'pending_review',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint face_match_results_score_check check (match_score is null or (match_score >= 0 and match_score <= 1)),
  constraint face_match_results_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint face_match_results_review_status_check check (review_status in ('pending_review','possible_match','approved_by_manager','rejected_by_manager','inconclusive','cancelled'))
);

alter table public.authorized_pickup_contacts
  add column if not exists temporary_date date,
  add column if not exists valid_hours jsonb not null default '{}'::jsonb,
  add column if not exists face_reference_image_path text,
  add column if not exists face_reference_consent_status text not null default 'pending';

alter table public.child_pickup_events
  add column if not exists face_match_result_id uuid references public.face_match_results(id) on delete set null,
  add column if not exists manager_face_review_required boolean not null default false;

create index if not exists face_reference_images_kindergarten_idx on public.face_reference_images(kindergarten_id, subject_type, active);
create index if not exists face_reference_images_pickup_contact_idx on public.face_reference_images(authorized_pickup_contact_id, active);
create index if not exists face_reference_images_profile_idx on public.face_reference_images(profile_id, active);
create index if not exists face_match_results_kindergarten_status_idx on public.face_match_results(kindergarten_id, review_status, created_at desc);
create index if not exists face_match_results_pickup_event_idx on public.face_match_results(pickup_event_id, created_at desc);
create index if not exists face_match_results_camera_event_idx on public.face_match_results(camera_event_id, created_at desc);

alter table public.face_reference_images enable row level security;
alter table public.face_match_results enable row level security;

drop policy if exists "face reference admin all" on public.face_reference_images;
create policy "face reference admin all" on public.face_reference_images
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "face reference garden read" on public.face_reference_images;
create policy "face reference garden read" on public.face_reference_images
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "face reference garden write" on public.face_reference_images;
create policy "face reference garden write" on public.face_reference_images
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "face match results admin all" on public.face_match_results;
create policy "face match results admin all" on public.face_match_results
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "face match results garden read" on public.face_match_results;
create policy "face match results garden read" on public.face_match_results
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "face match results garden write" on public.face_match_results;
create policy "face match results garden write" on public.face_match_results
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

insert into public.face_reference_images (
  kindergarten_id,
  child_id,
  authorized_pickup_contact_id,
  subject_type,
  subject_name,
  image_path,
  image_url,
  consent_status,
  active,
  metadata
)
select
  contact.kindergarten_id,
  contact.child_id,
  contact.id,
  case when contact.authorization_type = 'temporary' then 'temporary_pickup_person' else 'authorized_pickup_person' end,
  contact.full_name,
  contact.face_reference_image,
  contact.face_reference_image,
  'pending',
  contact.active,
  jsonb_build_object('source', 'authorized_pickup_contacts_backfill', 'human_review_required', true)
from public.authorized_pickup_contacts contact
where contact.face_reference_image is not null
  and btrim(contact.face_reference_image) <> ''
  and not exists (
    select 1
    from public.face_reference_images ref
    where ref.authorized_pickup_contact_id = contact.id
      and ref.image_path = contact.face_reference_image
  );

comment on table public.face_reference_images is 'Secure face reference image metadata for future pickup verification. No public access and no automatic biometric decisions.';
comment on table public.face_match_results is 'Mock/future face matching results. Human manager review is required before pickup decisions.';
comment on column public.face_match_results.match_score is 'Provider score for review context only. It must not approve child release automatically.';

notify pgrst, 'reload schema';
