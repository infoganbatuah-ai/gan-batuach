-- Camera-derived identity candidates for Digital Observer.
-- Raw face crops and cluster references remain server-only. The browser receives
-- only review metadata and an opaque candidate id.

create table if not exists public.digital_observer_identity_candidates (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  assigned_known_person_id uuid references public.digital_observer_known_people(id) on delete set null,
  candidate_status text not null default 'observing',
  suggested_label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  observation_count integer not null default 1,
  average_confidence numeric(5,4),
  preview_available boolean not null default false,
  sample_storage_bucket text,
  sample_storage_path text,
  cluster_reference text,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_identity_candidate_status_check check (
    candidate_status in ('observing','ready_for_review','known','unknown','dismissed','blocked')
  ),
  constraint digital_observer_identity_candidate_count_check check (observation_count > 0),
  constraint digital_observer_identity_candidate_confidence_check check (
    average_confidence is null or average_confidence between 0 and 1
  ),
  constraint digital_observer_identity_candidate_preview_guard check (
    preview_available = false
    or (sample_storage_bucket is not null and sample_storage_path is not null)
  )
);

create index if not exists digital_observer_identity_candidates_site_idx
  on public.digital_observer_identity_candidates(observer_site_id, candidate_status, last_seen_at desc);

alter table public.digital_observer_identity_candidates enable row level security;

drop policy if exists "digital observer identity candidates scoped read" on public.digital_observer_identity_candidates;
create policy "digital observer identity candidates scoped read"
on public.digital_observer_identity_candidates
for select using (public.can_manage_observer_site(observer_site_id));

revoke all on table public.digital_observer_identity_candidates from anon, authenticated;
grant select (
  id, observer_site_id, camera_source_id, assigned_known_person_id, candidate_status,
  suggested_label, first_seen_at, last_seen_at, observation_count, average_confidence,
  preview_available, metadata, reviewed_by, reviewed_at, created_at, updated_at
) on table public.digital_observer_identity_candidates to authenticated;

create or replace function public.review_digital_observer_identity_candidate(
  requested_candidate_id uuid,
  requested_outcome text,
  requested_display_name text default null,
  requested_relationship_label text default null,
  requested_explicit_consent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  candidate_row public.digital_observer_identity_candidates;
  site_row public.observer_sites;
  person_id uuid;
  normalized_outcome text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  normalized_outcome := lower(trim(coalesce(requested_outcome, '')));
  if normalized_outcome not in ('known','unknown','dismissed') then
    raise exception 'INVALID_IDENTITY_REVIEW_OUTCOME';
  end if;

  select * into candidate_row
  from public.digital_observer_identity_candidates
  where id = requested_candidate_id
  for update;

  if candidate_row.id is null then
    raise exception 'IDENTITY_CANDIDATE_NOT_FOUND';
  end if;

  if not public.can_manage_observer_site(candidate_row.observer_site_id) then
    raise exception 'OBSERVER_SITE_ACCESS_DENIED';
  end if;

  select * into site_row
  from public.observer_sites
  where id = candidate_row.observer_site_id;

  if site_row.business_handles_children = true or site_row.vision_privacy_mode = 'skeleton_only' then
    update public.digital_observer_identity_candidates
    set candidate_status = 'blocked', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = candidate_row.id;
    raise exception 'BIOMETRIC_REVIEW_BLOCKED_FOR_CHILD_FOCUSED_SITE';
  end if;

  if normalized_outcome = 'known' then
    if length(trim(coalesce(requested_display_name, ''))) < 2 then
      raise exception 'KNOWN_PERSON_NAME_REQUIRED';
    end if;
    if requested_explicit_consent is not true then
      raise exception 'EXPLICIT_CONSENT_REQUIRED';
    end if;

    insert into public.digital_observer_known_people (
      observer_site_id,
      display_name,
      relationship_label,
      consent_status,
      recognition_status,
      camera_scope,
      notify_on_detection,
      confidence_threshold,
      last_confirmed_at,
      metadata,
      created_by
    ) values (
      candidate_row.observer_site_id,
      trim(requested_display_name),
      nullif(trim(coalesce(requested_relationship_label, '')), ''),
      'approved',
      'readiness',
      case when candidate_row.camera_source_id is null
        then '[]'::jsonb
        else jsonb_build_array(candidate_row.camera_source_id)
      end,
      true,
      greatest(0.5, least(0.99, coalesce(candidate_row.average_confidence, 0.8))),
      now(),
      jsonb_build_object(
        'source', 'camera_identity_candidate',
        'candidate_id', candidate_row.id,
        'biometric_processing_active', false,
        'explicit_consent_recorded', true,
        'requires_provider_activation', true
      ),
      auth.uid()
    ) returning id into person_id;
  end if;

  update public.digital_observer_identity_candidates
  set
    candidate_status = normalized_outcome,
    assigned_known_person_id = person_id,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'review_outcome', normalized_outcome,
      'reviewed_in_product', true,
      'does_not_enable_live_biometrics', true
    )
  where id = candidate_row.id;

  return jsonb_build_object(
    'candidate_id', candidate_row.id,
    'outcome', normalized_outcome,
    'known_person_id', person_id,
    'live_biometrics_enabled', false
  );
end;
$$;

revoke all on function public.review_digital_observer_identity_candidate(uuid, text, text, text, boolean) from public;
grant execute on function public.review_digital_observer_identity_candidate(uuid, text, text, text, boolean) to authenticated;

comment on table public.digital_observer_identity_candidates is
  'Server-ingested frequent-person candidates. Raw crops and cluster references are never granted to browser roles.';
comment on function public.review_digital_observer_identity_candidate(uuid, text, text, text, boolean) is
  'Reviews a site-scoped candidate. Known-person creation requires explicit consent and remains readiness-only.';

notify pgrst, 'reload schema';
