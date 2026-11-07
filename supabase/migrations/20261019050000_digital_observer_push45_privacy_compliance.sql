-- PUSH 45 — Digital Observer privacy, legal-governance and lifecycle controls.
-- Additive Development schema only. No legal approval, sensitive feature or Production mode is activated.

begin;

alter table public.privacy_rights_requests
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete set null,
  add column if not exists organization_id uuid references public.digital_observer_organizations(id) on delete set null,
  add column if not exists stated_purpose text,
  add column if not exists external_system_disposition jsonb not null default '[]'::jsonb;

alter table public.privacy_rights_requests drop constraint if exists privacy_rights_subject_type_check;
alter table public.privacy_rights_requests add constraint privacy_rights_subject_type_check check (data_subject_type in (
  'child','parent','staff','manager','inspector','garden','observer_account','organization_member','site_user','partner_customer'
));

alter table public.legal_holds
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete set null,
  add column if not exists organization_id uuid references public.digital_observer_organizations(id) on delete set null,
  add column if not exists jurisdiction text not null default 'IL',
  add column if not exists documented_purpose text,
  add column if not exists data_scope jsonb not null default '[]'::jsonb,
  add column if not exists review_due_at timestamptz;

alter table public.legal_holds drop constraint if exists legal_hold_type_check;
alter table public.legal_holds add constraint legal_hold_type_check check (hold_type in (
  'incident_investigation','inspection_evidence','safety_complaint','payment_dispute','legal_dispute',
  'regulatory_review','audit_preservation','data_subject_request','authorized_investigation','privacy_incident'
));

alter table public.data_retention_policies drop constraint if exists data_retention_category_check;
alter table public.data_retention_policies add constraint data_retention_category_check check (data_category in (
  'medical_data','child_records','attendance_records','pickup_signatures','inspection_reports','incident_evidence',
  'complaints','documents','invoices','payment_records','audit_logs','ai_telemetry','skeleton_telemetry',
  'camera_access_logs','communications','ephemeral_context','private_documents','camera_clips','observer_evidence',
  'event_alert_metadata','source_recording_reference','investigation_case','notification_metadata','mobile_identifier',
  'location_data','biometric_template'
));

create table if not exists public.digital_observer_privacy_policy_profiles (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null,
  policy_version integer not null default 1,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  organization_id uuid references public.digital_observer_organizations(id) on delete cascade,
  product_context text not null,
  jurisdiction text not null default 'IL',
  stated_purpose text not null,
  controller_role text not null,
  processor_roles jsonb not null default '[]'::jsonb,
  data_categories jsonb not null default '[]'::jsonb,
  recipient_classes jsonb not null default '[]'::jsonb,
  area_restrictions jsonb not null default '[]'::jsonb,
  retention_schedule jsonb not null default '{}'::jsonb,
  notice_version text,
  legal_decision_state text not null default 'LEGAL_REVIEW_PENDING',
  active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(policy_key,policy_version),
  constraint do_privacy_profile_context_check check (product_context in ('HOME','SMALL_BUSINESS','ENTERPRISE','OEM_WHITE_LABEL','KINDERGARTEN','AUTHORIZED_INVESTIGATION','PERSONAL_SAFETY')),
  constraint do_privacy_profile_state_check check (legal_decision_state in ('TECHNICALLY_IMPLEMENTED','LEGAL_REVIEW_PENDING','EXTERNALLY_APPROVED','PROHIBITED','NOT_APPLICABLE')),
  constraint do_privacy_profile_scope_check check (observer_site_id is not null or organization_id is not null),
  constraint do_privacy_profile_json_check check (jsonb_typeof(processor_roles)='array' and jsonb_typeof(data_categories)='array' and jsonb_typeof(recipient_classes)='array' and jsonb_typeof(area_restrictions)='array' and jsonb_typeof(retention_schedule)='object'),
  constraint do_privacy_profile_activation_check check (not active or legal_decision_state='EXTERNALLY_APPROVED')
);

