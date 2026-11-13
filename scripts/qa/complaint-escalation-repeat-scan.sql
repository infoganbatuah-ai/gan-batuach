-- Run only against the guarded isolated Development database. All mutations roll back.
BEGIN;
DO $test$
DECLARE
  target_id uuid;
  active_id uuid;
  expected_inspector uuid;
  active_inspector uuid;
  events_before bigint;
  audit_before bigint;
  task_assignee_before uuid;
  actual_state text;
  actual_inspector uuid;
  actual_assignee uuid;
BEGIN
  IF current_database() <> 'postgres' THEN
    RAISE EXCEPTION 'unexpected_database';
  END IF;
  SELECT complaint.id, garden.inspector_id INTO target_id, expected_inspector
  FROM public.complaints AS complaint
  JOIN public.gardens AS garden ON garden.id = complaint.garden_id
  WHERE complaint.status::text = 'escalated'
    AND public.is_approved_inspector(garden.inspector_id)
  ORDER BY complaint.created_at, complaint.id LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'isolated_escalated_fixture_missing'; END IF;
  IF has_function_privilege('authenticated', 'public.escalate_overdue_complaints(timestamptz, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.escalate_overdue_complaints(timestamptz, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'escalation_execute_exposed';
  END IF;
  UPDATE public.complaints
  SET routing_state = 'admin_queue', assigned_inspector_id = NULL
  WHERE id = target_id;
  SELECT count(*) INTO events_before FROM public.complaint_events WHERE complaint_id = target_id;
  SELECT count(*) INTO audit_before FROM public.audit_logs WHERE entity_type = 'complaints' AND entity_id = target_id;
  SELECT assigned_to INTO task_assignee_before FROM public.tasks
  WHERE source_entity_type = 'complaint' AND source_entity_id = target_id
  ORDER BY created_at LIMIT 1;
  PERFORM public.escalate_overdue_complaints(now(), 100);
  SELECT routing_state, assigned_inspector_id INTO actual_state, actual_inspector
  FROM public.complaints WHERE id = target_id;
  SELECT assigned_to INTO actual_assignee FROM public.tasks
  WHERE source_entity_type = 'complaint' AND source_entity_id = target_id
  ORDER BY created_at LIMIT 1;
  IF actual_state IS DISTINCT FROM 'admin_queue'
     OR actual_inspector IS NOT NULL
     OR (SELECT count(*) FROM public.complaint_events WHERE complaint_id = target_id) <> events_before
     OR (SELECT count(*) FROM public.audit_logs WHERE entity_type = 'complaints' AND entity_id = target_id) <> audit_before
     OR actual_assignee IS DISTINCT FROM task_assignee_before THEN
    RAISE EXCEPTION 'escalated_complaint_rerouted_on_repeat_scan';
  END IF;

  -- A complaint still in progress must continue to follow current Inspector authority.
  SELECT complaint.id, garden.inspector_id INTO active_id, active_inspector
  FROM public.complaints AS complaint
  JOIN public.gardens AS garden ON garden.id = complaint.garden_id
  WHERE complaint.status::text = 'in_progress'
    AND public.is_approved_inspector(garden.inspector_id)
  ORDER BY complaint.created_at, complaint.id LIMIT 1;
  IF active_id IS NULL THEN RAISE EXCEPTION 'isolated_active_fixture_missing'; END IF;
  UPDATE public.complaints
  SET routing_state = 'admin_queue', assigned_inspector_id = NULL
  WHERE id = active_id;
  SELECT count(*) INTO events_before FROM public.complaint_events WHERE complaint_id = active_id;
  PERFORM public.escalate_overdue_complaints(now(), 100);
  SELECT routing_state, assigned_inspector_id INTO actual_state, actual_inspector
  FROM public.complaints WHERE id = active_id;
  IF actual_state IS DISTINCT FROM 'inspector'
     OR actual_inspector IS DISTINCT FROM active_inspector
     OR (SELECT count(*) FROM public.complaint_events WHERE complaint_id = active_id) <> events_before + 1 THEN
    RAISE EXCEPTION 'active_complaint_authority_routing_broken';
  END IF;
END $test$;
ROLLBACK;
