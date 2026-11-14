-- A submitted inspection is a historical record. Corrective work belongs to
-- findings/actions; it must not rewrite the original score or answers.
create or replace function public.guard_submitted_inspection_record()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status::text = 'done' then
      raise exception 'submitted_inspection_immutable' using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status::text = 'done' then
    -- complete_monthly_inspection writes the score first, then seals its
    -- signature and snapshot in the same transaction. Permit that one seal
    -- only for the assigned inspector, without changing scored fields.
    if old.regulatory_locked_at is null
       and new.regulatory_locked_at is not null
       and new.regulatory_locked_by = old.inspector_id
       and auth.uid() = old.inspector_id
       and new.report_snapshot is not null
       and (new.report_snapshot ->> 'weighted_score')::numeric = old.weighted_score
       and (to_jsonb(new) - array[
         'signature_image', 'signed_at', 'signed_by', 'performed_by_user',
         'performed_by_role', 'regulatory_document_number',
         'regulatory_locked_at', 'regulatory_locked_by',
         'template_snapshot', 'report_snapshot', 'updated_at'
       ]) = (to_jsonb(old) - array[
         'signature_image', 'signed_at', 'signed_by', 'performed_by_user',
         'performed_by_role', 'regulatory_document_number',
         'regulatory_locked_at', 'regulatory_locked_by',
         'template_snapshot', 'report_snapshot', 'updated_at'
       ]) then
      return new;
    end if;
    raise exception 'submitted_inspection_immutable' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists management_submitted_inspection_guard on public.inspections;
create trigger management_submitted_inspection_guard
before update or delete on public.inspections
for each row execute function public.guard_submitted_inspection_record();

create or replace function public.guard_submitted_inspection_answer()
returns trigger language plpgsql security definer set search_path = public as $$
declare previous_inspection_id uuid;
declare next_inspection_id uuid;
begin
  if tg_op <> 'INSERT' then previous_inspection_id := old.inspection_id; end if;
  if tg_op <> 'DELETE' then next_inspection_id := new.inspection_id; end if;
  if exists (
    select 1 from public.inspections i
    where i.status::text = 'done'
      and i.id in (previous_inspection_id, next_inspection_id)
  ) then
    raise exception 'submitted_inspection_answers_immutable' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists management_submitted_inspection_answer_guard on public.inspection_answers;
create trigger management_submitted_inspection_answer_guard
before insert or update or delete on public.inspection_answers
for each row execute function public.guard_submitted_inspection_answer();