create table if not exists public.digital_observer_legal_approvals (
  id uuid primary key default gen_random_uuid(),
  privacy_policy_profile_id uuid not null references public.digital_observer_privacy_policy_profiles(id) on delete cascade,
  sensitive_capability text not null,
  jurisdiction text not null,
  stated_purpose text not null,
  approval_status text not null default 'pending',
  decision_reference text,
  decision_checksum text,
  reviewer_class text,
  effective_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  safe_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(privacy_policy_profile_id,sensitive_capability,stated_purpose),
  constraint do_legal_approval_capability_check check (sensitive_capability in ('FACE_DETECTION','FACE_RECOGNITION','PERSON_REIDENTIFICATION','VEHICLE_REIDENTIFICATION','APPEARANCE_SIMILARITY','BIOMETRIC_IDENTIFICATION','CHILD_SENSITIVE_MONITORING','WORKPLACE_MONITORING','SOURCE_RECORDING_INVESTIGATION','MISSING_PERSON_INVESTIGATION','GUARDIAN_LOCATION','BACKGROUND_LOCATION','EMERGENCY_EXTERNAL_ACTION')),
  constraint do_legal_approval_status_check check (approval_status in ('pending','approved','rejected','revoked','expired')),
  constraint do_legal_approval_evidence_check check (approval_status <> 'approved' or (decision_reference is not null and decision_checksum is not null and reviewer_class is not null and effective_at is not null)),
  constraint do_legal_approval_expiry_check check (expires_at is null or effective_at is null or expires_at > effective_at)
);

create table if not exists public.digital_observer_notice_versions (
  id uuid primary key default gen_random_uuid(),
  notice_key text not null,
  version integer not null,
  product_context text not null,
  jurisdiction text not null default 'IL',
  locale text not null default 'he-IL',
  content_checksum text not null,
  document_reference text not null,
  status text not null default 'draft',
  effective_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notice_key,version,locale),
  constraint do_notice_context_check check (product_context in ('HOME','SMALL_BUSINESS','ENTERPRISE','OEM_WHITE_LABEL','KINDERGARTEN','AUTHORIZED_INVESTIGATION','PERSONAL_SAFETY')),
  constraint do_notice_status_check check (status in ('draft','legal_review_pending','approved','retired')),
  constraint do_notice_activation_check check (status <> 'approved' or effective_at is not null)
);

create table if not exists public.digital_observer_notice_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  notice_version_id uuid not null references public.digital_observer_notice_versions(id) on delete restrict,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  acknowledgement_status text not null default 'acknowledged',
  displayed_at timestamptz not null,
  acknowledged_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  display_proof_hash text not null,
  created_at timestamptz not null default now(),
  unique(notice_version_id,observer_site_id,profile_id),
  constraint do_notice_ack_status_check check (acknowledgement_status in ('acknowledged','withdrawn')),
  constraint do_notice_ack_scope_check check (observer_site_id is not null),
  constraint do_notice_ack_withdraw_check check ((acknowledgement_status='withdrawn')=(withdrawn_at is not null))
);

create table if not exists public.digital_observer_privacy_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null unique,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  organization_id uuid references public.digital_observer_organizations(id) on delete set null,
  classification text not null,
  severity text not null,
  status text not null default 'reported',
  reported_by uuid references public.profiles(id) on delete set null,
  correlation_id uuid not null,
  containment_status text not null default 'not_started',
  notification_decision text not null default 'pending_legal_review',
  evidence_reference text,
  safe_summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint do_privacy_incident_class_check check (classification in ('confidentiality','integrity','availability','unauthorized_access','retention_failure','misdirected_notification','supplier_incident','suspected_breach')),
  constraint do_privacy_incident_severity_check check (severity in ('low','medium','high','critical')),
  constraint do_privacy_incident_status_check check (status in ('reported','triage','contained','investigating','notification_review','remediating','closed')),
  constraint do_privacy_notification_decision_check check (notification_decision in ('pending_legal_review','not_required','notify_data_subjects','notify_authority','notify_both'))
);

create table if not exists public.digital_observer_privacy_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  organization_id uuid references public.digital_observer_organizations(id) on delete set null,
  resource_type text not null,
  resource_id uuid,
  action text not null,
  authorization_decision text not null,
  result_status text not null,
  correlation_id uuid not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint do_privacy_audit_decision_check check (authorization_decision in ('allowed','denied','review_required')),
  constraint do_privacy_audit_result_check check (result_status in ('success','denied','failed','pending'))
);

