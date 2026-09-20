// Read-only synthetic browser sweep of populated Management routes.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { config } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const require = createRequire(import.meta.url);
const playwright = require('/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
assert.ok(existsSync(chrome));
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const base = 'http://127.0.0.1:3000';
assert.equal((await fetch(`${base}/api/health`)).status, 200);
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);

const journeys = [
  ['parent-a', 'mobile', ['/dashboard/parent/payments', '/dashboard/parent/messages',
    '/dashboard/parent/documents', '/dashboard/parent/pickup', '/dashboard/parent/complaints']],
  ['staff-a', 'mobile', ['/dashboard/staff/shifts', '/dashboard/staff/tasks', '/dashboard/staff/messages']],
  ['manager-a', 'desktop', ['/dashboard/garden/operations', '/dashboard/garden/staff-time', '/dashboard/garden/tasks']],
  ['inspector-a', 'desktop', ['/dashboard/inspector/inspections', '/dashboard/inspector/tasks']],
  ['admin', 'desktop', ['/dashboard/admin/subscriptions', '/dashboard/admin/complaints']],
];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const results = [];
try {
  for (const [role, viewport, paths] of journeys) {
    const user = saved.users.find(item => item.email === `${role}@integration.qa.invalid`);
    assert.ok(user?.password);
    const jar = new Map();
    const auth = createServerClient(keys.url, keys.anon, {
      cookieOptions: { path: '/', sameSite: 'lax', secure: false },
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)) },
    });
    assert.equal((await auth.auth.signInWithPassword({ email: user.email, password: user.password })).error, null);
    const context = await browser.newContext({
      viewport: viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      locale: 'he-IL',
    });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: base })));
    for (const path of paths) {
      const page = await context.newPage();
      const errors = [];
      const serverErrors = [];
      page.on('pageerror', error => errors.push(error.name));
      page.on('response', response => { if (response.status() >= 500 && response.url().startsWith(base))
        serverErrors.push({ status: response.status(), path: new URL(response.url()).pathname }); });
      const response = await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(1000);
      const data = await page.evaluate(() => ({
        direction: document.documentElement.dir,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 8,
        unnamedButtons: [...document.querySelectorAll('button')].filter(button =>
          !button.textContent?.trim() && !button.getAttribute('aria-label') &&
          !button.getAttribute('title')).length,
      }));
      const result = { role, path, viewport, status: response?.status() ?? null,
        finalPath: new URL(page.url()).pathname, pageErrors: errors, serverErrors, ...data,
        pass: response?.status() === 200 && errors.length === 0 && serverErrors.length === 0 };
      results.push(result);
      console.log(JSON.stringify(result));
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-route-sweep.json',
  JSON.stringify({ observedAt: new Date().toISOString(), environment: config.environment,
    syntheticOnly: true, productionAccess: false, results }, null, 2) + '\n', { mode: 0o600 });
if (results.some(result => !result.pass)) process.exitCode = 1;
