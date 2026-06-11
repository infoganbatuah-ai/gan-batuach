create table if not exists public.ai_assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  session_title text not null default 'עוזר גן בטוח',
  context_scope jsonb not null default '{}'::jsonb,
  permission_mode text not null default 'role_scoped',
  provider_mode text not null default 'rules_based',
  status text not null default 'open',
  started_at timestamptz not null default now(),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_assistant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_assistant_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  prompt text not null,
  response text not null,
  suggested_actions jsonb not null default '[]'::jsonb,
  context_sources text[] not null default '{}',
  permission_summary text not null,
  response_quality text not null default 'not_reviewed',
  unresolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_assistant_usage_analytics (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  question_key text not null,
  usage_count integer not null default 0,
  unresolved_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(role, question_key)
);

alter table public.ai_assistant_sessions drop constraint if exists ai_assistant_sessions_role_check;
alter table public.ai_assistant_sessions add constraint ai_assistant_sessions_role_check check (role in ('admin','owner','manager','parent','staff','inspector'));

alter table public.ai_assistant_sessions drop constraint if exists ai_assistant_sessions_permission_mode_check;
alter table public.ai_assistant_sessions add constraint ai_assistant_sessions_permission_mode_check check (permission_mode in ('role_scoped','admin_global','garden_scoped','parent_child_scoped','staff_scoped','inspector_assignment_scoped'));

alter table public.ai_assistant_sessions drop constraint if exists ai_assistant_sessions_provider_mode_check;
alter table public.ai_assistant_sessions add constraint ai_assistant_sessions_provider_mode_check check (provider_mode in ('rules_based','external_ai_ready','external_ai_active'));

alter table public.ai_assistant_sessions drop constraint if exists ai_assistant_sessions_status_check;
alter table public.ai_assistant_sessions add constraint ai_assistant_sessions_status_check check (status in ('open','closed','archived'));

alter table public.ai_assistant_messages drop constraint if exists ai_assistant_messages_quality_check;
alter table public.ai_assistant_messages add constraint ai_assistant_messages_quality_check check (response_quality in ('not_reviewed','helpful','needs_follow_up','incorrect','unsafe_blocked'));

create index if not exists ai_assistant_sessions_profile_idx on public.ai_assistant_sessions(profile_id, updated_at desc);
create index if not exists ai_assistant_messages_session_idx on public.ai_assistant_messages(session_id, created_at desc);
create index if not exists ai_assistant_messages_profile_idx on public.ai_assistant_messages(profile_id, created_at desc);
create index if not exists ai_assistant_usage_role_idx on public.ai_assistant_usage_analytics(role, usage_count desc);

alter table public.ai_assistant_sessions enable row level security;
alter table public.ai_assistant_messages enable row level security;
alter table public.ai_assistant_usage_analytics enable row level security;

drop policy if exists "ai assistant sessions own read" on public.ai_assistant_sessions;
create policy "ai assistant sessions own read" on public.ai_assistant_sessions
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "ai assistant sessions own insert" on public.ai_assistant_sessions;
create policy "ai assistant sessions own insert" on public.ai_assistant_sessions
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "ai assistant sessions own update" on public.ai_assistant_sessions;
create policy "ai assistant sessions own update" on public.ai_assistant_sessions
  for update using (profile_id = auth.uid() or public.is_admin()) with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "ai assistant messages own read" on public.ai_assistant_messages;
create policy "ai assistant messages own read" on public.ai_assistant_messages
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "ai assistant messages own insert" on public.ai_assistant_messages;
create policy "ai assistant messages own insert" on public.ai_assistant_messages
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "ai assistant usage admin read" on public.ai_assistant_usage_analytics;
create policy "ai assistant usage admin read" on public.ai_assistant_usage_analytics
  for select using (public.is_admin());

drop policy if exists "ai assistant usage scoped write" on public.ai_assistant_usage_analytics;
create policy "ai assistant usage scoped write" on public.ai_assistant_usage_analytics
  for all using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role::text = ai_assistant_usage_analytics.role
    )
  ) with check (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role::text = ai_assistant_usage_analytics.role
    )
  );

comment on table public.ai_assistant_sessions is 'Role-scoped AI assistant sessions. Context is limited by user permissions.';
comment on table public.ai_assistant_messages is 'Auditable AI assistant prompts and deterministic responses. No automatic actions are executed.';
comment on table public.ai_assistant_usage_analytics is 'Aggregated assistant usage and unresolved request tracking by role.';
