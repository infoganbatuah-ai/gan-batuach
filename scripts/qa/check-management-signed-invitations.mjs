import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = file => readFileSync(file, "utf8");

test("canonical invitation storage persists digests and lifecycle state", () => {
  const migration = source("supabase/migrations/20260910010000_management_signed_invitations.sql");
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /recipient_fingerprint text not null/);
  assert.match(migration, /'superseded'/);
  assert.match(migration, /enable row level security/);
  assert.doesNotMatch(migration, /token text/);
});

test("tokens use HMAC, constant-time verification, expiry and one-way storage", () => {
  const service = source("lib/management/signed-invitation.ts");
  assert.match(service, /createHmac\("sha256"/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /hashInvitationToken\(signed\.token\)/);
  assert.match(service, /status: "expired"/);
  assert.match(service, /MANAGEMENT_INVITATION_SECRET/);
});

test("parent invitation no longer provisions an account or temporary password", () => {
  const route = source("app/api/garden/parent-invitations/route.ts");
  assert.match(route, /createSignedInvitation/);
  assert.match(route, /signed_invitation_required: true/);
  assert.doesNotMatch(route, /provisionAuthUser|temporary_password|generated_credentials/);
});

test("delivery logs never persist the invitation URL or raw token", () => {
  const delivery = source("lib/management/invitation-delivery.ts");
  const logInsert = delivery.slice(delivery.indexOf('admin.from("email_delivery_logs")'));
  assert.match(logInsert, /contains_secret: false/);
  assert.doesNotMatch(logInsert, /input\.url/);
});

test("public resolution returns a minimal safe projection", () => {
  const route = source("app/api/invitations/resolve/route.ts");
  assert.match(route, /handleSafeRouteError/);
  assert.match(route, /maskEmail/);
  assert.doesNotMatch(route, /payload:/);
  assert.doesNotMatch(route, /recipient_phone:/);
});

test("revocation is garden-scoped and audited", () => {
  const route = source("app/api/management/invitations/[id]/route.ts");
  assert.match(route, /getManagementGardenContext/);
  assert.match(route, /\.eq\("garden_id", gardenId\)/);
  assert.match(route, /signed_invitation_revoked/);
  assert.match(route, /status: "revoked"/);
});
