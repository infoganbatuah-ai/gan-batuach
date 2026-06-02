alter table public.ai_camera_events
  add column if not exists safety_category text,
  add column if not exists review_priority integer not null default 3,
  add column if not exists evidence_timeline jsonb not null default '[]'::jsonb,
  add column if not exists evidence_notes text,
  add column if not exists evidence_snapshot_paths jsonb not null default '[]'::jsonb,
  add column if not exists evidence_clip_paths jsonb not null default '[]'::jsonb,
  add column if not exists safety_score_impact integer not null default 0;

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
    'aggressive_behavior_indicator',
    'prolonged_crying_indicator',
    'child_left_alone_indicator',
    'staff_absence_indicator',
    'unusual_crowding',
    'emergency_behavior_indicator',
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
  drop constraint if exists ai_camera_events_safety_category_check;

alter table public.ai_camera_events
  add constraint ai_camera_events_safety_category_check check (
    safety_category is null
    or safety_category in ('distress', 'violence', 'supervision', 'crowding', 'fall', 'emergency', 'camera', 'pickup', 'general')
  );

alter table public.ai_camera_events
  drop constraint if exists ai_camera_events_review_priority_check;

alter table public.ai_camera_events
  add constraint ai_camera_events_review_priority_check check (review_priority between 1 and 4);

create index if not exists idx_ai_camera_events_safety_category on public.ai_camera_events(safety_category, status, created_at desc);
create index if not exists idx_ai_camera_events_review_priority on public.ai_camera_events(review_priority, created_at desc);
create index if not exists idx_ai_camera_events_resolution_time on public.ai_camera_events(kindergarten_id, status, reviewed_at, created_at);

update public.ai_camera_events
set
  safety_category = coalesce(
    safety_category,
    case
      when event_type in ('distress_suspected', 'prolonged_crying_indicator') then 'distress'
      when event_type in ('violence_indicator', 'aggressive_behavior_indicator') then 'violence'
      when event_type in ('child_left_alone_indicator', 'staff_absence_indicator') then 'supervision'
      when event_type in ('crowding_suspected', 'unusual_crowding', 'multiple_persons_detected') then 'crowding'
      when event_type = 'fall_suspected' then 'fall'
      when event_type = 'emergency_behavior_indicator' then 'emergency'
      when event_type in ('camera_tampering', 'camera_offline', 'camera_frozen_suspected', 'camera_obstruction_suspected') then 'camera'
      when event_type = 'pickup_mismatch' then 'pickup'
      else 'general'
    end
  ),
  review_priority = case
    when severity in ('critical', 'urgent') then 1
    when severity = 'high' then 2
    when severity = 'medium' then 3
    else 4
  end,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'safety_framework', true,
    'automatic_accusation', false,
    'human_review_required', true,
    'parent_notification_policy', 'confirmed_workflow_only'
  )
where safety_category is null
   or metadata->>'safety_framework' is null;

comment on column public.ai_camera_events.safety_category is 'Safety incident category for review queues and kindergarten-level trend analysis only.';
comment on column public.ai_camera_events.review_priority is '1 critical review first, 4 low priority. Human review required.';
comment on column public.ai_camera_events.evidence_timeline is 'Private future evidence timeline. No public access.';
comment on column public.ai_camera_events.safety_score_impact is 'Kindergarten-level readiness only. Never child scoring.';
