-- PHASE 154: Immutable Audit Trail, Evidence Logs & WORM Readiness Platform

create extension if not exists pgcrypto;

create table if not exists public.immutable_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_category text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  target_type text,
  target_id uuid,
  garden_id uuid references public.gardens(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  camera_id uuid,
  document_id uuid,
  inspection_id uuid,
  incident_id uuid,
  ip_address inet,
  user_agent text,
  device_fingerprint text,
  request_id text,
  session_id text,
  metadata jsonb not null default '{}'::jsonb,
  risk_level text not null default 'medium',
  created_at timestamptz not null default now(),
  previous_event_hash text,
  event_hash text,
  worm_export_status text not null default 'local_only',
  constraint immutable_audit_category_check check (event_category in ('auth','medical','camera','document','child','staff','parent','inspection','incident','observer','payment','admin','security','regulatory')),
  constraint immutable_audit_risk_check check (risk_level in ('low','medium','high','critical')),
  constraint immutable_audit_worm_status_check check (worm_export_status in ('local_only','queued','exported','failed','external_worm_ready'))
);

create table if not exists public.audit_coverage_readiness (
  id uuid primary key default gen_random_uuid(),
  coverage_key text not null unique,
  coverage_area text not null,
  title text not null,
  audited_routes integer not null default 0,
  required_routes integer not null default 0,
  coverage_score integer not null default 0,
  readiness_status text not null default 'partial',
  evidence_table text not null default 'immutable_audit_events',
  missing_coverage jsonb not null default '[]'::jsonb,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audit_coverage_area_check check (coverage_area in ('medical','camera','document','payment','admin','ai_review','security','regulatory','auth','child_parent')),
  constraint audit_coverage_status_check check (readiness_status in ('ready','partial','missing','blocked')),
  constraint audit_coverage_score_check check (coverage_score between 0 and 100)
);

create index if not exists immutable_audit_created_idx on public.immutable_audit_events(created_at desc);
create index if not exists immutable_audit_category_idx on public.immutable_audit_events(event_category, risk_level, created_at desc);
create index if not exists immutable_audit_actor_idx on public.immutable_audit_events(actor_profile_id, created_at desc);
create index if not exists immutable_audit_garden_idx on public.immutable_audit_events(garden_id, created_at desc);
create index if not exists immutable_audit_child_idx on public.immutable_audit_events(child_id, created_at desc);
create index if not exists immutable_audit_camera_idx on public.immutable_audit_events(camera_id, created_at desc);
create index if not exists immutable_audit_document_idx on public.immutable_audit_events(document_id, created_at desc);
create index if not exists immutable_audit_request_idx on public.immutable_audit_events(request_id) where request_id is not null;

create or replace function public.block_immutable_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'immutable audit evidence is append-only and cannot be updated or deleted';
end;
$$;

create or replace function public.set_immutable_audit_hash()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous text;
  v_metadata_hash text;
begin
  select event_hash
    into v_previous
    from public.immutable_audit_events
   where event_hash is not null
   order by created_at desc, id desc
   limit 1;

  if new.previous_event_hash is null then
    new.previous_event_hash := v_previous;
  end if;

  v_metadata_hash := encode(digest(coalesce(new.metadata::text, '{}'), 'sha256'), 'hex');
  new.event_hash := encode(digest(concat_ws('|',
    new.id::text,
    new.event_type,
    new.event_category,
    coalesce(new.actor_profile_id::text, ''),
    coalesce(new.target_type, ''),
    coalesce(new.target_id::text, ''),
    coalesce(new.garden_id::text, ''),
    coalesce(new.child_id::text, ''),
    coalesce(new.camera_id::text, ''),
    coalesce(new.document_id::text, ''),
    new.created_at::text,
    v_metadata_hash,
    coalesce(new.previous_event_hash, '')
  ), 'sha256'), 'hex');

  return new;
end;
$$;

drop trigger if exists immutable_audit_set_hash on public.immutable_audit_events;
create trigger immutable_audit_set_hash
before insert on public.immutable_audit_events
for each row execute function public.set_immutable_audit_hash();

drop trigger if exists immutable_audit_block_update on public.immutable_audit_events;
create trigger immutable_audit_block_update
before update on public.immutable_audit_events
for each row execute function public.block_immutable_audit_mutation();

drop trigger if exists immutable_audit_block_delete on public.immutable_audit_events;
create trigger immutable_audit_block_delete
before delete on public.immutable_audit_events
for each row execute function public.block_immutable_audit_mutation();

drop trigger if exists medical_access_logs_block_update on public.medical_data_access_logs;
create trigger medical_access_logs_block_update
before update on public.medical_data_access_logs
for each row execute function public.block_immutable_audit_mutation();

drop trigger if exists medical_access_logs_block_delete on public.medical_data_access_logs;
create trigger medical_access_logs_block_delete
before delete on public.medical_data_access_logs
for each row execute function public.block_immutable_audit_mutation();

alter table public.immutable_audit_events enable row level security;
alter table public.audit_coverage_readiness enable row level security;

drop policy if exists "immutable audit admin read" on public.immutable_audit_events;
create policy "immutable audit admin read" on public.immutable_audit_events
  for select using (public.is_admin());

drop policy if exists "immutable audit append authenticated" on public.immutable_audit_events;
create policy "immutable audit append authenticated" on public.immutable_audit_events
  for insert with check (public.is_admin() or actor_profile_id = auth.uid() or actor_profile_id is null);

drop policy if exists "audit coverage admin read" on public.audit_coverage_readiness;
create policy "audit coverage admin read" on public.audit_coverage_readiness
  for select using (public.is_admin());

