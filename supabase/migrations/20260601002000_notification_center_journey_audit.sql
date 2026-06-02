-- Unified notification center fields and routing support.

alter table public.notifications
  add column if not exists recipient_profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists kindergarten_id uuid references public.gardens(id) on delete cascade,
  add column if not exists child_id uuid references public.children(id) on delete set null,
  add column if not exists message text,
  add column if not exists action_url text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_batch_id text;

update public.notifications
set
  recipient_profile_id = coalesce(recipient_profile_id, recipient_id),
  kindergarten_id = coalesce(kindergarten_id, garden_id),
  message = coalesce(message, body),
  action_url = coalesce(action_url, metadata->>'href')
where recipient_profile_id is null
   or kindergarten_id is null
   or message is null
   or action_url is null;

create index if not exists idx_notifications_recipient_profile_status
  on public.notifications(recipient_profile_id, status, created_at desc);

create index if not exists idx_notifications_action_url
  on public.notifications(action_url)
  where action_url is not null;

notify pgrst, 'reload schema';
