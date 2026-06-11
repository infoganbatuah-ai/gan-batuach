-- PHASE 126: Unified communications and messaging network.
-- Additive layer over existing messages, notifications and delivery logs.

create table if not exists public.communication_threads (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  complaint_id uuid references public.complaints(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  thread_type text not null default 'general',
  subject text not null,
  priority text not null default 'informational',
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  last_message_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_thread_type_check check (thread_type in (
    'parent_kindergarten',
    'parent_manager',
    'staff_manager',
    'inspector_kindergarten',
    'admin_user',
    'complaint',
    'inspection',
    'document_request',
    'emergency',
    'general'
  )),
  constraint communication_thread_priority_check check (priority in ('informational','important','urgent','critical')),
  constraint communication_thread_status_check check (status in ('open','pending_response','waiting_review','resolved','closed','archived'))
);

create table if not exists public.communication_thread_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.communication_threads(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  role public.app_role,
  participant_label text,
  notification_channels jsonb not null default '["in_app"]'::jsonb,
  muted boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (thread_id, profile_id)
);

create table if not exists public.communication_delivery_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.communication_threads(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  notification_id uuid references public.notifications(id) on delete set null,
  channel text not null,
  provider text,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_preview text,
  template_key text,
  priority text not null default 'informational',
  status text not null default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint communication_delivery_channel_check check (channel in ('in_app','email','sms','whatsapp','push')),
  constraint communication_delivery_priority_check check (priority in ('informational','important','urgent','critical'))
);

alter table public.messages
  add column if not exists thread_id uuid references public.communication_threads(id) on delete set null,
  add column if not exists priority text not null default 'informational',
  add column if not exists delivery_channels jsonb not null default '["in_app"]'::jsonb,
  add column if not exists attachment_urls text[] not null default '{}',
  add column if not exists response_required boolean not null default false;

create index if not exists communication_threads_garden_status_idx on public.communication_threads(garden_id, status, last_message_at desc);
create index if not exists communication_threads_type_priority_idx on public.communication_threads(thread_type, priority, status);
create index if not exists communication_thread_participants_profile_idx on public.communication_thread_participants(profile_id, thread_id);
create index if not exists communication_delivery_events_thread_idx on public.communication_delivery_events(thread_id, channel, status, created_at desc);
create index if not exists communication_delivery_events_message_idx on public.communication_delivery_events(message_id, channel, status);
create index if not exists messages_thread_idx on public.messages(thread_id, created_at desc);

alter table public.communication_threads enable row level security;
alter table public.communication_thread_participants enable row level security;
alter table public.communication_delivery_events enable row level security;

drop policy if exists "communication threads scoped read" on public.communication_threads;
create policy "communication threads scoped read" on public.communication_threads
for select using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1 from public.communication_thread_participants p
    where p.thread_id = communication_threads.id
      and p.profile_id = auth.uid()
  )
);

drop policy if exists "communication threads scoped write" on public.communication_threads;
create policy "communication threads scoped write" on public.communication_threads
for all using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or created_by = auth.uid()
  or assigned_to = auth.uid()
) with check (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or created_by = auth.uid()
  or assigned_to = auth.uid()
);

drop policy if exists "communication participants scoped read" on public.communication_thread_participants;
create policy "communication participants scoped read" on public.communication_thread_participants
for select using (
  public.is_admin()
  or profile_id = auth.uid()
  or exists (
    select 1 from public.communication_threads t
    where t.id = thread_id
      and (public.can_access_garden(t.garden_id) or t.created_by = auth.uid() or t.assigned_to = auth.uid())
  )
);

drop policy if exists "communication participants scoped write" on public.communication_thread_participants;
create policy "communication participants scoped write" on public.communication_thread_participants
for all using (
  public.is_admin()
  or exists (
    select 1 from public.communication_threads t
    where t.id = thread_id
      and (public.can_access_garden(t.garden_id) or t.created_by = auth.uid() or t.assigned_to = auth.uid())
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.communication_threads t
    where t.id = thread_id
      and (public.can_access_garden(t.garden_id) or t.created_by = auth.uid() or t.assigned_to = auth.uid())
  )
);

drop policy if exists "communication delivery scoped read" on public.communication_delivery_events;
create policy "communication delivery scoped read" on public.communication_delivery_events
for select using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or exists (
    select 1 from public.communication_threads t
    where t.id = thread_id
      and (public.can_access_garden(t.garden_id) or t.created_by = auth.uid() or t.assigned_to = auth.uid())
  )
);

drop policy if exists "communication delivery admin scoped write" on public.communication_delivery_events;
create policy "communication delivery admin scoped write" on public.communication_delivery_events
for all using (
  public.is_admin()
  or exists (
    select 1 from public.communication_threads t
    where t.id = thread_id
      and (public.can_access_garden(t.garden_id) or t.created_by = auth.uid() or t.assigned_to = auth.uid())
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.communication_threads t
    where t.id = thread_id
      and (public.can_access_garden(t.garden_id) or t.created_by = auth.uid() or t.assigned_to = auth.uid())
  )
);

insert into public.communication_threads (garden_id, child_id, thread_type, subject, priority, status, created_by, assigned_to, last_message_at, metadata, created_at)
select
  m.garden_id,
  m.linked_child_id,
  case
    when m.linked_child_id is not null then 'parent_kindergarten'
    else 'general'
  end,
  coalesce(nullif(m.subject, ''), 'שיחה'),
  coalesce(nullif(m.priority, ''), 'informational'),
  case when max(m.read_at) is null then 'pending_response' else 'open' end,
  m.sender_id,
  m.recipient_id,
  max(coalesce(m.sent_at, m.created_at)),
  jsonb_build_object('source', 'messages_backfill', 'message_count', count(*)),
  min(m.created_at)
from public.messages m
where m.thread_id is null
group by m.garden_id, m.linked_child_id, m.sender_id, m.recipient_id, m.subject, m.priority
on conflict do nothing;

update public.messages m
set thread_id = t.id
from public.communication_threads t
where m.thread_id is null
  and t.garden_id is not distinct from m.garden_id
  and t.child_id is not distinct from m.linked_child_id
  and t.created_by is not distinct from m.sender_id
  and t.assigned_to is not distinct from m.recipient_id;

comment on table public.communication_threads is 'Unified conversation layer for parent, staff, manager, inspector and admin communication.';
comment on table public.communication_delivery_events is 'Unified multi-channel delivery history. Do not store secrets or full temporary passwords here.';

notify pgrst, 'reload schema';
