-- PUSH 9: one immutable evaluation per canonical Event and Risk Engine version.
-- A later explicit re-evaluation must use a new engine version; delivery retries
-- must never create duplicate history or action intents.

create unique index if not exists digital_observer_risk_event_version_uidx
  on public.digital_observer_risk_evaluations(incident_id, triggering_event_id, risk_engine_version);

notify pgrst, 'reload schema';
