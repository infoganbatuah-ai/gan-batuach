-- Forward-only repair of the manual arrangement state boundary. The previous
-- function wrote confirmed evidence before activation rejected a stale status.
-- CREATE OR REPLACE retains the existing owner and ACL; the explicit grants
-- below preserve the prior authenticated-only invocation contract.
create or replace function public.record_manual_enrollment_arrangement(
  target_request_id uuid,target_method text,target_amount numeric,target_covered_from date,target_covered_until date,target_reference text default null,target_note text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req public.kindergarten_enrollment_requests; evidence public.enrollment_payment_evidence; key text; activation jsonb; reason text;
begin
  select * into req from public.kindergarten_enrollment_requests where id=target_request_id for update;
  if req.id is null then raise exception 'enrollment_request_not_found' using errcode='P0002'; end if;
  if not public.can_manage_garden(req.garden_id) then raise exception 'manual_payment_denied' using errcode='42501'; end if;
  if target_method not in ('bank_transfer','standing_order','checks') or target_amount<0 or target_covered_until<target_covered_from then raise exception 'invalid_manual_arrangement' using errcode='22023'; end if;
  key:='manual-enrollment:'||req.id::text;
  if req.status='activated' and req.activated_enrollment_id is not null then
    select * into evidence from public.enrollment_payment_evidence
      where id=req.activation_payment_evidence_id and enrollment_request_id=req.id and garden_id=req.garden_id
        and evidence_kind='manual_arrangement' and idempotency_key=key;
    if evidence.id is null then raise exception 'manual_arrangement_evidence_conflict' using errcode='23514'; end if;
    return jsonb_build_object('status','activated','enrollment_id',req.activated_enrollment_id,
      'child_id',req.activated_child_id,'idempotent',true);
  end if;
  if req.status is distinct from 'awaiting_payment' then
    raise exception 'enrollment_not_awaiting_payment' using errcode='23514';
  end if;
  insert into public.enrollment_payment_evidence(garden_id,enrollment_request_id,evidence_kind,provider_mode,idempotency_key,status,manual_method,amount,covered_from,covered_until,reference,note,confirmed_at,recorded_by)
  values(req.garden_id,req.id,'manual_arrangement','manual',key,'confirmed',target_method,target_amount,target_covered_from,target_covered_until,nullif(btrim(target_reference),''),nullif(btrim(target_note),''),now(),auth.uid())
  on conflict(garden_id,idempotency_key) do update set updated_at=now()
  returning * into evidence;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),public.current_role(),req.garden_id,'enrollment_payment_evidence',evidence.id,'manual_payment_arrangement_recorded',jsonb_build_object('request_id',req.id,'method',target_method,'covered_from',target_covered_from,'covered_until',target_covered_until));
  begin
    activation:=public.activate_enrollment_from_evidence(req.id,evidence.id);
    return activation;
  exception when others then
    reason:=sqlstate||':'||sqlerrm;
    update public.enrollment_payment_evidence set status='reconciliation_required',reconciliation_reason=left(reason,500),updated_at=now() where id=evidence.id;
    update public.kindergarten_enrollment_requests set status='payment_reconciliation_required',payment_status='reconciliation_required',updated_at=now() where id=req.id and status<>'activated';
    insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),public.current_role(),req.garden_id,'enrollment_payment_evidence',evidence.id,'enrollment_activation_reconciliation_required',jsonb_build_object('request_id',req.id,'reason_code',sqlstate));
    return jsonb_build_object('status','payment_reconciliation_required','payment_evidence_id',evidence.id,'reason_code',sqlstate,'idempotent',false);
  end;
end $$;

revoke all on function public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text) from public,anon;
grant execute on function public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text) to authenticated;