create index if not exists do_privacy_profiles_site_idx on public.digital_observer_privacy_policy_profiles(observer_site_id,active,updated_at desc);
create index if not exists do_legal_approvals_profile_idx on public.digital_observer_legal_approvals(privacy_policy_profile_id,sensitive_capability,approval_status);
create index if not exists do_notice_ack_site_idx on public.digital_observer_notice_acknowledgements(observer_site_id,profile_id,acknowledged_at desc);
create index if not exists do_privacy_incidents_site_idx on public.digital_observer_privacy_incidents(observer_site_id,status,created_at desc);
create index if not exists do_privacy_audit_site_idx on public.digital_observer_privacy_audit_events(observer_site_id,created_at desc);
create index if not exists privacy_requests_observer_site_idx on public.privacy_rights_requests(observer_site_id,status,created_at desc) where observer_site_id is not null;
create index if not exists legal_holds_observer_site_idx on public.legal_holds(observer_site_id,status,review_due_at) where observer_site_id is not null;

alter table public.digital_observer_privacy_policy_profiles enable row level security;
alter table public.digital_observer_legal_approvals enable row level security;
alter table public.digital_observer_notice_versions enable row level security;
alter table public.digital_observer_notice_acknowledgements enable row level security;
alter table public.digital_observer_privacy_incidents enable row level security;
alter table public.digital_observer_privacy_audit_events enable row level security;

create policy "do privacy profiles scoped read" on public.digital_observer_privacy_policy_profiles for select to authenticated
  using ((observer_site_id is not null and public.can_access_observer_site(observer_site_id)) or (organization_id is not null and public.digital_observer_has_org_permission(organization_id,'audit.read',observer_site_id)));
create policy "do legal approvals manager read" on public.digital_observer_legal_approvals for select to authenticated
  using (exists (select 1 from public.digital_observer_privacy_policy_profiles p where p.id=privacy_policy_profile_id and ((p.observer_site_id is not null and public.can_manage_observer_site(p.observer_site_id)) or (p.organization_id is not null and public.digital_observer_has_org_permission(p.organization_id,'audit.read',p.observer_site_id)))));
create policy "do notice versions approved read" on public.digital_observer_notice_versions for select to authenticated using (status='approved' or public.is_admin());
create policy "do notice acknowledgements own read" on public.digital_observer_notice_acknowledgements for select to authenticated using (profile_id=auth.uid() and public.can_access_observer_site(observer_site_id));
create policy "do notice acknowledgements own insert" on public.digital_observer_notice_acknowledgements for insert to authenticated with check (profile_id=auth.uid() and public.can_access_observer_site(observer_site_id));
create policy "do notice acknowledgements own update" on public.digital_observer_notice_acknowledgements for update to authenticated
  using (profile_id=auth.uid() and public.can_access_observer_site(observer_site_id))
  with check (profile_id=auth.uid() and public.can_access_observer_site(observer_site_id));
create policy "do privacy incidents scoped read" on public.digital_observer_privacy_incidents for select to authenticated using ((observer_site_id is not null and public.can_manage_observer_site(observer_site_id)) or (organization_id is not null and public.digital_observer_has_org_permission(organization_id,'audit.read',observer_site_id)));
create policy "do privacy audit scoped read" on public.digital_observer_privacy_audit_events for select to authenticated using ((observer_site_id is not null and public.can_manage_observer_site(observer_site_id)) or (organization_id is not null and public.digital_observer_has_org_permission(organization_id,'audit.read',observer_site_id)));

create policy "privacy rights observer scope insert" on public.privacy_rights_requests as restrictive for insert to authenticated
  with check (observer_site_id is null or public.can_access_observer_site(observer_site_id));
create policy "privacy rights observer scope read" on public.privacy_rights_requests as restrictive for select to authenticated
  using (observer_site_id is null or public.can_access_observer_site(observer_site_id));
create policy "legal holds observer manager read" on public.legal_holds for select to authenticated
  using (observer_site_id is not null and public.can_manage_observer_site(observer_site_id));

