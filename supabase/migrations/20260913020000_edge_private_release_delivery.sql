begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('observer-edge-releases', 'observer-edge-releases', false, 268435456,
  array['application/gzip', 'application/x-gzip', 'application/octet-stream'])
on conflict (id) do update set public = false;

-- Other storage policies must never make release objects client-readable or writable.
create policy observer_edge_releases_private_objects
on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'observer-edge-releases')
with check (bucket_id <> 'observer-edge-releases');

create table if not exists public.observer_edge_release_download_authorizations (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.video_gateway_device_enrollments(id),
  release_id uuid not null references public.observer_edge_releases(id),
  outcome text not null check (outcome in ('ISSUED','DENIED','RATE_LIMITED')),
  artifact_size bigint not null check (artifact_size > 0),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists observer_edge_download_auth_device_time_idx
  on public.observer_edge_release_download_authorizations(enrollment_id, created_at desc);
alter table public.observer_edge_release_download_authorizations enable row level security;
revoke all on public.observer_edge_release_download_authorizations from anon, authenticated;
grant select, insert on public.observer_edge_release_download_authorizations to service_role;

commit;
