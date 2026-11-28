-- REVIEW-ONLY SQL. Never apply as a migration until app-identity proof and
-- provider-specific token binding have been independently qualified.
-- Existing push_device_tokens are intentionally NOT backfilled or reclassified.
create schema push_private;
revoke all on schema push_private from public, anon, authenticated;
grant usage on schema push_private to service_role;

create table push_private.device_product_bindings (
  device_token_id uuid primary key references public.push_device_tokens(id) on delete restrict,
  product_audience text not null check (product_audience in ('gan_management', 'digital_observer')),
  verified_app_id text not null check (length(verified_app_id) between 8 and 160),
  binding_method text not null check (binding_method in ('native_device_proof', 'provider_app_identity')),
  evidence_sha256 text not null check (evidence_sha256 ~ '^[0-9a-f]{64}$'),
  bound_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint device_product_bindings_expiry_check check (expires_at > bound_at)
);

alter table push_private.device_product_bindings enable row level security;
revoke all on push_private.device_product_bindings from public, anon, authenticated;
grant select, insert, update on push_private.device_product_bindings to service_role;

create index device_product_bindings_active_audience_idx
  on push_private.device_product_bindings (product_audience, expires_at)
  where revoked_at is null;

comment on table push_private.device_product_bindings is
  'Server-verified app audience only. No client metadata, legacy token, or email-only claim may create a binding.';
