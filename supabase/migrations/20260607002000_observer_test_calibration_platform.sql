-- PHASE 100-6: Observer test mode and calibration platform.
-- Shadow-mode only. No autonomous decisions, accusations or disciplinary actions.

alter table public.ai_camera_events
  add column if not exists observer_shadow_mode boolean not null default true,
  add column if not exists observer_recommendation text,
  add column if not exists ground_truth_outcome text,
  add column if not exists ground_truth_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists ground_truth_reviewed_at timestamptz;

create table if not exists public.observer_test_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope_type text not null default 'demo_environment',
  kindergarten_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  status text not null default 'draft',
  shadow_mode boolean not null default true,
  human_review_required boolean not null default true,
  test_started_at timestamptz,
  test_ended_at timestamptz,
  reviewed_events_count integer not null default 0,
  false_positive_rate numeric(5,4) not null default 0,
  false_negative_rate numeric(5,4) not null default 0,
  confidence_stability numeric(5,4) not null default 0,
  maturity_score integer not null default 0,
  readiness_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_test_sessions_scope_check check (scope_type in ('home_test','kindergarten_test','business_test','demo_environment')),
  constraint observer_test_sessions_status_check check (status in ('draft','running','reviewing','completed','archived')),
  constraint observer_test_sessions_scores_check check (maturity_score between 0 and 100 and readiness_score between 0 and 100)
);

create table if not exists public.observer_calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'demo_environment',
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  confidence_threshold numeric(5,4) not null default 0.70,
  sensitivity numeric(5,4) not null default 0.60,
  noise_tolerance numeric(5,4) not null default 0.50,
  motion_tolerance numeric(5,4) not null default 0.50,
  audio_sensitivity numeric(5,4) not null default 0.50,
  calibration_status text not null default 'not_started',
  learning_maturity text not null default 'early',
  readiness_score integer not null default 0,
  future_models jsonb not null default '["YOLO","OpenCV","TensorFlow","Gemini Vision","GPT Vision","custom models"]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_calibration_scope_check check (scope_type in ('home_test','kindergarten_test','business_test','demo_environment','production_kindergarten','observer_site')),
  constraint observer_calibration_status_check check (calibration_status in ('not_started','collecting','calibrating','review_ready','production_candidate','blocked')),
  constraint observer_calibration_maturity_check check (learning_maturity in ('early','learning','stable','ready','blocked')),
  constraint observer_calibration_score_check check (readiness_score between 0 and 100),
  constraint observer_calibration_values_check check (
    confidence_threshold between 0 and 1
    and sensitivity between 0 and 1
    and noise_tolerance between 0 and 1
    and motion_tolerance between 0 and 1
    and audio_sensitivity between 0 and 1
  )
);

create table if not exists public.observer_ground_truth_reviews (
  id uuid primary key default gen_random_uuid(),
  event_source text not null,
  event_id uuid,
  test_session_id uuid references public.observer_test_sessions(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  outcome text not null,
  observer_recommendation text,
  reviewer_note text,
  confidence_at_review numeric(5,4),
  updates_learning_profile boolean not null default true,
  no_action_taken boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_ground_truth_source_check check (event_source in ('ai_camera_event','audio_observer_event','observer_correlated_event')),
  constraint observer_ground_truth_outcome_check check (outcome in ('correct_detection','missed_detection','false_positive','false_negative','uncertain'))
);

create table if not exists public.observer_event_replay_logs (
  id uuid primary key default gen_random_uuid(),
  event_source text not null,
  event_id uuid,
  requested_by uuid references public.profiles(id) on delete set null,
  replay_status text not null default 'mock_ready',
  replay_payload jsonb not null default '{}'::jsonb,
  no_raw_media_exposed boolean not null default true,
  created_at timestamptz not null default now(),
  constraint observer_event_replay_source_check check (event_source in ('ai_camera_event','audio_observer_event','observer_correlated_event')),
  constraint observer_event_replay_status_check check (replay_status in ('mock_ready','queued','completed','failed','skipped'))
);

create index if not exists observer_test_sessions_scope_idx on public.observer_test_sessions(scope_type, status, created_at desc);
create index if not exists observer_calibration_scope_idx on public.observer_calibration_profiles(scope_type, calibration_status);
create index if not exists observer_ground_truth_event_idx on public.observer_ground_truth_reviews(event_source, event_id, created_at desc);
create index if not exists observer_ground_truth_outcome_idx on public.observer_ground_truth_reviews(outcome, created_at desc);
create index if not exists observer_event_replay_idx on public.observer_event_replay_logs(event_source, event_id, created_at desc);

alter table public.observer_test_sessions enable row level security;
alter table public.observer_calibration_profiles enable row level security;
alter table public.observer_ground_truth_reviews enable row level security;
alter table public.observer_event_replay_logs enable row level security;

drop policy if exists "observer test sessions admin only" on public.observer_test_sessions;
create policy "observer test sessions admin only" on public.observer_test_sessions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer calibration profiles admin only" on public.observer_calibration_profiles;
create policy "observer calibration profiles admin only" on public.observer_calibration_profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer ground truth reviews admin only" on public.observer_ground_truth_reviews;
create policy "observer ground truth reviews admin only" on public.observer_ground_truth_reviews for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer event replay logs admin only" on public.observer_event_replay_logs;
create policy "observer event replay logs admin only" on public.observer_event_replay_logs for all using (public.is_admin()) with check (public.is_admin());

insert into public.observer_test_sessions (name, scope_type, status, shadow_mode, human_review_required, metadata)
values
  ('Home camera shadow test', 'home_test', 'draft', true, true, '{"production_data":false}'::jsonb),
  ('Kindergarten sandbox test', 'kindergarten_test', 'draft', true, true, '{"production_data":false}'::jsonb),
  ('Business observer test', 'business_test', 'draft', true, true, '{"production_data":false}'::jsonb),
  ('Demo environment replay', 'demo_environment', 'draft', true, true, '{"production_data":false}'::jsonb)
on conflict do nothing;

insert into public.observer_calibration_profiles (scope_type, calibration_status, learning_maturity, metadata)
values
  ('home_test', 'collecting', 'early', '{"production_data":false}'::jsonb),
  ('kindergarten_test', 'collecting', 'early', '{"production_data":false}'::jsonb),
  ('business_test', 'collecting', 'early', '{"production_data":false}'::jsonb),
  ('demo_environment', 'collecting', 'early', '{"production_data":false}'::jsonb)
on conflict do nothing;

comment on table public.observer_test_sessions is 'Shadow-mode observer test sessions. No autonomous actions or accusations.';
comment on table public.observer_ground_truth_reviews is 'Human ground-truth review for correct, missed, false-positive, false-negative and uncertain outcomes.';
comment on table public.observer_calibration_profiles is 'Per-site calibration settings for confidence, sensitivity, noise, motion and audio tolerance.';
comment on table public.observer_event_replay_logs is 'Replay readiness log. No raw media is exposed by default.';

notify pgrst, 'reload schema';
