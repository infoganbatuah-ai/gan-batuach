begin;

-- Add the chat lifecycle without weakening the existing capability audit types.
alter table public.observer_capability_audit_events
  drop constraint if exists observer_capability_audit_type_check;
alter table public.observer_capability_audit_events
  add constraint observer_capability_audit_type_check check (
    event_type in (
      'capability_enabled', 'capability_disabled', 'capability_blocked',
      'legal_review_required', 'override_requested', 'override_approved',
      'override_rejected', 'runtime_guard_blocked', 'consent_recorded',
      'consent_revoked', 'biometric_reference_deleted', 'camera_action_requested',
      'camera_action_confirmed', 'camera_action_cancelled', 'camera_action_result',
      'observer_conversation_action'
    )
  ) not valid;
alter table public.observer_capability_audit_events
  validate constraint observer_capability_audit_type_check;

-- Authenticated clients must not forge server execution/audit outcomes. The
-- server writes only after session/site authorization with its service role.
drop policy if exists "observer chat audit server insert" on public.observer_capability_audit_events;
create policy "observer chat audit server insert"
  on public.observer_capability_audit_events as restrictive
  for insert to authenticated
  with check (event_type <> 'observer_conversation_action');

commit;