drop policy if exists "audit coverage admin write" on public.audit_coverage_readiness;
create policy "audit coverage admin write" on public.audit_coverage_readiness
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.audit_coverage_readiness (
  coverage_key,
  coverage_area,
  title,
  audited_routes,
  required_routes,
  coverage_score,
  readiness_status,
  missing_coverage,
  recommended_action,
  metadata
) values
  ('medical-access-audit', 'medical', 'Medical access audit coverage', 3, 7, 58, 'partial', '["medical decrypt helper","health export","medical deletion request"]'::jsonb, 'Route all medical decrypt/view/export operations through writeMedicalAccessEvent.', '{"phase":154}'::jsonb),
  ('camera-access-audit', 'camera', 'Camera viewing and token audit coverage', 2, 8, 45, 'partial', '["viewing token creation","session start","session end","denied access reasons"]'::jsonb, 'Wire parent/manager/inspector camera token routes into writeCameraAccessEvent.', '{"phase":154}'::jsonb),
  ('document-evidence-audit', 'document', 'Document and evidence access audit coverage', 1, 8, 28, 'partial', '["signed URL generated","download viewed","evidence viewed","replacement request"]'::jsonb, 'Add server-only document access route audit writes before production.', '{"phase":154}'::jsonb),
  ('payment-audit', 'payment', 'Payment and billing audit coverage', 4, 10, 62, 'partial', '["invoice download","bank details changed","refund approval"]'::jsonb, 'Bridge financial_audit_events into immutable_audit_events.', '{"phase":154}'::jsonb),
  ('admin-role-audit', 'admin', 'Admin and role change audit coverage', 4, 9, 64, 'partial', '["role changed","permission override","user disabled"]'::jsonb, 'Route role and permission changes through writeAdminActionEvent.', '{"phase":154}'::jsonb),
  ('ai-review-audit', 'ai_review', 'AI and observer review audit coverage', 2, 7, 48, 'partial', '["parent visibility approval","threshold change","restricted capability toggle"]'::jsonb, 'Bridge AI review workflows into writeAIReviewEvent.', '{"phase":154}'::jsonb),
  ('security-event-audit', 'security', 'Security event audit coverage', 3, 9, 56, 'partial', '["login success","logout","MFA failure","token misuse"]'::jsonb, 'Use withAuditLog and writeSecurityEvent on auth/security routes.', '{"phase":154}'::jsonb),
  ('regulatory-evidence-audit', 'regulatory', 'Regulatory evidence audit coverage', 4, 8, 66, 'partial', '["final report generated","regulatory document locked"]'::jsonb, 'Bridge inspection/regulatory events into immutable audit stream.', '{"phase":154}'::jsonb)
on conflict (coverage_key) do update set
  audited_routes = excluded.audited_routes,
  required_routes = excluded.required_routes,
  coverage_score = excluded.coverage_score,
  readiness_status = excluded.readiness_status,
  missing_coverage = excluded.missing_coverage,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.audit_event_catalog (event_key, category, title, required, implemented, source_table, notes, data_classification, metadata)
values
  ('immutable-medical-access', 'medical', 'Immutable medical access log', true, true, 'immutable_audit_events', 'Medical view/update events are mirrored into the immutable audit stream.', 'medical', '{"phase":154}'::jsonb),
  ('immutable-camera-access', 'camera', 'Immutable camera access log', true, true, 'immutable_audit_events', 'Camera creation is mirrored; viewing/token routes still need full coverage.', 'regulated', '{"phase":154}'::jsonb),
  ('immutable-document-access', 'document', 'Immutable document and evidence access log', true, false, 'immutable_audit_events', 'Document signed URL and evidence downloads still need route integration.', 'regulated', '{"phase":154}'::jsonb),
  ('immutable-payment-actions', 'payment', 'Immutable payment action log', true, false, 'immutable_audit_events', 'Financial audit events exist and need bridge writes.', 'confidential', '{"phase":154}'::jsonb),
  ('immutable-ai-review', 'observer', 'Immutable AI review action log', true, false, 'immutable_audit_events', 'AI review actions need unified audit writes.', 'regulated', '{"phase":154}'::jsonb),
  ('immutable-hash-chain', 'security', 'Tamper-evident hash chain', true, true, 'immutable_audit_events', 'Local hash chain is generated with pgcrypto. External WORM is still future infrastructure.', 'regulated', '{"phase":154}'::jsonb)
on conflict (event_key) do update set
  implemented = excluded.implemented,
  source_table = excluded.source_table,
  notes = excluded.notes,
  data_classification = excluded.data_classification,
  metadata = excluded.metadata;

insert into public.security_readiness_checks (check_key, category, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('immutable-audit-events', 'audit_logging', 'Immutable audit event stream', 'partial', 'critical', 'immutable_audit_events stores sanitized event metadata, hash-chain fields and append-only triggers.', 'Bridge all sensitive routes and configure external WORM export before production.', '{"phase":154}'::jsonb),
  ('audit-hash-chain', 'audit_logging', 'Tamper-evident hash chain', 'ready', 'high', 'pgcrypto trigger computes previous_event_hash and event_hash on insert.', 'Validate chain verification in staging and export evidence for ISO review.', '{"phase":154}'::jsonb),
  ('worm-readiness', 'audit_logging', 'External WORM readiness', 'partial', 'high', 'Local schema includes worm_export_status and documentation maps future WORM targets.', 'Select external immutable storage/SIEM provider before launch.', '{"phase":154}'::jsonb)
on conflict (check_key) do update set
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.immutable_audit_events is 'Unified append-only, tamper-evident audit and legal evidence stream. Metadata must be sanitized and never contain plaintext sensitive values.';
comment on table public.audit_coverage_readiness is 'Audit coverage dashboard model for medical, camera, document, payment, admin, AI, security and regulatory event readiness.';
