// Synthetic, isolated Development browser QA for Owner-only onboarding entry and save/resume.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config, sql } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? '/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chrome = process.env.GB_M35_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.env.GB_M35_BASE_URL ?? 'http://127.0.0.1:3000';
const target = new URL(base);
assert.equal(target.hostname, '127.0.0.1');
assert.ok(['3000', '3001'].includes(target.port));
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(localCredentials().url, 'http://127.0.0.1:55421');
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(identities.environment, config.environment);
const owner = identities.users.find(item => item.email === 'owner-a@integration.qa.invalid');
assert.ok(owner?.password);

const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const results = [];
const errors = [];
const serverErrors = [];
let automaticLogout = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);
  page.on('pageerror', error => errors.push(error.name));
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/auth/logout') automaticLogout += 1;
  });
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 500) serverErrors.push({ path: new URL(response.url()).pathname, status: response.status() });
  });

  await page.goto(`${base}/app/login`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.locator('input[name=email]').fill(owner.email);
  await page.locator('input[name=password]').fill(owner.password);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 90_000 });
  assert.ok((await context.cookies()).some(cookie => cookie.name.startsWith('sb-')));
  results.push('Owner signed in through the real browser login');

  const entry = await page.goto(`${base}/onboarding/kindergarten?new=1`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  assert.equal(entry?.status(), 200);
  await page.waitForFunction(() => {
    const splash = document.querySelector('.branded-splash');
    return !splash || getComputedStyle(splash).pointerEvents === 'none';
  }, null, { timeout: 120_000 });
  assert.equal(automaticLogout, 0);
  results.push('Onboarding render does not prefetch logout');

  await page.locator('select[name=registrant_type]').selectOption('owner_only');
  await page.locator('input[name=kindergarten_name]').fill('GB-M35 QA Owner Journey D');
  await page.locator('select[name=city]').selectOption({ index: 1 });
  await page.locator('input[name=street]').fill('QA Synthetic Street');
  await page.locator('input[name=manager_id_number]').fill('000000000');
  await page.locator('input[name=manager_phone]').fill('0500000035');
  await page.locator('input[name=contact_phone]').fill('0500000035');
  await page.locator('.manager-registration-consent input[type=checkbox]').check();
  const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/garden/manager-application');
  await page.getByRole('button', { name: /התחלת הקמת הגן/ }).click();
  const created = await createdResponse;
  assert.ok([200, 201].includes(created.status()));
  const createdBody = await created.json();
  const gardenId = createdBody.data?.garden_id;
  assert.match(gardenId, /^[0-9a-f-]{36}$/i);
  await page.waitForURL(url => url.pathname === '/onboarding/kindergarten' && url.searchParams.get('gardenId') === gardenId, { timeout: 90_000 });
  assert.ok((await context.cookies()).some(cookie => cookie.name.startsWith('sb-')));
  assert.equal(automaticLogout, 0);
  results.push('Owner-only draft reuses one canonical Garden and reaches the wizard without sign-out');

  const record = sql(`select registrant_type from public.kindergarten_onboarding_records where garden_id='${gardenId}'`).trim();
  assert.equal(record, 'owner_only');
  results.push('Owner-only mode persisted without an automatic Teacher identity');
  assert.match(await page.locator('main').innerText(), /שלב 1 מתוך 5/);

  const marker = 'GB-M35 synthetic Owner save/resume marker';
  await page.locator('textarea[name=public_description]').fill(marker);
  const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/kindergarten-onboarding' && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /שמירת טיוטה/ }).click();
  assert.equal((await savedResponse).status(), 200);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
  assert.equal(await page.locator('textarea[name=public_description]').inputValue(), marker);
  assert.equal(automaticLogout, 0);
  results.push('Draft survives leave/reload and authentication remains active');

  assert.deepEqual(errors, []);
  assert.deepEqual(serverErrors, []);
  results.push('No browser exception or same-origin 500');
  await context.close();
} finally {
  await browser.close();
}
writeFileSync('/private/tmp/gb-m35-owner-onboarding-entry.json', JSON.stringify({ observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true, productionAccess: false, testedCommit: process.env.GB_M35_TESTED_COMMIT ?? null, results }, null, 2) + '\n', { mode: 0o600 });
console.log(`GB-M35 Owner onboarding entry PASS: ${results.length} checks`);
