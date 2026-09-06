-- Preserve the existing global app_role enum. Feedback stores an auditable role
-- label as text and must not coerce its safe fallback labels into app_role.
do $$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.record_digital_observer_incident_feedback(uuid,text,text,text,text,text,text,uuid)'::regprocedure
  ) into function_definition;
  corrected_definition := replace(
    function_definition,
    'coalesce(profile.role, ''observer_member'')',
    'coalesce(profile.role::text, ''observer_member'')'
  );
  if corrected_definition = function_definition and position('profile.role::text' in function_definition) = 0 then
    raise exception 'FEEDBACK_ROLE_CAST_PATCH_NOT_APPLIED';
  end if;
  execute corrected_definition;

  select pg_get_functiondef(
    'public.review_digital_observer_incident_feedback(uuid,text,text,text,text)'::regprocedure
  ) into function_definition;
  corrected_definition := replace(
    function_definition,
    'coalesce((select role from public.profiles where id = auth.uid()), ''reviewer'')',
    'coalesce((select role::text from public.profiles where id = auth.uid()), ''reviewer'')'
  );
  if corrected_definition = function_definition and position('select role::text from public.profiles' in function_definition) = 0 then
    raise exception 'GROUND_TRUTH_ROLE_CAST_PATCH_NOT_APPLIED';
  end if;
  execute corrected_definition;
end;
$$;

notify pgrst, 'reload schema';
