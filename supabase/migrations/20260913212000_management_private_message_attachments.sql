-- GB-M29: private, message-linked files. Storage never grants direct client access.
-- Files follow the existing communications retention policy; deletion requires
-- the policy's manual/legal review, so this migration starts no cleanup job.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('management-message-attachments', 'management-message-attachments', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.management_message_attachments (
  id uuid primary key,
  garden_id uuid not null references public.gardens(id),
  thread_id uuid not null references public.communication_threads(id),
  message_id uuid not null unique references public.messages(id),
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);
create index if not exists management_message_attachments_thread_idx
  on public.management_message_attachments(thread_id, message_id, created_at);

create or replace function public.validate_management_message_attachment()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.messages m
    join public.communication_threads t on t.id=m.thread_id
    where m.id=new.message_id and m.thread_id=new.thread_id
      and m.garden_id=new.garden_id and t.garden_id=new.garden_id
      and m.sender_id=new.uploaded_by and m.deleted_at is null
  ) or new.storage_path <> new.garden_id::text || '/' || new.thread_id::text || '/' || new.message_id::text || '/' || new.id::text then
    raise exception 'message_attachment_scope_invalid' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists management_message_attachment_scope on public.management_message_attachments;
create trigger management_message_attachment_scope before insert or update on public.management_message_attachments
for each row execute function public.validate_management_message_attachment();

alter table public.management_message_attachments enable row level security;
drop policy if exists "management message attachment participant read" on public.management_message_attachments;
create policy "management message attachment participant read" on public.management_message_attachments
for select to authenticated using (public.can_access_management_communication_thread(thread_id));
revoke all on public.management_message_attachments from public, anon, authenticated;
grant select on public.management_message_attachments to authenticated;

-- Restrictive policy intersects every existing permissive Storage policy.
-- The service role may write/read only after the Management API checks scope.
drop policy if exists "management message attachments server only" on storage.objects;
create policy "management message attachments server only" on storage.objects as restrictive
for all to public using (bucket_id <> 'management-message-attachments')
with check (bucket_id <> 'management-message-attachments');

comment on table public.management_message_attachments is
  'GB-M29 private file metadata: one message, one thread, one Garden. Storage paths are never client-authoritative.';
