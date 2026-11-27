-- PUSH 39 Development full-stack correction: expose only the new bounded
-- delivery-status fields required by the existing RLS-scoped Product history.
-- No write privilege, provider activation, payload, credential, destination,
-- authorization snapshot or policy snapshot is exposed by this grant.
grant select (
  action_intent_id,
  priority,
  max_attempts,
  expires_at,
  cancelled_at,
  terminal_at,
  unknown_outcome_at,
  dead_lettered_at,
  last_attempt_at,
  stable_delivery_id,
  content_classification,
  locale,
  timezone
) on table public.digital_observer_notification_deliveries to authenticated;
