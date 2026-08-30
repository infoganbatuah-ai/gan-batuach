-- Preserve the explicit distinction requested during a camera-derived identity
-- review: a known person is either a household resident or an authorized guest.
-- The existing consent-checked review function remains the source of person
-- creation; this overload only adds the selected access class and audit detail.

create or replace function public.review_digital_observer_identity_candidate(
  requested_candidate_id uuid,
  requested_outcome text,
  requested_display_name text,
  requested_relationship_label text,
  requested_access_class text,
  requested_explicit_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  review_result jsonb;
  person_id uuid;
  site_id uuid;
  normalized_access_class text;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  normalized_access_class := lower(trim(coalesce(requested_access_class, 'authorized_visitor')));
  if normalized_access_class not in ('household_resident', 'authorized_visitor') then
    raise exception 'INVALID_ACCESS_CLASS';
  end if;

  review_result := public.review_digital_observer_identity_candidate(
    requested_candidate_id,
    requested_outcome,
    requested_display_name,
    requested_relationship_label,
    requested_explicit_consent
  );

  person_id := nullif(review_result->>'known_person_id', '')::uuid;
  select observer_site_id into site_id
  from public.digital_observer_identity_candidates
  where id = requested_candidate_id;

  if person_id is not null then
    update public.digital_observer_known_people
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'access_class', normalized_access_class,
          'camera_candidate_reviewed', true,
          'biometric_processing_active', false
        ),
        updated_at = now()
    where id = person_id and observer_site_id = site_id;

    update public.digital_observer_identity_candidates
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'access_class', normalized_access_class,
          'classification_confirmed_by_user', true
        ),
        updated_at = now()
    where id = requested_candidate_id and observer_site_id = site_id;

    insert into public.observer_capability_audit_events (
      event_key, event_type, vertical_key, capability_key, actor_profile_id,
      status, reason, metadata
    ) values (
      'identity-access-class-' || requested_candidate_id::text || '-' || extract(epoch from clock_timestamp())::bigint::text,
      'consent_recorded',
      'home_observer',
      'face_recognition',
      auth.uid(),
      'success',
      'Explicit known-person classification recorded; biometric matching remains disabled until verified.',
      jsonb_build_object(
        'observer_site_id', site_id,
        'known_person_id', person_id,
        'identity_candidate_id', requested_candidate_id,
        'access_class', normalized_access_class,
        'biometric_processing_active', false
      )
    );
  end if;

  return review_result || jsonb_build_object('access_class', normalized_access_class);
end;
$$;

revoke all on function public.review_digital_observer_identity_candidate(uuid, text, text, text, text, boolean) from public;
grant execute on function public.review_digital_observer_identity_candidate(uuid, text, text, text, text, boolean) to authenticated;

comment on function public.review_digital_observer_identity_candidate(uuid, text, text, text, text, boolean) is
  'Consent-checked identity review with household-resident or authorized-visitor classification. Matching remains disabled until verified locally.';

notify pgrst, 'reload schema';
