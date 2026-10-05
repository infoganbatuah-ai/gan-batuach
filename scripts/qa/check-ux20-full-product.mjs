import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const reportPath = resolve(root, "qa-evidence/ux-implement-20/owner-pack/visual-qa-report.json");
const manifestPath = resolve(root, "qa-evidence/ux-implement-20/owner-pack/evidence-manifest.json");

test("UX-20 owner pack covers the full Desktop and Mobile inventory", () => {
  assert.ok(existsSync(reportPath));
  assert.ok(existsSync(manifestPath));
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(report.environment, "DEVELOPMENT / INTEGRATION");
  assert.equal(report.totalScreenConcepts, 326);
  assert.equal(report.totalDesktopScreenshots, 326);
  assert.equal(report.totalMobileScreenshots, 326);
  assert.equal(report.totalScreenshots, 652);
  assert.equal(report.references.length, 19);
  assert.equal(report.inventory.length, 326);
  assert.equal(manifest.files.length, 652);
  assert.equal(new Set(report.inventory.map((item) => item.id)).size, 326);
  assert.equal(report.inventory.every((item) => item.status === "OWNER_REVIEW_READY"), true);
  assert.equal(report.inventory.every((item) => item.materialDeviations === "none material"), true);
  for (const item of report.inventory) {
    assert.ok(existsSync(resolve(root, item.desktop)), `Missing Desktop evidence for ${item.id}`);
    assert.ok(existsSync(resolve(root, item.mobile)), `Missing Mobile evidence for ${item.id}`);
    assert.ok(item.route);
    assert.ok(item.role);
    assert.ok(item.reference);
  }
});

test("UX-20 final status vocabulary contains no unresolved visual classifications", () => {
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.deepEqual(report.counts, {
    ownerReviewReady: 652,
    needsPolish: 0,
    visualDrift: 0,
    visualPartial: 0,
    visualFail: 0,
    broken: 0
  });
  assert.equal(report.productionAccess, false);
  assert.equal(report.digitalObserverCoreDiff, 0);
});

test("notification preference controls stay bounded inside the responsive layout", () => {
  const css = readFileSync(resolve(root, "app/globals.css"), "utf8");
  assert.match(css, /\.delivery-channel-toggle input\s*\{[^}]*inset:\s*0;[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.match(css, /\.notification-category-toggle\s*\{[^}]*position:\s*relative;/s);
  assert.match(css, /\.notification-category-toggle\s*>\s*input\s*\{[^}]*width:\s*38px;[^}]*height:\s*22px;/s);
});

test("owner-facing evidence index and required closure artifacts are present", () => {
  for (const path of [
    "qa-evidence/ux-implement-20/owner-pack/index.html",
    "qa-evidence/ux-implement-20/owner-pack/boards/reference-comparison-board.webp",
    "GAN_BATUACH_UX20_FULL_PRODUCT_VISUAL_REGRESSION.md",
    "GAN_BATUACH_UX20_OWNER_ACCEPTANCE_INDEX.md"
  ]) assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
});
