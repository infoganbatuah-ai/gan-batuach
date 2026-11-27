begin;
do $$ begin raise exception 'REVIEW ONLY: close the reader before base rollback'; end $$;
revoke all on function public.qa_observer_read_window() from public,anon,authenticated,service_role;
lock table observer_qa_proof_private.windows in access exclusive mode;
-- Only the reserved namespace for these exact staged request keys belongs to this operator.
do $$ declare r record; begin
  for r in select request_key from observer_qa_proof_private.windows loop
    perform observer_qa_proof_private.close_window(r.request_key);
  end loop;
end $$;
drop function public.qa_observer_read_window();
drop function observer_qa_proof_private.current_window();
drop table observer_qa_proof_private.ticket_slots;
drop function observer_qa_proof_private.stage_window(uuid,uuid,uuid,uuid,text,integer),
  observer_qa_proof_private.close_window(uuid);
revoke usage on schema observer_qa_proof_private from observer_qa_window_reader;
drop role observer_qa_window_reader;
commit;
