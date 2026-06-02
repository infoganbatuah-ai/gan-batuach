alter table public.ai_camera_events
  add column if not exists shadow_mode boolean not null default true,
  add column if not exists requires_human_review boolean not null default true,
  add column if not exists review_outcome text,
  add column if not exists recommended_action text,
  add column if not exists detector_provider text not null default 'local_mock',
  add column if not exists detector_mode text not null default 'shadow',
  add column if not exists false_positive_reason text;

alter table public.ai_camera_events
  drop constraint if exists ai_camera_events_type_check;

alter table public.ai_camera_events
  add constraint ai_camera_events_type_check check (event_type in (
    'person_detected',
    'unauthorized_person',
    'child_missing_from_area',
    'restricted_area_entry',
    'fall_suspected',
    'crowding_suspected',
    'gate_or_door_open',
    'pickup_mismatch',
    'staff_behavior_concern',
    'distress_suspected',
    'violence_indicator',
    'audio_anomaly',
    'keyword_detected',
    'camera_tampering',
    'camera_offline',
    'camera_frozen_suspected',
    'motion_detected',
    'no_motion_too_long',
    'multiple_persons_detected',
    'restricted_area_occupancy',
    'camera_obstruction_suspected'
  ));

alter table public.ai_camera_events
  drop constraint if exists ai_camera_events_review_outcome_check;

alter table public.ai_camera_events
  add constraint ai_camera_events_review_outcome_check check (
    review_outcome is null
    or review_outcome in ('false_positive', 'valid_detection', 'needs_more_data')
  );

alter table public.ai_camera_events
  drop constraint if exists ai_camera_events_detector_mode_check;

alter table public.ai_camera_events
  add constraint ai_camera_events_detector_mode_check check (detector_mode in ('mock', 'local_shadow', 'shadow', 'future_real'));

create index if not exists idx_ai_camera_events_shadow_review
  on public.ai_camera_events(shadow_mode, review_outcome, created_at desc);

update public.ai_camera_events
set
  shadow_mode = coalesce(shadow_mode, true),
  requires_human_review = coalesce(requires_human_review, true),
  parent_visible = false
where metadata->>'worker_mode' = 'mock'
   or metadata->>'source' = 'mock_admin'
   or detector_provider = 'local_mock';

comment on column public.ai_camera_events.shadow_mode is 'True for local pilot detections. Shadow events are review-only and never parent-visible by default.';
comment on column public.ai_camera_events.review_outcome is 'Human review outcome for false-positive learning: false_positive, valid_detection or needs_more_data.';

notify pgrst, 'reload schema';
