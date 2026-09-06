-- Canonical Incident track IDs are text identifiers. Preserve that contract in
-- calibration samples instead of assuming every tracker uses UUID identifiers.
alter table public.digital_observer_calibration_samples
  alter column track_ids type text[] using track_ids::text[];

notify pgrst, 'reload schema';
