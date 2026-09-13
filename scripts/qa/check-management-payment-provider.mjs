import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { evaluateFinancialProviderEvidence, normalizeFinancialEventType } from '../../lib/domain/financial-provider-policy.ts';
import { verifyLegacyHmacSignature } from '../../lib/domain/provider-webhook-signature.ts';

const read = path => readFileSync(path, 'utf8');
const webhook = read('lib/domain/provider-webhooks.ts');
const capability = read('lib/domain/financial-provider-capability.ts');
const admin = read('app/api/admin/provider-readiness/route.ts');
const publicReadiness = read('app/api/payment-provider/readiness/route.ts');

const evidence = { requestedMode: 'live', providerConfigured: true, credentialsPresent: true,
  credentialsVerified: false, webhookSecretPresent: true, webhookVerified: false, adapterVerified: false, liveEnabled: false };

test('environment variables cannot promote an unverified provider to live checkout', () => {
  assert.deepEqual(evaluateFinancialProviderEvidence(evidence), { state: 'not_configured', checkoutAvailable: false, liveChargesEnabled: false });
  assert.equal(evaluateFinancialProviderEvidence({ ...evidence, requestedMode: 'sandbox' }).checkoutAvailable, false);
  assert.equal(evaluateFinancialProviderEvidence({ ...evidence, credentialsVerified: true, webhookVerified: true, adapterVerified: true, liveEnabled: true }).state, 'live');
  assert.match(capability, /credentialsVerified: false/);
  assert.match(capability, /adapterVerified: false/);
});

test('financial events normalize without becoming payment proof', () => {
  assert.equal(normalizeFinancialEventType('payment_success'), 'payment_succeeded');
  assert.equal(normalizeFinancialEventType('receipt_created'), 'receipt_issued');
  assert.equal(normalizeFinancialEventType('arbitrary_paid'), 'unsupported');
});

test('forged or malformed webhook signatures are rejected before event parsing', () => {
  const body = '{"event_id":"test-event"}';
  const valid = createHmac('sha256', 'test-secret').update(body).digest('hex');
  assert.equal(verifyLegacyHmacSignature(body, `sha256=${valid}`, 'test-secret'), true);
  assert.equal(verifyLegacyHmacSignature(body, valid, 'test-secret'), true);
  assert.equal(verifyLegacyHmacSignature(body + ' ', valid, 'test-secret'), false);
  assert.equal(verifyLegacyHmacSignature(body, valid, 'wrong-secret'), false);
  assert.equal(verifyLegacyHmacSignature(body, 'sha256=xyz', 'test-secret'), false);
  assert.equal(verifyLegacyHmacSignature(body, valid, undefined), false);
});

test('generic webhook cannot settle subscriptions, tuition or invoices from payload IDs', () => {
  assert.match(webhook, /verifyLegacyHmacSignature\(rawBody, signatureHeader\(request\), guard.secret\)/);
  assert.ok(webhook.indexOf('verifyLegacyHmacSignature(rawBody, signatureHeader(request), guard.secret)') < webhook.indexOf('await assertRateLimit(ipFor(request)'), 'signature verification precedes rate-limit database writes');
  assert.match(webhook, /payload.provider !== configuredProvider/);
  assert.match(webhook, /side_effects_applied: false/);
  assert.doesNotMatch(webhook, /\.from\("kindergarten_subscriptions"/);
  assert.doesNotMatch(webhook, /\.from\("subscription_payments"/);
  assert.doesNotMatch(webhook, /\.from\("billing_invoices"/);
  assert.doesNotMatch(webhook, /\.from\("tuition_billing_periods"/);
  assert.doesNotMatch(webhook, /status: "replayed"/);
});

test('Admin readiness is authenticated and explicitly reports financial capability', () => {
  assert.match(admin, /if \(!user\) return fail\(.+, 401\)/);
  assert.match(admin, /profile.role !== "admin"/);
  assert.match(admin, /financialCapabilities: getFinancialProviderCapabilities\(\)/);
  assert.match(publicReadiness, /checkout_available: capability.payment.checkoutAvailable/);
  assert.doesNotMatch(publicReadiness, /credentialsPresent|webhookSecretPresent|process\.env/);
});
