// Interactive mobile Parent discovery/Child context smoke on synthetic local Development only.
import assert from 'node:assert/strict';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServerClient} from '@supabase/ssr';
import {config} from '../development/local-database.mjs';
import {localCredentials} from '../development/local-client.mjs';

const require = createRequire(import.meta.url);
const browserModule = [process.env.GB_M35_PLAYWRIGHT_MODULE, 'playwright',
  '/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright']
  .filter(Boolean).find(candidate => { try { require.resolve(candidate); return true; } catch { return false; } });
if (!browserModule) throw Error('Playwright unavailable');
const playwright = require(browserModule);
const chrome = process.env.GB_M35_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chrome)) throw Error('Chrome unavailable');
const base = 'http://127.0.0.1:3000';
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
assert.equal((await fetch(`${base}/api/health`)).status, 200);
const users = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(users.environment, config.environment);
const user = users.users.find(item => item.email === 'parent-multi@integration.qa.invalid');
assert.ok(user?.password);
const jar = new Map();
const client = createServerClient(keys.url, keys.anon, {
  cookieOptions: {path: '/', sameSite: 'lax', secure: false},
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({name, value})),
    setAll: changes => changes.forEach(({name, value}) => jar.set(name, value)),
  },
});
assert.equal((await client.auth.signInWithPassword({email: user.email, password: user.password})).error, null);
const browser = await playwright.chromium.launch({headless: true, executablePath: chrome});
const results = [];
const pageErrors = [];
const serverErrors = [];
try {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, locale: 'he-IL'});
  await context.addCookies([...jar].map(([name, value]) => ({name, value, url: base})));
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.name));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) serverErrors.push({path: new URL(response.url()).pathname, status: response.status()}); });
  const discovery = await page.goto(`${base}/dashboard/parent/discover-kindergartens`, {waitUntil: 'domcontentloaded', timeout: 90_000});
  assert.equal(discovery?.status(), 200);
  results.push({name: 'Mobile discovery loaded', pass: true});
  const picker = page.locator('select[name="child"]');
  const options = await picker.locator('option').evaluateAll(nodes => nodes.map(node => ({value: node.value, label: node.textContent})));
  assert.ok(options.some(option => option.label?.includes('QA Child B')));
  assert.ok(options.some(option => option.label?.includes('QA Child C')));
  assert.ok(!options.some(option => option.label?.includes('QA Child A')));
  results.push({name: 'Only authorized Children in picker', pass: true});
  for (const [childId, childName] of [
    ['00000000-0000-4000-8000-000000000803', 'QA Child C'],
    ['00000000-0000-4000-8000-000000000802', 'QA Child B'],
  ]) {
    await picker.selectOption(childId);
    await page.getByRole('button', {name: 'חיפוש'}).click();
    await page.waitForURL(url => url.searchParams.get('child') === childId, {timeout: 30_000});
    assert.match(await page.locator('main').last().innerText(), new RegExp(`התאמות עבור ${childName}`));
    results.push({name: `Interactive Child switch to ${childName}`, pass: true});
  }
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  results.push({name: 'Mobile RTL and no horizontal overflow', pass: true});
  await page.getByRole('link', {name: 'דשבורד'}).first().click();
  await page.waitForURL('**/dashboard/parent');
  await page.locator('a[href="/dashboard/parent/payments"]').first().click();
  await page.waitForURL('**/dashboard/parent/payments');
  await page.getByText('חיובים לפי ילד').first().waitFor({state: 'visible', timeout: 30_000});
  assert.match(await page.locator('body').innerText(), /תשלומ/);
  results.push({name: 'Payment navigation works after context switch', pass: true});
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(serverErrors, []);
  results.push({name: 'No page exception or same-origin 500', pass: true});
  await context.close();
} finally {
  await browser.close();
}
writeFileSync('/private/tmp/gb-m35-parent-mobile-interaction.json', JSON.stringify({observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true, productionAccess: false, viewport: '390x844', results}, null, 2) + '\n', {mode: 0o600});
console.log(`GB-M35 Parent mobile interaction PASS: ${results.length} checks`);