revoke all on table public.digital_observer_privacy_policy_profiles, public.digital_observer_legal_approvals,
  public.digital_observer_notice_versions, public.digital_observer_notice_acknowledgements,
  public.digital_observer_privacy_incidents, public.digital_observer_privacy_audit_events from anon;
revoke insert,update,delete on table public.digital_observer_privacy_policy_profiles, public.digital_observer_legal_approvals,
  public.digital_observer_notice_versions, public.digital_observer_privacy_incidents,
  public.digital_observer_privacy_audit_events from authenticated;
grant select on table public.digital_observer_privacy_policy_profiles, public.digital_observer_legal_approvals,
  public.digital_observer_notice_versions, public.digital_observer_notice_acknowledgements,
  public.digital_observer_privacy_incidents, public.digital_observer_privacy_audit_events to authenticated;
grant insert on table public.digital_observer_notice_acknowledgements to authenticated;
grant update (acknowledgement_status,displayed_at,acknowledged_at,withdrawn_at,display_proof_hash)
  on table public.digital_observer_notice_acknowledgements to authenticated;
grant select on table public.legal_holds to authenticated;

create or replace function public.digital_observer_block_privacy_audit_mutation()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$ begin
  raise exception 'PRIVACY_AUDIT_APPEND_ONLY' using errcode='42501';
end $$;
drop trigger if exists do_privacy_audit_block_mutation on public.digital_observer_privacy_audit_events;
create trigger do_privacy_audit_block_mutation before update or delete on public.digital_observer_privacy_audit_events
for each row execute function public.digital_observer_block_privacy_audit_mutation();

insert into public.data_retention_policies
  (policy_key,data_category,title,retention_period_days,review_period_days,deletion_method,anonymization_method,legal_basis,owner_role,legal_hold_required,evidence_preservation_required,automatic_execution_allowed,parent_visible_allowed,status,metadata)
values
  ('do-event-alert-metadata','event_alert_metadata','Digital Observer Event and Alert metadata',null,90,'manual_review','redact_direct_identifiers','External legal decision required','privacy_owner',true,false,false,false,'needs_legal_review','{"push":45,"continuous_video":false}'::jsonb),
  ('do-evidence','observer_evidence','Digital Observer retained Evidence',null,30,'manual_review','delete_private_object_after_review','Case purpose and legal decision required','privacy_owner',true,true,false,false,'needs_legal_review','{"push":45,"private_storage_required":true}'::jsonb),
  ('do-source-recording-reference','source_recording_reference','Customer-held DVR/NVR/VMS source recording reference',null,30,'manual_review','remove_reference_only','Customer system remains authoritative','privacy_owner',true,true,false,false,'needs_legal_review','{"push":45,"external_data_not_owned":true}'::jsonb),
  ('do-location-data','location_data','Guardian and personal-safety location data',null,30,'manual_review','delete_after_verified_request','Explicit revocable permission and legal decision required','privacy_owner',true,false,false,false,'needs_legal_review','{"push":45,"activation_disabled":true}'::jsonb),
  ('do-biometric-template','biometric_template','Biometric and Re-ID template data',null,30,'manual_review','cryptographic_delete_after_review','Written scoped external approval required','privacy_owner',true,true,false,false,'needs_legal_review','{"push":45,"activation_disabled":true}'::jsonb)
on conflict (policy_key) do update set
  title=excluded.title, legal_basis=excluded.legal_basis, status='needs_legal_review', automatic_execution_allowed=false,
  updated_at=now(), metadata=public.data_retention_policies.metadata || excluded.metadata;

comment on table public.digital_observer_legal_approvals is 'Written external decisions only. Technical implementation, notice acknowledgement or consent never creates approval.';
comment on table public.digital_observer_privacy_policy_profiles is 'Versioned Tenant/Site policy scope; active profiles require EXTERNALLY_APPROVED state.';
comment on column public.privacy_rights_requests.external_system_disposition is 'Truthful per-system deletion/export state; an internal result never proves deletion from a DVR/NVR/VMS.';

notify pgrst, 'reload schema';
commit;
