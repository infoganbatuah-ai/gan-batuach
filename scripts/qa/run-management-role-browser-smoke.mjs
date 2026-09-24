// Browser smoke for the isolated, synthetic Development environment only.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { config } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const require = createRequire(import.meta.url);
const browserModule = [process.env.GB_M35_PLAYWRIGHT_MODULE, 'playwright',
  '/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright']
  .filter(Boolean).find(candidate => { try { require.resolve(candidate); return true; } catch { return false; } });
if (!browserModule) throw Error('Playwright runtime unavailable for GB-M35 browser QA');
const playwright = require(browserModule);
const chrome = process.env.GB_M35_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chrome)) throw Error('Installed local Chrome unavailable; no browser QA claim');
const base = 'http://127.0.0.1:3000';
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const versionResponse = await fetch(`${base}/api/development/version`, { signal: AbortSignal.timeout(15_000) });
assert.equal(versionResponse.status, 200);
const version = await versionResponse.json();
assert.equal(version.production, false);
assert.equal(version.backend, 'LOCAL_SUPABASE');
const users = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(users.environment, config.environment);

const journeys = [
  ['manager-a', '/dashboard/garden', 'desktop'],
  ['manager-b', '/dashboard/garden', 'desktop'],
  ['owner-a', '/dashboard/garden', 'desktop'],
  ['owner-ab', '/dashboard/garden', 'desktop'],
  ['owner-teacher', '/dashboard/garden', 'desktop'],
  ['parent-a', '/dashboard/parent', 'mobile'],
  ['parent-b', '/dashboard/parent', 'mobile'],
  ['parent-multi', '/dashboard/parent', 'mobile'],
  ['staff-a', '/dashboard/staff', 'mobile'],
  ['staff-ab', '/dashboard/staff', 'mobile'],
  ['delegated-teacher', '/dashboard/staff', 'desktop'],
  ['staff-candidate', '/dashboard/staff', 'desktop'],
  ['inspector-a', '/dashboard/inspector', 'desktop'],
  ['inspector-unassigned', '/dashboard/inspector', 'desktop'],
  ['inspector-suspended', '/dashboard/inspector', 'desktop'],
  ['admin', '/dashboard/admin', 'desktop'],
].filter(([name]) => !process.env.GB_M35_ROLE || name === process.env.GB_M35_ROLE);
const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: chrome,
});
const results = [];
try {
  for (const [name, path, viewport] of journeys) {
    const user = users.users.find(item => item.email === `${name}@integration.qa.invalid`);
    assert.ok(user, `Missing synthetic identity ${name}`);
    const jar = new Map();
    const client = createServerClient(keys.url, keys.anon, {
      cookieOptions: { path: '/', sameSite: 'lax', secure: false },
      cookies: {
        getAll: () => [...jar].map(([cookieName, value]) => ({ name: cookieName, value })),
        setAll: changes => changes.forEach(({ name: cookieName, value }) => jar.set(cookieName, value)),
      },
    });
    const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    assert.equal(login.error, null, `Synthetic login failed: ${name}`);
    const context = await browser.newContext({
      viewport: viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      locale: 'he-IL',
    });
    await context.addCookies([...jar].map(([cookieName, value]) => ({ name: cookieName, value, url: base })));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.name));
    const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(2500);
    const finalPath = new URL(page.url()).pathname;
    const containsGardenA = (await page.locator('body').innerText()).includes('QA Garden A');
    const expectedPath = finalPath === path ||
      (path === '/dashboard/garden' && finalPath === '/dashboard/garden/operations') ||
      (name === 'staff-candidate' && finalPath === '/dashboard/staff/job-market') ||
      (name.startsWith('inspector-') && name !== 'inspector-a' && finalPath === '/dashboard/inspector/apply');
    const privacyPass = !['inspector-unassigned', 'inspector-suspended'].includes(name) || !containsGardenA;
    const assignmentPass = name !== 'inspector-a' || finalPath === path;
    const result = {
      identity: name,
      path,
      viewport,
      status: response?.status() ?? null,
      finalPath,
      containsGardenA,
      pageErrors: errors,
      pass: response?.status() === 200 && expectedPath && privacyPass && assignmentPass && errors.length === 0,
    };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
    await client.auth.signOut();
  }
} finally {
  await browser.close();
}
const receipt = {
  observedAt: new Date().toISOString(),
  environment: config.environment,
  applicationCommit: version.commit,
  productionAccess: false,
  syntheticOnly: true,
  scope: 'dashboard navigation and browser runtime; not complete domain transactions',
  results,
};
const out = process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-browser-smoke.json';
writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
if (results.some(result => !result.pass)) process.exitCode = 1;
