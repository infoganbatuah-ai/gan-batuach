// Run against a prepared, disposable q669 stack only. The operator owns stack startup and rollback.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

const product = "http://127.0.0.1:39868";
const api = "http://127.0.0.1:39869";
const savePath = "/api/digital-observer/onboarding";
const result = {};

async function run() {
  const [credentialsPath, outputPath] = process.argv.slice(2);
  assert.ok(credentialsPath && outputPath, "Supply a private synthetic credential file and a new evidence path");
  const stat = fs.statSync(credentialsPath);
  assert.equal(stat.mode & 0o077, 0, "Fixture credentials must be private");
  const accounts = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  assert.equal(accounts.length, 2);
  assert.notEqual(accounts[0].email, accounts[1].email);
  for (const account of accounts) {
    assert.match(account.email, /^q669-product-(owner|second)-[0-9a-f]+@qa\.invalid$/);
  }
  const { chromium } = require(process.env.Q669_PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch({
    executablePath: process.env.Q669_CHROME,
    headless: true,
    args: ["--disable-background-networking", "--disable-component-update", "--disable-sync",
      "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"]
  });
  async function signIn(account) {
    const context = await browser.newContext();
    await context.route("**/*", route => {
      const origin = new URL(route.request().url()).origin;
      return origin === product || origin === api ? route.continue() : route.abort();
    });
    const response = await context.request.post(product + "/api/digital-observer/auth/login", {
      form: { email: account.email, password: account.password, next: "/digital-observer/onboarding" },
      maxRedirects: 0, timeout: 120000
    });
    assert.equal(response.status(), 303);
    const target = new URL(response.headers().location, product);
    assert.equal(target.origin, product);
    assert.equal(target.searchParams.has("error"), false);
    return context;
  }

  try {
    const owner = await signIn(accounts[0]);
    const nonowner = await signIn(accounts[1]);
    const page = await owner.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(product + "/digital-observer/onboarding", { waitUntil: "domcontentloaded", timeout: 150000 });
    await page.getByRole("heading", { name: "הגדרת הבית שלך", exact: true }).waitFor();
    const next = page.getByRole("button", { name: "המשך", exact: true });
    await next.click();
    const name = "QA Home " + randomUUID();
    await page.getByLabel("שם הבית", { exact: true }).fill(name);
    for (const [label, value] of [["עיר", "QA City"], ["רחוב", "QA Street"], ["מספר בניין", "7"]]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    await next.click();
    await next.click();
    await page.locator(".do-plan-grid label").first().click();
    const submitted = page.waitForResponse(r => r.url() === product + savePath && r.request().method() === "POST");
    await page.getByRole("button", { name: /התחלת 14 ימי ניסיון והמשך/ }).click();
    const saved = await submitted;
    assert.equal(saved.status(), 201);
    const payload = saved.request().postDataJSON();
    const original = await saved.json();
    const id = original.data.site.id;
    assert.match(id, /^[\da-f-]{36}$/i);
    const post = (ctx, data) => ctx.request.post(product + savePath, { data, maxRedirects: 0 });
    const missing = await post(owner, { ...payload, submission_id: randomUUID(), package_id: null, name: "Q669 missing package" });
    assert.equal(missing.status(), 400);
    const replay = await post(owner, payload);
    assert.equal(replay.status(), 201);
    assert.deepEqual(await replay.json(), original);
    const denied = await post(nonowner, { ...payload, submission_id: randomUUID(), observer_site_id: id });
    assert.equal(denied.status(), 403);
    const detail = product + "/digital-observer/sites/" + id;
    await page.goto(detail, { waitUntil: "domcontentloaded", timeout: 120000 });
    const title = page.getByRole("heading", { name, exact: true }).first();
    await title.waitFor();
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await title.waitFor();
    const otherPage = await nonowner.newPage();
    const hidden = await otherPage.goto(detail, { waitUntil: "networkidle", timeout: 120000 });
    assert.equal(await otherPage.getByRole("heading", { name, exact: true }).count(), 0);
    assert.ok(hidden.status() === 404 || (await otherPage.content()).includes("NEXT_HTTP_ERROR_FALLBACK;404"));
    for (let i = 0; i < 3; i++) {
      await page.goto(product + "/digital-observer/alerts", { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.getByText("אין אירועים להצגה", { exact: true }).first().waitFor();
    }
    Object.assign(result, { saveHTTP: saved.status(), replayHTTP: replay.status(), identicalReplay: true,
      missingPackageHTTP: missing.status(), nonownerEditHTTP: denied.status(), ownerReload: true,
      nonownerReadHTTP: hidden.status(), nonownerDetailHidden: true, alertsEmptyAfterThreeLoads: true });
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  } finally {
    await browser.close();
  }
}
run().catch(error => {
  console.error(error.name + ": browser qualification failed");
  process.exitCode = 1;
});
