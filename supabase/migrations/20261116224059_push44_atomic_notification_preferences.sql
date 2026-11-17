-- PUSH 44: a single invoker transaction for the two preference tables.
-- This migration is prepared for review only; it has not been applied.
create function public.save_communication_preferences_atomic(p_patch jsonb, p_categories jsonb default null)
returns public.communication_preferences
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_key text;
  v_value jsonb;
  v_channel_key text;
  v_channel_value jsonb;
  v_channel jsonb;
  v_row public.communication_preferences%rowtype;
begin
  if v_user is null or jsonb_typeof(p_patch) is distinct from 'object'
     or (p_categories is not null and jsonb_typeof(p_categories) is distinct from 'object') then
    raise exception 'invalid preference request' using errcode = '22023';
  end if;
  select role::text into v_role from public.profiles where id = v_user and active is true;
  if not found then
    raise exception 'active profile required' using errcode = '42501';
  end if;

  for v_key, v_value in select key, value from jsonb_each(p_patch) loop
    if v_key in ('receive_sms', 'receive_whatsapp', 'receive_email', 'receive_push',
                 'critical_push_allowed', 'emergency_messages_allowed',
                 'parent_daily_digest_enabled', 'parent_ai_summary_enabled') then
      if jsonb_typeof(v_value) <> 'boolean' then
        raise exception 'invalid boolean preference' using errcode = '22023';
      end if;
    elsif v_key = 'preferred_language' then
      if v_value not in ('"he"'::jsonb, '"en"'::jsonb, '"ar"'::jsonb) then
        raise exception 'invalid language' using errcode = '22023';
      end if;
    elsif v_key = 'quiet_hours_timezone' then
      if v_value not in ('"Asia/Jerusalem"'::jsonb, '"UTC"'::jsonb) then
        raise exception 'invalid timezone' using errcode = '22023';
      end if;
    elsif v_key in ('quiet_hours_start', 'quiet_hours_end') then
      if jsonb_typeof(v_value) not in ('string', 'null')
         or (jsonb_typeof(v_value) = 'string' and
             (v_value #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
        raise exception 'invalid quiet hours' using errcode = '22023';
      end if;
    elsif v_key in ('parent_category_channels', 'notification_category_channels') then
      if jsonb_typeof(v_value) <> 'object' then
        raise exception 'invalid channel map' using errcode = '22023';
      end if;
      for v_channel_key, v_channel_value in select key, value from jsonb_each(v_value) loop
        if length(v_channel_key) > 100 or jsonb_typeof(v_channel_value) <> 'array' then
          raise exception 'invalid channel selection' using errcode = '22023';
        end if;
        for v_channel in select value from jsonb_array_elements(v_channel_value) loop
          if v_channel not in ('"push"'::jsonb, '"email"'::jsonb,
                               '"sms"'::jsonb, '"whatsapp"'::jsonb) then
            raise exception 'invalid channel' using errcode = '22023';
          end if;
        end loop;
      end loop;
    else
      raise exception 'unsupported preference key' using errcode = '22023';
    end if;
  end loop;

  if p_categories is not null then
    for v_key, v_value in select key, value from jsonb_each(p_categories) loop
      if v_key not in ('important', 'safety', 'attendance', 'message',
                       'document', 'payment', 'pickup') or jsonb_typeof(v_value) <> 'boolean' then
        raise exception 'invalid push category preference' using errcode = '22023';
      end if;
    end loop;
  end if;

  -- The caller never supplies profile_id. RLS still applies under SECURITY INVOKER.
  insert into public.communication_preferences (profile_id)
  values (v_user) on conflict (profile_id) do nothing;

  update public.communication_preferences as pref set
    receive_sms = coalesce((p_patch->>'receive_sms')::boolean, pref.receive_sms),
    receive_whatsapp = coalesce((p_patch->>'receive_whatsapp')::boolean, pref.receive_whatsapp),
    receive_email = coalesce((p_patch->>'receive_email')::boolean, pref.receive_email),
    receive_push = coalesce((p_patch->>'receive_push')::boolean, pref.receive_push),
    critical_push_allowed = coalesce((p_patch->>'critical_push_allowed')::boolean, pref.critical_push_allowed),
    emergency_messages_allowed = coalesce((p_patch->>'emergency_messages_allowed')::boolean, pref.emergency_messages_allowed),
    preferred_language = coalesce(p_patch->>'preferred_language', pref.preferred_language),
    parent_daily_digest_enabled = coalesce((p_patch->>'parent_daily_digest_enabled')::boolean, pref.parent_daily_digest_enabled),
    parent_ai_summary_enabled = coalesce((p_patch->>'parent_ai_summary_enabled')::boolean, pref.parent_ai_summary_enabled),
    parent_category_channels = coalesce(p_patch->'parent_category_channels', pref.parent_category_channels),
    notification_category_channels = coalesce(p_patch->'notification_category_channels', pref.notification_category_channels),
    quiet_hours_start = case when p_patch ? 'quiet_hours_start'
      then (p_patch->>'quiet_hours_start')::time else pref.quiet_hours_start end,
    quiet_hours_end = case when p_patch ? 'quiet_hours_end'
      then (p_patch->>'quiet_hours_end')::time else pref.quiet_hours_end end,
    quiet_hours_timezone = coalesce(p_patch->>'quiet_hours_timezone', pref.quiet_hours_timezone),
    updated_at = now()
  where pref.profile_id = v_user
  returning * into v_row;
  if not found or (v_row.quiet_hours_start is null) <> (v_row.quiet_hours_end is null) then
    raise exception 'preference update denied' using errcode = '22023';
  end if;

  if p_categories is not null then
    for v_key, v_value in select key, value from jsonb_each(p_categories) loop
      insert into public.push_category_preferences (profile_id, category, enabled, role)
      values (v_user, v_key, (v_value #>> '{}')::boolean, v_role)
      on conflict (profile_id, category) do update
        set enabled = excluded.enabled, role = excluded.role, updated_at = now();
    end loop;
  end if;
  return v_row;
end;
$$;

revoke all on function public.save_communication_preferences_atomic(jsonb, jsonb) from public, anon;
grant execute on function public.save_communication_preferences_atomic(jsonb, jsonb) to authenticated;
