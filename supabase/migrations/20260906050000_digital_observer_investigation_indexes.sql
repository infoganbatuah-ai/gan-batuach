-- PUSH 13: bounded read indexes for canonical real Event/Incident investigation.
-- No search-history table or generated SQL execution is introduced.

create index if not exists observer_signals_real_investigation_idx
  on public.observer_intelligence_signals (
    observer_site_id,
    ((metadata->>'camera_source_id')),
    ((metadata->>'event_type')),
    created_at desc
  )
  where metadata->>'validated_event' = 'true'
    and metadata->>'observation_provenance' in ('REAL_CAMERA_AI', 'CAMERA_NATIVE_EVENT');

create index if not exists observer_incidents_investigation_recent_idx
  on public.observer_correlated_events (observer_site_id, last_activity_at desc)
  where correlation_version = 'do-track-v1'
    and provenance in ('REAL_CAMERA_AI', 'CAMERA_NATIVE_EVENT');

create index if not exists observer_incidents_investigation_decision_idx
  on public.observer_correlated_events (observer_site_id, final_decision, last_activity_at desc)
  where correlation_version = 'do-track-v1'
    and provenance in ('REAL_CAMERA_AI', 'CAMERA_NATIVE_EVENT');

create index if not exists observer_incidents_investigation_risk_score_idx
  on public.observer_correlated_events (observer_site_id, current_risk_score, last_activity_at desc)
  where correlation_version = 'do-track-v1'
    and provenance in ('REAL_CAMERA_AI', 'CAMERA_NATIVE_EVENT');

create index if not exists observer_incidents_investigation_risk_band_idx
  on public.observer_correlated_events (observer_site_id, current_risk_band, last_activity_at desc)
  where correlation_version = 'do-track-v1'
    and provenance in ('REAL_CAMERA_AI', 'CAMERA_NATIVE_EVENT');

create index if not exists observer_incidents_investigation_verification_idx
  on public.observer_correlated_events (observer_site_id, current_verification_status, last_activity_at desc)
  where correlation_version = 'do-track-v1'
    and provenance in ('REAL_CAMERA_AI', 'CAMERA_NATIVE_EVENT');

comment on index public.observer_signals_real_investigation_idx is
  'Supports bounded site/camera/event/time investigation over validated real observations only.';
comment on index public.observer_incidents_investigation_recent_idx is
  'Supports canonical real Incident timeline retrieval without scanning legacy correlation rows.';
comment on index public.observer_incidents_investigation_decision_idx is
  'Supports deterministic Decision-filtered Incident investigation.';
comment on index public.observer_incidents_investigation_risk_score_idx is
  'Supports bounded numeric Risk filters without conflating detector confidence and Risk.';
comment on index public.observer_incidents_investigation_risk_band_idx is
  'Supports common Risk-band investigation while preserving deterministic recency ordering.';
comment on index public.observer_incidents_investigation_verification_idx is
  'Supports canonical Verification-state investigation without broad Incident scans.';

notify pgrst, 'reload schema';
