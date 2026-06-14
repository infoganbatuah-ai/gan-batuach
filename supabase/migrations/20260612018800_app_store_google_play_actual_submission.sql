-- PHASE 188: App Store and Google Play actual submission preparation.
-- Controlled workflow only. No publishing, no upload, no signing secrets and no automatic store submission.

alter table public.mobile_release_readiness_scores drop constraint if exists mobile_release_status_check;
alter table public.mobile_release_readiness_scores add constraint mobile_release_status_check
  check (release_status in ('not_ready','preparing','internal_testing_ready','testflight_ready','google_internal_ready','store_review_ready','submitted','in_review','approved','rejected','released','blocked'));

alter table public.mobile_release_channels drop constraint if exists mobile_release_channel_status_check;
alter table public.mobile_release_channels add constraint mobile_release_channel_status_check
  check (status in ('not_ready','preparing','prepared','ready_for_test','internal_testing_ready','testflight_ready','google_internal_ready','submitted','in_review','approved','rejected','released','blocked','not_started'));

create table if not exists public.mobile_store_submission_status (
  id uuid primary key default gen_random_uuid(),
  status_key text not null unique,
  platform text not null check (platform in ('ios','android','all')),
  channel text not null check (channel in ('testflight','apple_app_review','google_internal_testing','google_closed_testing','google_production','all')),
  submission_status text not null default 'preparing' check (submission_status in ('not_ready','preparing','internal_testing_ready','testflight_ready','google_internal_ready','submitted','in_review','approved','rejected','released')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  build_uploaded boolean not null default false,
  signing_ready boolean not null default false,
  screenshots_ready boolean not null default false,
  metadata_ready boolean not null default false,
  privacy_disclosures_ready boolean not null default false,
  reviewer_notes_ready boolean not null default false,
  final_submit_approval boolean not null default false,
  release_owner text,
  blockers jsonb not null default '[]'::jsonb,
  submitted_at timestamptz,
  in_review_at timestamptz,
  approved_at timestamptz,
  released_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_store_submission_checklists (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  platform text not null check (platform in ('ios','android','all')),
  checklist_area text not null check (checklist_area in ('developer_account','build_signing','metadata','screenshots','privacy_labels','data_safety','reviewer_notes','demo_accounts','qa','legal_links','permissions','payments','camera_viewing','push','deep_links','final_approval')),
  checklist_item text not null,
  status text not null default 'preparing' check (status in ('not_ready','preparing','ready_for_review','approved','blocked','not_required')),
  required_for_submission boolean not null default true,
  owner text,
  evidence_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_store_release_risks (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  risk_category text not null check (risk_category in ('privacy_label_mismatch','data_safety_mismatch','permissions_issue','login_reviewer_issue','account_deletion_issue','camera_permission_issue','payment_issue','push_notification_issue','app_rejection','build_signing_issue')),
  platform text not null default 'all' check (platform in ('ios','android','all')),
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','in_progress','mitigated','accepted_risk','closed')),
  risk text not null,
  mitigation text not null,
  owner text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_store_rejection_history (
  id uuid primary key default gen_random_uuid(),
  rejection_key text not null unique,
  platform text not null check (platform in ('ios','android')),
  rejection_reason text not null,
  owner text,
  status text not null default 'open' check (status in ('open','fix_required','fixed','retested','resubmitted','closed')),
  required_fix text,
  reviewer_notes_updated boolean not null default false,
  retested_at timestamptz,
  resubmitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mobile_production_environment_audit (
  id uuid primary key default gen_random_uuid(),
  audit_key text not null unique,
  area text not null check (area in ('api_base_url','supabase_url','supabase_anon_key','service_role_absent','push_config','deep_links','camera_flags','payment_flags','app_mode','gan_batuach_israel_mode')),
  status text not null default 'preparing' check (status in ('not_ready','preparing','ready_for_review','approved','blocked')),
  public_config_only boolean not null default true,
  secret_exposure_risk boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'mobile_store_submission_status',
    'mobile_store_submission_checklists',
    'mobile_store_release_risks',
    'mobile_store_rejection_history',
    'mobile_production_environment_audit'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%I admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%I admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists idx_mobile_submission_status_platform on public.mobile_store_submission_status(platform, submission_status);
create index if not exists idx_mobile_submission_checklists_area on public.mobile_store_submission_checklists(platform, checklist_area, status);
create index if not exists idx_mobile_release_risks_status on public.mobile_store_release_risks(status, severity);
create index if not exists idx_mobile_rejection_history_status on public.mobile_store_rejection_history(platform, status);
create index if not exists idx_mobile_env_audit_status on public.mobile_production_environment_audit(area, status);

insert into public.mobile_release_readiness_scores (
  snapshot_key,
  ios_readiness,
  android_readiness,
  build_readiness,
  push_readiness,
  privacy_label_readiness,
  store_metadata_readiness,
  screenshot_readiness,
  overall_readiness,
  release_status,
  release_blockers,
  notes
) values (
  'mobile-actual-submission-baseline',
  61,
  64,
  50,
  58,
  46,
  52,
  30,
  51,
  'preparing',
  '["developer accounts must be verified","signing assets must be handled outside repo","privacy labels require final legal review","screenshots must be captured with synthetic data","final submit approval is missing"]'::jsonb,
  'Actual store submission workflow is prepared. No Apple or Google submission has been performed.'
) on conflict (snapshot_key) do update set
  ios_readiness = excluded.ios_readiness,
  android_readiness = excluded.android_readiness,
  build_readiness = excluded.build_readiness,
  push_readiness = excluded.push_readiness,
  privacy_label_readiness = excluded.privacy_label_readiness,
  store_metadata_readiness = excluded.store_metadata_readiness,
  screenshot_readiness = excluded.screenshot_readiness,
  overall_readiness = excluded.overall_readiness,
  release_status = excluded.release_status,
  release_blockers = excluded.release_blockers,
  notes = excluded.notes,
  calculated_at = now();

insert into public.mobile_store_submission_status (
  status_key, platform, channel, submission_status, readiness_score, blockers, notes
) values
  ('ios-testflight-submission', 'ios', 'testflight', 'preparing', 58, '["Apple Developer account verification","iOS signing certificate","TestFlight build upload approval"]'::jsonb, 'No TestFlight upload performed.'),
  ('ios-app-review-submission', 'ios', 'apple_app_review', 'not_ready', 45, '["privacy labels final review","screenshots final capture","reviewer notes final approval","final submit approval"]'::jsonb, 'Apple App Review is blocked until TestFlight and legal review are complete.'),
  ('android-internal-submission', 'android', 'google_internal_testing', 'preparing', 60, '["Google Play account verification","release signing key outside repo","internal tester group"]'::jsonb, 'No Google Play upload performed.'),
  ('android-closed-submission', 'android', 'google_closed_testing', 'not_ready', 48, '["internal testing feedback","closed tester group","data safety final review"]'::jsonb, 'Closed testing remains future step.'),
  ('android-production-submission', 'android', 'google_production', 'not_ready', 42, '["internal testing","closed testing if required","production final approval"]'::jsonb, 'Production release is not approved.'),
  ('mobile-overall-submission', 'all', 'all', 'preparing', 51, '["manual store setup required","no final approval"]'::jsonb, 'Submission package is prepared, but publishing is blocked.')
on conflict (status_key) do update set
  submission_status = excluded.submission_status,
  readiness_score = excluded.readiness_score,
  blockers = excluded.blockers,
  notes = excluded.notes,
  updated_at = now();

insert into public.mobile_store_submission_checklists (
  checklist_key, platform, checklist_area, checklist_item, status, owner, evidence_reference, notes
) values
  ('ios-developer-account', 'ios', 'developer_account', 'Apple Developer account exists and team access is verified', 'preparing', 'Release Owner', 'Apple Developer portal', 'Do not store Apple credentials in repo.'),
  ('ios-bundle-id', 'ios', 'build_signing', 'Bundle identifier selected and matches Capacitor/iOS project', 'ready_for_review', 'Mobile Owner', 'com.ganbatuach.app', 'Confirm final identifier before upload.'),
  ('ios-signing', 'ios', 'build_signing', 'Signing certificate and provisioning profile ready outside repository', 'not_ready', 'Mobile Owner', 'Xcode signing assets', 'Never commit certificates or private keys.'),
  ('ios-metadata', 'ios', 'metadata', 'App Store metadata Hebrew and English package reviewed', 'preparing', 'Marketing Owner', 'APP_STORE_GOOGLE_PLAY_METADATA_PACKAGE.md', 'Legal review still required.'),
  ('ios-privacy-labels', 'ios', 'privacy_labels', 'Apple privacy labels draft ready for final review', 'preparing', 'Privacy Owner', 'APPLE_APP_STORE_PRIVACY_LABELS_DRAFT.md', 'Do not submit until lawyer/product approval.'),
  ('ios-screenshots', 'ios', 'screenshots', 'iPhone and optional iPad screenshots captured with synthetic data', 'not_ready', 'Design Owner', 'mobile_screenshot_plan', 'No real children or private data.'),
  ('ios-review-notes', 'ios', 'reviewer_notes', 'Apple reviewer notes and demo account handling prepared', 'preparing', 'Release Owner', 'APP_REVIEW_NOTES_PACKAGE.md', 'No real passwords in docs.'),
  ('ios-final-approval', 'ios', 'final_approval', 'Final Apple submit approval recorded', 'not_ready', 'Admin Owner', 'mobile_store_submission_status', 'Manual approval required.'),
  ('android-developer-account', 'android', 'developer_account', 'Google Play Developer account exists and access is verified', 'preparing', 'Release Owner', 'Play Console', 'Do not store Google credentials in repo.'),
  ('android-application-id', 'android', 'build_signing', 'Android application ID selected and matches Capacitor/Gradle', 'ready_for_review', 'Mobile Owner', 'com.ganbatuach.app', 'Confirm final ID before upload.'),
  ('android-signing', 'android', 'build_signing', 'Release signing key ready outside repository', 'not_ready', 'Mobile Owner', 'Play App Signing / keystore', 'Never commit keystore secrets.'),
  ('android-data-safety', 'android', 'data_safety', 'Google Play Data Safety draft ready for final review', 'preparing', 'Privacy Owner', 'GOOGLE_PLAY_DATA_SAFETY_DRAFT.md', 'Needs legal/product validation.'),
  ('android-screenshots', 'android', 'screenshots', 'Phone/tablet screenshots captured with synthetic data', 'not_ready', 'Design Owner', 'mobile_screenshot_plan', 'No real camera feed.'),
  ('android-review-notes', 'android', 'reviewer_notes', 'Google reviewer notes and test instructions prepared', 'preparing', 'Release Owner', 'APP_REVIEW_NOTES_PACKAGE.md', 'Include role-based demo flow.'),
  ('android-final-approval', 'android', 'final_approval', 'Final Google submit approval recorded', 'not_ready', 'Admin Owner', 'mobile_store_submission_status', 'Manual approval required.'),
  ('all-account-deletion', 'all', 'legal_links', 'Account deletion and privacy request flow available from mobile app', 'ready_for_review', 'Privacy Owner', '/dashboard/privacy', 'Connects to Phase 156 privacy requests.'),
  ('all-payment-review', 'all', 'payments', 'Payment streams disclosed and raw card storage absent', 'ready_for_review', 'Finance Owner', 'payment provider tokenization', 'Gan Batuach, parent tuition and Digital Observer streams remain separate.'),
  ('all-camera-review', 'all', 'camera_viewing', 'Camera viewing limitations, native protections and audit logging documented', 'preparing', 'Camera Owner', 'APP_REVIEW_NOTES_PACKAGE.md', 'No RTSP or credential exposure.'),
  ('all-push-review', 'all', 'push', 'Push categories and preference handling reviewed', 'preparing', 'Mobile Owner', 'mobile_push_release_readiness', 'No raw AI alerts to parents.'),
  ('all-mobile-qa', 'all', 'qa', 'Final mobile QA checklist completed', 'not_ready', 'QA Owner', 'mobile_release_qa_checklist', 'Must pass before upload.')
on conflict (checklist_key) do update set
  status = excluded.status,
  evidence_reference = excluded.evidence_reference,
  notes = excluded.notes,
  updated_at = now();

insert into public.mobile_store_release_risks (
  risk_key, risk_category, platform, severity, status, risk, mitigation, owner, due_date
) values
  ('risk-privacy-label-mismatch', 'privacy_label_mismatch', 'ios', 'high', 'open', 'Apple privacy labels may not match actual collected data.', 'Finalize labels with privacy/legal review before submit.', 'Privacy Owner', current_date + 14),
  ('risk-data-safety-mismatch', 'data_safety_mismatch', 'android', 'high', 'open', 'Google Data Safety answers may not match product behavior.', 'Validate data categories, sharing and deletion flows.', 'Privacy Owner', current_date + 14),
  ('risk-permission-issue', 'permissions_issue', 'all', 'medium', 'open', 'Store review may question location/camera/photos permissions.', 'Provide permission rationale and request only required permissions.', 'Mobile Owner', current_date + 10),
  ('risk-reviewer-login', 'login_reviewer_issue', 'all', 'medium', 'open', 'Reviewer may fail to access role-based flows.', 'Prepare stable synthetic demo accounts and clear notes.', 'Release Owner', current_date + 7),
  ('risk-account-deletion', 'account_deletion_issue', 'all', 'high', 'open', 'Account deletion request flow may be hard to find.', 'Expose privacy request/account deletion path in mobile settings.', 'Privacy Owner', current_date + 10),
  ('risk-camera-permission', 'camera_permission_issue', 'all', 'medium', 'open', 'Camera viewing may be misunderstood as unrestricted surveillance.', 'Document role-scoped, tokenized, audited viewing and Gan Batuach Israel Mode restrictions.', 'Camera Owner', current_date + 14),
  ('risk-payment-review', 'payment_issue', 'all', 'medium', 'open', 'Payment flows may be confused across revenue streams.', 'Document tokenization and stream separation in reviewer notes.', 'Finance Owner', current_date + 14),
  ('risk-push-notification', 'push_notification_issue', 'all', 'medium', 'open', 'Push notification categories may imply raw AI or panic alerts.', 'Use reviewed categories and no raw AI parent alerts.', 'Mobile Owner', current_date + 10),
  ('risk-build-signing', 'build_signing_issue', 'all', 'high', 'open', 'Signing assets are not prepared or may be mishandled.', 'Keep signing credentials outside repo and verify release build locally.', 'Mobile Owner', current_date + 21)
on conflict (risk_key) do update set
  mitigation = excluded.mitigation,
  due_date = excluded.due_date,
  updated_at = now();

insert into public.mobile_production_environment_audit (
  audit_key, area, status, public_config_only, secret_exposure_risk, notes
) values
  ('mobile-api-base-url', 'api_base_url', 'ready_for_review', true, false, 'Mobile shell should use approved production or staging app URL.'),
  ('mobile-supabase-url', 'supabase_url', 'ready_for_review', true, false, 'Only public Supabase URL may be bundled.'),
  ('mobile-supabase-anon', 'supabase_anon_key', 'ready_for_review', true, false, 'Only anon/publishable key may be bundled.'),
  ('mobile-service-role-absent', 'service_role_absent', 'ready_for_review', false, false, 'Service role key must never appear in mobile bundle.'),
  ('mobile-push-config', 'push_config', 'preparing', true, false, 'FCM/APNs/Web Push config requires store build testing.'),
  ('mobile-deep-links', 'deep_links', 'preparing', true, false, 'Deep links must enforce auth and permissions.'),
  ('mobile-camera-flags', 'camera_flags', 'preparing', true, false, 'Camera viewing flags remain policy gated.'),
  ('mobile-payment-flags', 'payment_flags', 'preparing', true, false, 'Live payments require provider mode and explicit approval.'),
  ('mobile-app-mode', 'app_mode', 'ready_for_review', true, false, 'Production/staging mode must be visible in release process.'),
  ('mobile-gan-batuach-israel-mode', 'gan_batuach_israel_mode', 'ready_for_review', true, false, 'No audio monitoring and no face recognition for kindergarten mode.')
on conflict (audit_key) do update set
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.mobile_store_rejection_history (
  rejection_key, platform, rejection_reason, owner, status, required_fix
) values
  ('placeholder-ios-rejection-workflow', 'ios', 'No rejection yet. Placeholder defines Apple rejection handling workflow.', 'Release Owner', 'closed', 'Log reason, assign owner, fix, retest and resubmit.'),
  ('placeholder-android-rejection-workflow', 'android', 'No rejection yet. Placeholder defines Google rejection handling workflow.', 'Release Owner', 'closed', 'Log reason, assign owner, fix, retest and resubmit.')
on conflict (rejection_key) do update set
  required_fix = excluded.required_fix,
  updated_at = now();

insert into public.mobile_release_channels (channel_key, platform, channel_name, status, release_stage, notes)
values
  ('ios-testflight-actual-submit', 'ios', 'TestFlight Actual Submission', 'preparing', 'testflight', 'Do not upload unless signing assets and final approval are available.'),
  ('ios-app-store-actual-submit', 'ios', 'Apple App Store Actual Submission', 'not_ready', 'app_review', 'Blocked until metadata, privacy labels, screenshots, reviewer notes and build upload are approved.'),
  ('android-internal-actual-submit', 'android', 'Google Internal Testing Actual Submission', 'preparing', 'google_internal_testing', 'Do not upload unless Play signing and tester group are ready.'),
  ('android-closed-actual-submit', 'android', 'Android Closed Testing Actual Submission', 'not_ready', 'google_closed_testing', 'Blocked until internal testing feedback is reviewed.'),
  ('android-production-actual-submit', 'android', 'Google Play Production Actual Submission', 'not_ready', 'production_release', 'Blocked until final admin approval.')
on conflict (channel_key) do update set
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

comment on table public.mobile_store_submission_status is 'Actual App Store and Google Play submission status. Does not perform upload, publication or release.';
comment on table public.mobile_store_submission_checklists is 'Store submission checklists for Apple, TestFlight, Google internal testing, closed testing and production release.';
comment on table public.mobile_store_release_risks is 'Mobile store release risk register covering privacy labels, data safety, permissions, reviewer login, account deletion, camera, payment, push, rejection and signing risks.';
comment on table public.mobile_store_rejection_history is 'Rejection handling workflow and history for Apple and Google reviews.';
comment on table public.mobile_production_environment_audit is 'Mobile production environment audit ensuring public-only configuration and no server secret exposure.';

notify pgrst, 'reload schema';
