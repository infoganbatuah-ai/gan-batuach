-- PHASE 129: Parent Experience, Notifications & Child Daily Journey.
-- Extends existing communication and push preference models. No raw AI events are exposed to parents.

alter table if exists public.communication_preferences
  add column if not exists parent_category_channels jsonb not null default '{
    "important": ["push", "email"],
    "safety": ["push", "email", "whatsapp"],
    "attendance": ["push"],
    "message": ["push", "whatsapp"],
    "document": ["push", "email"],
    "payment": ["push", "email"],
    "pickup": ["push"]
  }'::jsonb,
  add column if not exists parent_quiet_hours jsonb not null default '{"enabled": false, "from": "21:00", "to": "07:00"}'::jsonb,
  add column if not exists parent_daily_digest_enabled boolean not null default true,
  add column if not exists parent_ai_summary_enabled boolean not null default true;

do $$
begin
  if to_regclass('public.push_category_preferences') is not null then
    alter table public.push_category_preferences
      drop constraint if exists push_category_preferences_category_check;

    alter table public.push_category_preferences
      add constraint push_category_preferences_category_check check (category in (
        'registration',
        'parent_approval',
        'child_approval',
        'payment_reminder',
        'safety_alert',
        'observer_alert',
        'inspection_alert',
        'camera_alert',
        'system_notification',
        'important',
        'safety',
        'attendance',
        'message',
        'document',
        'payment',
        'pickup'
      ));
  end if;
end $$;

create table if not exists public.parent_daily_journey_preferences (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  show_meals boolean not null default true,
  show_sleep boolean not null default true,
  show_photos boolean not null default true,
  show_pickup boolean not null default true,
  show_reviewed_safety boolean not null default true,
  daily_digest_time text not null default '17:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_profile_id),
  constraint parent_daily_digest_time_format_check check (daily_digest_time ~ '^[0-2][0-9]:[0-5][0-9]$')
);

create index if not exists parent_daily_journey_preferences_parent_idx
  on public.parent_daily_journey_preferences(parent_profile_id);

alter table public.parent_daily_journey_preferences enable row level security;

drop policy if exists "parent daily journey preferences own read" on public.parent_daily_journey_preferences;
create policy "parent daily journey preferences own read" on public.parent_daily_journey_preferences
for select using (public.is_admin() or parent_profile_id = auth.uid());

drop policy if exists "parent daily journey preferences own write" on public.parent_daily_journey_preferences;
create policy "parent daily journey preferences own write" on public.parent_daily_journey_preferences
for all using (public.is_admin() or parent_profile_id = auth.uid())
with check (public.is_admin() or parent_profile_id = auth.uid());

comment on column public.communication_preferences.parent_category_channels is 'Parent-selected delivery channels per category: important, safety, attendance, message, document, payment and pickup.';
comment on table public.parent_daily_journey_preferences is 'Parent-facing daily journey display preferences. Only approved parent-visible child data may be shown.';
