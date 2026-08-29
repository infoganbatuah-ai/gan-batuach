-- Per-person biometric-consent lifecycle. Live recognition remains disabled by
-- application policy until a separately approved model and runtime exist.

alter table public.observer_capability_audit_events
  drop constraint if exists observer_capability_audit_type_check;

alter table public.observer_capability_audit_events
  add constraint observer_capability_audit_type_check check (
    event_type in (
      'capability_enabled', 'capability_disabled', 'capability_blocked',
      'legal_review_required', 'override_requested', 'override_approved',
      'override_rejected', 'runtime_guard_blocked', 'consent_recorded',
      'consent_revoked', 'biometric_reference_deleted'
    )
  );

create index if not exists observer_capability_audit_known_person_idx
  on public.observer_capability_audit_events ((metadata ->> 'known_person_id'), created_at desc)
  where metadata ? 'known_person_id';
