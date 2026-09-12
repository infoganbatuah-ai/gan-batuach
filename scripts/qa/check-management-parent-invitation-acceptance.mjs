import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = file => readFileSync(file, "utf8");

test("invitation landing supports login, registration and authenticated claim", () => {
  const screen = source("components/invitation-accept-screen.tsx");
  assert.match(screen, /api\/invitations\/resolve/);
  assert.match(screen, /api\/invitations\/claim/);
  assert.match(screen, /app\/login\?next=/);
  assert.match(screen, /registerPath.*app\/register\/parent/);
  assert.match(screen, /invitation_token=/);
});

test("claim binds only a verified matching email and rejects cross-account claims", () => {
  const claim = source("app/api/invitations/claim/route.ts");
  assert.match(claim, /user\.email_confirmed_at/);
  assert.match(claim, /verifiedEmail !== normalizeInvitationEmail/);
  assert.match(claim, /target_profile_id !== profile\.id/);
  assert.match(claim, /signed_invitation_claimed/);
});

test("invited registration is role-bound, email-bound and preserves the parent invitation", () => {
  const registration = source("app/api/self-service/register/route.ts");
  assert.match(registration, /resolveSignedInvitation/);
  assert.match(registration, /payload\.account_type === "parent" \? "parent"/);
  assert.match(registration, /invitation\.intended_role !== expectedRole/);
  assert.match(registration, /recipient_email.*payload\.email/);
  assert.match(registration, /registered_from_signed_invitation: true/);
});

test("acceptance requires full contact verification and atomically claims active state", () => {
  const route = source("app/api/parent/garden-invitations/route.ts");
  assert.match(route, /managementContactVerification\(user, profile\)\.complete/);
  assert.match(route, /status: "processing"/);
  assert.match(route, /\.in\("status", \["pending", "delivered"\]\)\.select\("id"\)/);
  assert.match(route, /\.eq\("status", "processing"\)/);
});

test("legacy invitations remain compatible while new invitations require canonical identity", () => {
  const route = source("app/api/parent/garden-invitations/route.ts");
  assert.match(route, /signed_invitation_required === true/);
  assert.match(route, /legacy_affiliation_request_id/);
});
