// Synthetic, isolated Development visual QA for UX-IMPLEMENT-02.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? '/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp = require('sharp');
const chrome = process.env.GB_M35_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.env.GB_M35_BASE_URL ?? 'http://127.0.0.1:3001';
const target = new URL(base);
assert.equal(target.hostname, '127.0.0.1');
assert.ok(['3000', '3001'].includes(target.port));
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(localCredentials().url, 'http://127.0.0.1:55421');
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
const owner = identities.users.find(item => item.email === 'owner-ab@integration.qa.invalid');
assert.ok(owner?.password);

const evidenceRoot = resolve('qa-evidence/ux-implement-02');
const screenshotRoot = resolve(evidenceRoot, 'screenshots');
mkdirSync(screenshotRoot, { recursive: true });

const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const captures = [];
const consoleErrors = [];
const serverErrors = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });

async function screenshot(page, name, viewport, selector) {
  await page.setViewportSize(viewport);
  if (selector) {
    const targetLocator = page.locator(selector).first();
    await targetLocator.waitFor({ state: 'visible' });
    await targetLocator.scrollIntoViewIfNeeded();
  } else {
    await page.evaluate(() => scrollTo(0, 0));
  }
  await page.waitForTimeout(250);
  const png = await page.screenshot({ fullPage: false, animations: 'disabled' });
  const path = resolve(screenshotRoot, `${name}.webp`);
  await sharp(png).webp({ quality: 84, effort: 5 }).toFile(path);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${name} has horizontal overflow`);
  captures.push({ name, viewport: `${viewport.width}x${viewport.height}`, selector: selector ?? 'page-top', path: path.replace(`${process.cwd()}/`, '') });
}

async function capturePair(page, name, selector) {
  await screenshot(page, `${name}-desktop`, desktop, selector);
  await screenshot(page, `${name}-mobile`, mobile, selector);
  await page.setViewportSize(desktop);
}

try {
  const context = await browser.newContext({ viewport: desktop, locale: 'he-IL', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(90_000);
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 500) serverErrors.push({ path: new URL(response.url()).pathname, status: response.status() });
  });

  await page.goto(`${base}/app/login`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.locator('input[name=email]').fill(owner.email);
  await page.locator('input[name=password]').fill(owner.password);
  await page.getByRole('button', { name: 'התחברות' }).click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 90_000 });

  const entry = await page.goto(`${base}/onboarding/kindergarten?new=1`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  assert.equal(entry?.status(), 200);
  await page.waitForFunction(() => {
    const splash = document.querySelector('.branded-splash');
    return !splash || getComputedStyle(splash).pointerEvents === 'none';
  }, null, { timeout: 120_000 });
  await page.getByRole('heading', { name: 'ברוכה הבאה למסע הקמת הגן' }).waitFor();
  await capturePair(page, 'entry', undefined);

  await page.locator('input[name=registrant_type][value=owner_teacher]').check();
  await capturePair(page, 'role-mode', '.manager-role-mode-grid');
  const suffix = Date.now().toString().slice(-6);
  await page.locator('input[name=kindergarten_name]').fill(`גן חזותי UX02 ${suffix}`);
  await page.locator('select[name=city]').selectOption('תל אביב-יפו');
  await page.locator('input[name=street]').fill('רחוב הבדיקה 12');
  await page.locator('input[name=address_details]').fill('קומה 1');
  await page.locator('input[name=manager_id_number]').fill('000000204');
  await page.locator('input[name=manager_phone]').fill('0500000204');
  await page.locator('input[name=contact_phone]').fill('0500000204');
  await page.locator('textarea[name=opening_hours]').fill('א׳–ה׳ 07:30–16:30');
  await page.locator('textarea[name=public_description]').fill('גן סינתטי עשיר לבדיקת חוויית ההקמה בלבד.');
  await page.locator('.manager-registration-consent input[type=checkbox]').check();
  const createResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/garden/manager-application' && response.request().method() === 'POST');
  await page.getByRole('button', { name: /התחלת הקמת הגן/ }).click();
  assert.ok([200, 201].includes((await createResponse).status()));
  await page.waitForURL(url => url.pathname === '/onboarding/kindergarten' && Boolean(url.searchParams.get('gardenId')), { timeout: 90_000 });

  await page.locator('textarea[name=documents_summary]').fill('רישיון עסק ואישורי בטיחות קיימים; אישור כבאות בהשלמה.');
  await page.locator('.manager-document-checks input').nth(0).check();
  await page.locator('.manager-document-checks input').nth(5).check();
  await capturePair(page, 'garden-details', '.manager-stage-heading');
  await capturePair(page, 'documents', '.manager-docs-card');

  let saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/kindergarten-onboarding' && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /שמירה והמשך/ }).click();
  assert.equal((await saveResponse).status(), 200);
  await page.getByRole('heading', { name: 'שלב 2 מתוך 5' }).waitFor();
  await page.locator('.manager-group-choice input').nth(0).check();
  await page.locator('.manager-group-choice input').nth(1).check();
  await page.locator('.manager-age-groups article').nth(0).locator('input[type=number]').nth(0).fill('12');
  await page.locator('.manager-age-groups article').nth(0).locator('input[type=number]').nth(1).fill('2');
  await page.locator('input[name=camera_readiness][value=needs_setup]').check();
  await page.locator('input[name=staff_initialized]').check();
  await capturePair(page, 'classrooms', '.manager-age-groups');
  await capturePair(page, 'staff', '.manager-staff-summary');
  await capturePair(page, 'safety', '.manager-safety-readiness');

  saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/kindergarten-onboarding' && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /שמירה והמשך/ }).click();
  assert.equal((await saveResponse).status(), 200);
  await page.getByRole('heading', { name: 'שלב 3 מתוך 5' }).waitFor();
  await capturePair(page, 'subscription', '.manager-payment-layout');

  saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/kindergarten-onboarding' && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /שמירה והמשך/ }).click();
  assert.equal((await saveResponse).status(), 200);
  await page.getByRole('heading', { name: 'שלב 4 מתוך 5' }).waitFor();
  await page.locator('input[name=children_initialized]').check();
  await page.locator('input[name=parents_invited]').check();
  await capturePair(page, 'children-parent-invitations', '.manager-parent-invitation-panel');

  saveResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/kindergarten-onboarding' && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /שמירה והמשך/ }).click();
  assert.equal((await saveResponse).status(), 200);
  await page.getByRole('heading', { name: 'שלב 5 מתוך 5' }).waitFor();
  await capturePair(page, 'review', '.manager-review-summary');

  await page.locator('.manager-registration-consent input[type=checkbox]').check();
  const activationResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/kindergarten-onboarding' && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: /התחלת ניסיון וכניסה לדשבורד/ }).click();
  assert.equal((await activationResponse).status(), 200);
  await page.getByRole('heading', { name: /מוכן להפעלה/ }).waitFor({ timeout: 90_000 });
  await capturePair(page, 'success', '.manager-activation-success');

  assert.deepEqual(serverErrors, []);
  assert.deepEqual(consoleErrors, []);
  writeFileSync(resolve(evidenceRoot, 'results.json'), `${JSON.stringify({
    environment: config.environment,
    base,
    capturedAt: new Date().toISOString(),
    viewports: { desktop, mobile },
    persona: 'synthetic multi-Garden Owner + Teacher',
    captures,
    serverErrors,
    consoleErrors,
    status: 'PASS'
  }, null, 2)}\n`);
  console.log(`UX-IMPLEMENT-02 visual capture PASS: ${captures.length} screenshots`);
} finally {
  await browser.close();
}
