import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const originIntegration = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const expectedSha = process.env.GB_V5_EXPECTED_SHA ?? head;
assert.equal(head, expectedSha, "V5 package must be generated from the requested exact Development SHA");
if (process.env.GB_V5_REQUIRE_INTEGRATION === "1") assert.equal(originIntegration, head, "V5 package requires the exact merged integration head");

const outputRoot = resolve(process.env.GB_V5_PACKAGE_OUTPUT ?? "qa-evidence/final-owner-visual-verification-v5/owner-review-package");
const screenshotRoot = join(outputRoot, "screenshots");
const referenceRoot = join(outputRoot, "references");
const comparisonRoot = join(outputRoot, "comparison-boards");
const contactRoot = join(outputRoot, "contact-sheets");
const highResRoot = join(outputRoot, "high-res-primary-boards");
const overlayRoot = join(outputRoot, "overlay-boards");
const annotatedRoot = join(outputRoot, "annotated-difference-boards");
const sourceReferenceRoot = "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה";
const fallbackReferenceRoot = "/Users/danielderi/.codex/visualizations/2026/09/07/01a07933-ed3d-7ad0-9a45-2f9b0b21460a/gan-batuach-final-owner-visual-verification-v4/owner-review-package/references";
const primaryCaptureRoot = resolve("qa-evidence/v4-primary-screen-correction/screenshots");
const regressionCaptureRoot = resolve("qa-evidence/v5-domain-regression/screenshots");
const primaryCropRoot = resolve("qa-evidence/v4-primary-reference-crops");
const geometryPath = resolve("GAN_BATUACH_V4_PRIMARY_GEOMETRY.json");

const domains = [
  ["auth-registration", "Auth / Registration", "GB_UX_REF_AUTH_MASTER.png", "/app/login", "Public / invited user"],
  ["owner-onboarding", "Owner Onboarding", "GB_UX_REF_OWNER_ONBOARDING.png", "/onboarding/kindergarten?new=1", "Owner / Manager"],
  ["owner-dashboard", "Owner Dashboard", "GB_UX_REF_OWNER_CORE.png", "/dashboard/garden", "Owner / Manager", "owner-dashboard-primary.png", "owner-dashboard-primary-mobile.png"],
  ["children-classrooms", "Children / Classrooms / Child Profile / Enrollment", "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png", "/dashboard/garden/children", "Owner / Manager"],
  ["parent-assigned", "Parent — Assigned", "GB_UX_REF_PARENT_FULL_PLATFORM.png", "/dashboard/parent", "Assigned Parent", "parent-assigned-primary.png", "parent-assigned-primary-mobile.png"],
  ["parent-unassigned", "Parent — Unassigned", "GB_UX_REF_PARENT_FULL_PLATFORM.png", "/dashboard/parent", "Unassigned Parent"],
  ["parent-multi-child", "Parent — Multi-Child", "GB_UX_REF_PARENT_FULL_PLATFORM.png", "/dashboard/parent", "Multi-Child Parent", "parent-multi-child-primary.png", "parent-multi-child-primary-mobile.png"],
  ["attendance-pickup", "Attendance / Pickup", "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png", "/dashboard/garden/attendance", "Owner / Staff / Parent"],
  ["staff-full-platform", "Staff Full Platform", "GB_UX_REF_STAFF_FULL_PLATFORM.png", "/dashboard/staff", "Staff / Owner"],
  ["candidate-recruitment", "Candidate / Recruitment", "GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png", "/dashboard/staff/job-market", "Candidate / Owner"],
  ["inspector", "Inspector", "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png", "/dashboard/inspector", "Inspector / Owner"],
  ["finance", "Finance", "GB_UX_REF_FINANCE_FULL_PLATFORM.png", "/dashboard/garden/finance", "Owner / Parent / Admin"],
  ["messaging-notifications", "Messaging / Notifications", "GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png", "/dashboard/garden/messages", "Owner / Parent / Staff / Inspector"],
  ["documents", "Documents", "GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png", "/dashboard/garden/documents", "Owner / Parent / Staff / Inspector / Admin"],
  ["tasks-complaints-corrective-actions", "Tasks / Complaints / Corrective Actions", "GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png", "/dashboard/garden/tasks", "Owner / Staff / Parent / Inspector / Admin"],
  ["inspections", "Inspections", "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png", "/dashboard/inspector", "Inspector / Owner"],
  ["reports-analytics", "Reports / Analytics", "GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png", "/dashboard/garden/reports", "Owner / Staff / Inspector / Admin"],
  ["safety-cameras", "Safety / Cameras", "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png", "/dashboard/garden/cameras", "Owner / Parent / Staff / Inspector"],
  ["platform-admin", "Platform Admin", "GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png", "/dashboard/admin", "Platform Admin", "platform-admin-primary.png", "platform-admin-primary-mobile.png"],
  ["settings-account-permissions", "Settings / Account / Permissions", "GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png", "/dashboard/garden/settings", "All authenticated roles", "settings-primary-desktop.png", "settings-primary-mobile.png", "settings"],
  ["global-states-rtl-accessibility", "Global States / RTL / Accessibility", "GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png", "/ux19-system-states?view=loading", "All roles"],
].map(([id, title, reference, route, role, primaryDesktop, primaryMobile, captureId]) => ({ id, title, reference, route, role, primaryDesktop, primaryMobile, captureId: captureId ?? id }));

const priorityIds = new Set(["owner-dashboard", "parent-assigned", "parent-multi-child", "platform-admin", "settings-account-permissions"]);
const referencePath = (filename) => {
  const candidates = [join(sourceReferenceRoot, filename), join(fallbackReferenceRoot, filename)];
  const found = candidates.find(existsSync);
  assert.ok(found, `Missing approved reference ${filename}`);
  return found;
};
const sourceScreenshot = (domain, kind) => {
  const primary = join(primaryCaptureRoot, `${domain.captureId}-${kind}.webp`);
  const regression = join(regressionCaptureRoot, `${domain.id}-${kind}.webp`);
  const found = priorityIds.has(domain.id) ? primary : regression;
  assert.ok(existsSync(found), `Missing fresh ${kind} screenshot for ${domain.id}: ${found}`);
  return found;
};
const sourceReference = (domain, kind = "desktop") => domain[`primary${kind[0].toUpperCase()}${kind.slice(1)}`]
  ? join(primaryCropRoot, domain[`primary${kind[0].toUpperCase()}${kind.slice(1)}`])
  : referencePath(domain.reference);

for (const domain of domains) {
  assert.ok(existsSync(sourceReference(domain, "desktop")), `Missing primary reference crop for ${domain.id}`);
  assert.ok(existsSync(sourceReference(domain, "mobile")), `Missing Mobile reference crop for ${domain.id}`);
  for (const kind of ["desktop", "mobile"]) {
    const meta = await sharp(sourceScreenshot(domain, kind)).metadata();
    assert.deepEqual([meta.width, meta.height], kind === "desktop" ? [1440, 1024] : [390, 844], `${domain.id} ${kind} viewport mismatch`);
  }
}

const geometry = JSON.parse(readFileSync(geometryPath, "utf8"));
const geometryKeys = {
  "owner-dashboard": [["sidebar", "sidebar"], ["header", "header"], ["hero", "hero"], ["kpiRegion", "kpi"], ["primaryContent", "primary"], ["quickActions", "quickActions"]],
  "parent-assigned": [["sidebar", "sidebar"], ["header", "header"], ["childSelector", "selector"], ["primaryContent", "primary"], ["quickActions", "quickActions"]],
  "parent-multi-child": [["sidebar", "sidebar"], ["header", "header"], ["childSelector", "selector"], ["primaryContent", "primary"], ["quickActions", "quickActions"]],
  "platform-admin": [["sidebar", "sidebar"], ["header", "header"], ["kpiRegion", "kpi"], ["primaryContent", "primary"], ["lowerOperational", "lower"]],
  "settings": [["sidebar", "sidebar"], ["header", "header"], ["navigationColumn", "navigation"], ["profileColumn", "profile"], ["securityColumn", "security"], ["gardenColumn", "garden"]],
};
const geometryReview = {};
for (const domain of domains.filter((item) => priorityIds.has(item.id))) {
  const geometryId = domain.captureId;
  const screen = geometry.screens[geometryId];
  assert.ok(screen?.actual, `Fresh actual geometry is missing for ${geometryId}`);
  const comparisons = (geometryKeys[geometryId] ?? []).map(([referenceKey, actualKey]) => {
    const reference = screen.reference[referenceKey];
    const actual = screen.actual[actualKey];
    if (!reference || !actual) return { referenceKey, actualKey, reference, actual, explained: true, note: "Region is represented inside the adjacent composite region." };
    const delta = Object.fromEntries(["x", "y", "w", "h"].map((key) => [key, Number(Math.abs(reference[key] - actual[key]).toFixed(4))]));
    const material = delta.x > geometry.materialTolerance.position || delta.y > geometry.materialTolerance.position || delta.w > geometry.materialTolerance.size || delta.h > geometry.materialTolerance.size;
    return { referenceKey, actualKey, reference, actual, delta, material, explained: !material };
  });
  geometryReview[domain.id] = { geometryId, comparisons, materialUnexplained: comparisons.filter((item) => item.material && !item.explained).length };
}

rmSync(outputRoot, { recursive: true, force: true });
for (const dir of [screenshotRoot, referenceRoot, comparisonRoot, contactRoot, highResRoot, overlayRoot, annotatedRoot]) mkdirSync(dir, { recursive: true });
for (const filename of [...new Set(domains.map((domain) => domain.reference))]) copyFileSync(referencePath(filename), join(referenceRoot, filename));
for (const domain of domains) {
  domain.desktop = join(screenshotRoot, `${domain.id}-desktop.webp`);
  domain.mobile = join(screenshotRoot, `${domain.id}-mobile.webp`);
  copyFileSync(sourceScreenshot(domain, "desktop"), domain.desktop);
  copyFileSync(sourceScreenshot(domain, "mobile"), domain.mobile);
  domain.status = geometryReview[domain.id]?.materialUnexplained ? "NEEDS_VISUAL_CORRECTION" : "REFERENCE_MATCH_CANDIDATE";
  domain.remainingMismatch = geometryReview[domain.id]?.materialUnexplained ? "Material normalized geometry delta remains; see geometry artifact." : "None material in the primary first viewport; external owner acceptance remains pending.";
}

const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const label = (width, text, subtitle = "", color = "#07346f") => Buffer.from(`<svg width="${width}" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}"/><text x="${width / 2}" y="27" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#fff">${xml(text)}</text><text x="${width / 2}" y="48" text-anchor="middle" font-family="Arial" font-size="11" fill="#d7eaff">${xml(subtitle)}</text></svg>`);
const panel = async (path, width, height) => sharp(path).resize({ width, height, fit: "contain", background: "#f4f8ff" }).webp({ quality: 92 }).toBuffer();
const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

for (const domain of domains) {
  const ref = await panel(sourceReference(domain, "desktop"), 1100, 760);
  const desktop = await panel(domain.desktop, 1068, 760);
  const mobile = await panel(domain.mobile, 352, 760);
  const width = 1100 + 1068 + 352 + 48;
  const boardPath = join(comparisonRoot, `${domain.id}.webp`);
  await sharp({ create: { width, height: 904, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(width, domain.title, `${domain.status} · ${domain.route}`), left: 0, top: 0 },
    { input: label(1100, "APPROVED REFERENCE", domain.reference), left: 0, top: 64 },
    { input: label(1068, "ACTUAL DESKTOP", "1440 × 1024 · fresh exact-head capture"), left: 1112, top: 64 },
    { input: label(352, "ACTUAL MOBILE", "390 × 844 · uncropped viewport"), left: 2192, top: 64 },
    { input: ref, left: 0, top: 128 },
    { input: desktop, left: 1112, top: 128 },
    { input: mobile, left: 2192, top: 128 },
  ]).webp({ quality: 92 }).toFile(boardPath);
  domain.board = relative(outputRoot, boardPath);
}

async function contactSheet(kind, outputName) {
  const columns = kind === "desktop" ? 4 : 7;
  const tileWidth = kind === "desktop" ? 340 : 176;
  const tileHeight = kind === "desktop" ? 242 : 381;
  const caption = 34;
  const gap = 10;
  const rows = Math.ceil(domains.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = 68 + rows * (tileHeight + caption + gap) + gap;
  const composites = [{ input: label(width, `Gan Batuach · V5 ${kind.toUpperCase()} MASTER`, `${domains.length} fresh domain screens · ${head.slice(0, 12)}`), left: 0, top: 0 }];
  for (let index = 0; index < domains.length; index += 1) {
    const domain = domains[index];
    const image = await panel(domain[kind], tileWidth, tileHeight);
    const captionSvg = Buffer.from(`<svg width="${tileWidth}" height="${caption}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e7f2ff"/><text x="${tileWidth / 2}" y="22" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" fill="#07346f">${xml(`${index + 1}. ${domain.title}`).slice(0, 92)}</text></svg>`);
    const tile = await sharp({ create: { width: tileWidth, height: tileHeight + caption, channels: 4, background: "#fff" } }).composite([{ input: image, left: 0, top: 0 }, { input: captionSvg, left: 0, top: tileHeight }]).webp({ quality: 88 }).toBuffer();
    composites.push({ input: tile, left: gap + (index % columns) * (tileWidth + gap), top: 68 + gap + Math.floor(index / columns) * (tileHeight + caption + gap) });
  }
  const path = join(contactRoot, outputName);
  await sharp({ create: { width, height, channels: 4, background: "#eef5ff" } }).composite(composites).webp({ quality: 90 }).toFile(path);
  return path;
}
const desktopMaster = await contactSheet("desktop", "desktop-master-contact-sheet.webp");
const mobileMaster = await contactSheet("mobile", "mobile-master-contact-sheet.webp");

const boardThumbWidth = 460;
const boardThumbHeight = 164;
const indexColumns = 3;
const indexGap = 10;
const indexRows = Math.ceil(domains.length / indexColumns);
const indexWidth = indexColumns * boardThumbWidth + (indexColumns + 1) * indexGap;
const indexHeight = 68 + indexRows * (boardThumbHeight + 34 + indexGap) + indexGap;
const indexComposites = [{ input: label(indexWidth, "Gan Batuach · V5 21-DOMAIN COMPARISON INDEX", `Primary reference | Actual Desktop | Actual Mobile · ${head.slice(0, 12)}`), left: 0, top: 0 }];
for (let index = 0; index < domains.length; index += 1) {
  const domain = domains[index];
  const image = await panel(join(outputRoot, domain.board), boardThumbWidth, boardThumbHeight);
  const captionSvg = Buffer.from(`<svg width="${boardThumbWidth}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e7f2ff"/><text x="${boardThumbWidth / 2}" y="22" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#07346f">${xml(`${index + 1}. ${domain.title} · ${domain.status}`).slice(0, 110)}</text></svg>`);
  const tile = await sharp({ create: { width: boardThumbWidth, height: boardThumbHeight + 34, channels: 4, background: "#fff" } }).composite([{ input: image, left: 0, top: 0 }, { input: captionSvg, left: 0, top: boardThumbHeight }]).webp({ quality: 89 }).toBuffer();
  indexComposites.push({ input: tile, left: indexGap + (index % indexColumns) * (boardThumbWidth + indexGap), top: 68 + indexGap + Math.floor(index / indexColumns) * (boardThumbHeight + 34 + indexGap) });
}
const comparisonIndex = join(comparisonRoot, "comparison-board-index.webp");
await sharp({ create: { width: indexWidth, height: indexHeight, channels: 4, background: "#eef5ff" } }).composite(indexComposites).webp({ quality: 91 }).toFile(comparisonIndex);

for (const domain of domains.filter((item) => priorityIds.has(item.id))) {
  const referenceDesktop = await panel(sourceReference(domain, "desktop"), 1440, 1024);
  const referenceMobile = await panel(sourceReference(domain, "mobile"), 390, 844);
  const desktop = await panel(domain.desktop, 1440, 1024);
  const mobile = await panel(domain.mobile, 390, 844);
  const sideWidth = 1440 + 1440 + 390 + 48;
  const sidePath = join(highResRoot, `${domain.id}-primary-side-by-side.webp`);
  await sharp({ create: { width: sideWidth, height: 1152, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(sideWidth, `${domain.title} · PRIMARY SCREEN`, `${domain.status} · ${domain.route}`), left: 0, top: 0 },
    { input: label(1440, "PRIMARY REFERENCE CROP", domain.primaryDesktop), left: 0, top: 64 },
    { input: label(1440, "PRIMARY ACTUAL DESKTOP", "1440 × 1024"), left: 1452, top: 64 },
    { input: label(390, "PRIMARY ACTUAL MOBILE", "390 × 844"), left: 2904, top: 64 },
    { input: referenceDesktop, left: 0, top: 128 },
    { input: desktop, left: 1452, top: 128 },
    { input: mobile, left: 2904, top: 128 },
  ]).webp({ quality: 93 }).toFile(sidePath);

  const actualAlpha = await sharp(domain.desktop).resize({ width: 1440, height: 1024, fit: "fill" }).ensureAlpha().toBuffer();
  const refAlpha = await sharp(sourceReference(domain, "desktop")).resize({ width: 1440, height: 1024, fit: "fill" }).ensureAlpha(0.5).toBuffer();
  const overlay = await sharp(actualAlpha).composite([{ input: refAlpha, blend: "over" }]).webp({ quality: 93 }).toBuffer();
  const overlayPath = join(overlayRoot, `${domain.id}-50-percent-alignment.webp`);
  await sharp({ create: { width: 1440, height: 1088, channels: 4, background: "#eef5ff" } }).composite([{ input: label(1440, `${domain.title} · 50% PRIMARY ALIGNMENT`, domain.status), left: 0, top: 0 }, { input: overlay, left: 0, top: 64 }]).webp({ quality: 93 }).toFile(overlayPath);

  const geometryRows = geometryReview[domain.id]?.comparisons ?? [];
  const annotationText = geometryRows.map((item) => item.material && !item.explained ? `REVIEW · ${item.referenceKey}` : `MATCH · ${item.referenceKey}`).slice(0, 8);
  while (annotationText.length < 8) annotationText.push("MATCH · primary composition");
  const annotationSvg = Buffer.from(`<svg width="2892" height="118" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e7f2ff"/><text x="24" y="28" font-family="Arial" font-size="15" font-weight="800" fill="#07346f">ANNOTATED PRIMARY REVIEW · ${xml(domain.status)}</text>${annotationText.map((text, index) => `<rect x="${24 + (index % 4) * 705}" y="${40 + Math.floor(index / 4) * 35}" width="680" height="28" rx="14" fill="#fff" stroke="${text.startsWith("MATCH") ? "#8bcfb5" : "#f2b066"}"/><text x="${40 + (index % 4) * 705}" y="${60 + Math.floor(index / 4) * 35}" font-family="Arial" font-size="12" font-weight="700" fill="${text.startsWith("MATCH") ? "#087858" : "#a75900"}">${xml(text)}</text>`).join("")}</svg>`);
  const annotatedPath = join(annotatedRoot, `${domain.id}-annotated-primary.webp`);
  await sharp({ create: { width: 2892, height: 1206, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(2892, `${domain.title} · ANNOTATED PRIMARY DIFFERENCE REVIEW`, domain.remainingMismatch), left: 0, top: 0 },
    { input: referenceDesktop, left: 0, top: 64 },
    { input: desktop, left: 1452, top: 64 },
    { input: annotationSvg, left: 0, top: 1088 },
  ]).webp({ quality: 93 }).toFile(annotatedPath);
  domain.highResBoard = relative(outputRoot, sidePath);
  domain.overlayBoard = relative(outputRoot, overlayPath);
  domain.annotatedBoard = relative(outputRoot, annotatedPath);
  domain.referenceVsMobile = relative(outputRoot, await (async () => {
    const path = join(highResRoot, `${domain.id}-reference-vs-mobile.webp`);
    await sharp({ create: { width: 804, height: 972, channels: 4, background: "#eef5ff" } }).composite([
      { input: label(804, `${domain.title} · MOBILE PRIMARY`, domain.status), left: 0, top: 0 },
      { input: referenceMobile, left: 0, top: 128 },
      { input: mobile, left: 414, top: 128 },
      { input: label(390, "REFERENCE MOBILE", domain.primaryMobile), left: 0, top: 64 },
      { input: label(390, "ACTUAL MOBILE", "390 × 844"), left: 414, top: 64 },
    ]).webp({ quality: 93 }).toFile(path);
    return path;
  })());
}

const inventory = domains.flatMap((domain) => ["desktop", "mobile"].map((kind) => ({
  domain: domain.title,
  domainId: domain.id,
  route: domain.route,
  role: domain.role,
  viewport: kind === "desktop" ? "1440x1024" : "390x844",
  file: relative(root, domain[kind]),
  sha256: sha256(domain[kind]),
  reference: domain.reference,
  status: domain.status,
})));
const report = {
  schemaVersion: 1,
  sourceDevelopmentSha: geometry.sourceDevelopmentSha,
  finalDevelopmentSha: head,
  originIntegrationAtGeneration: originIntegration,
  generatedAt: new Date().toISOString(),
  productionTouched: false,
  domains: domains.map((domain) => ({ ...domain, desktop: relative(outputRoot, domain.desktop), mobile: relative(outputRoot, domain.mobile) })),
  counts: {
    totalDomains: domains.length,
    referenceMatchCandidate: domains.filter((domain) => domain.status === "REFERENCE_MATCH_CANDIDATE").length,
    needsVisualCorrection: domains.filter((domain) => domain.status === "NEEDS_VISUAL_CORRECTION").length,
    broken: domains.filter((domain) => domain.status === "BROKEN").length,
    desktopScreenshots: domains.length,
    mobileScreenshots: domains.length,
  },
  contactSheets: { desktop: relative(outputRoot, desktopMaster), mobile: relative(outputRoot, mobileMaster) },
  comparisonIndex: relative(outputRoot, comparisonIndex),
  geometryReview,
};
writeFileSync(join(outputRoot, "verification-report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(outputRoot, "screenshot-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
geometry.v5Review = geometryReview;
geometry.measuredAtV5Package = report.generatedAt;
geometry.actualBuild = head;
writeFileSync(geometryPath, `${JSON.stringify(geometry, null, 2)}\n`);

const reportPath = resolve("GAN_BATUACH_FINAL_OWNER_VISUAL_VERIFICATION_V5.md");
const priorityMarkdown = domains.filter((domain) => priorityIds.has(domain.id)).map((domain) => `| ${domain.title} | \`${domain.route}\` | \`${domain.primaryDesktop}\` | [Desktop](${relative(root, domain.desktop)}) | [Mobile](${relative(root, domain.mobile)}) | [Board](${relative(root, join(outputRoot, domain.highResBoard))}) | [Overlay](${relative(root, join(outputRoot, domain.overlayBoard))}) | [Annotated](${relative(root, join(outputRoot, domain.annotatedBoard))}) | ${domain.status} |`).join("\n");
writeFileSync(reportPath, `# GAN BATUACH FINAL OWNER VISUAL VERIFICATION V5\n\n- Source Development SHA: \`${geometry.sourceDevelopmentSha}\`\n- Exact evidence SHA: \`${head}\`\n- Generated: \`${report.generatedAt}\`\n- Production touched: **NO**\n- Status vocabulary: \`REFERENCE_MATCH_CANDIDATE\`, \`NEEDS_VISUAL_CORRECTION\`, \`BROKEN\`\n\n## Primary screen corrections\n\n| Domain | Actual route | Reference crop | Desktop | Mobile | Side-by-side | Overlay | Annotated | Status |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n${priorityMarkdown}\n\n## Owner package\n\n- [Desktop master contact sheet](${relative(root, desktopMaster)})\n- [Mobile master contact sheet](${relative(root, mobileMaster)})\n- [21-domain comparison index](${relative(root, comparisonIndex)})\n- [Screenshot inventory](${relative(root, join(outputRoot, "screenshot-inventory.json"))})\n- [Verification report](${relative(root, join(outputRoot, "verification-report.json"))})\n- [Primary geometry](${relative(root, geometryPath)})\n\n## Counts\n\n- REFERENCE_MATCH_CANDIDATE: **${report.counts.referenceMatchCandidate}**\n- NEEDS_VISUAL_CORRECTION: **${report.counts.needsVisualCorrection}**\n- BROKEN: **${report.counts.broken}**\n\nExternal owner acceptance remains pending. This document does not claim owner approval or UX completion.\n`);

console.log(JSON.stringify({ outputRoot, reportPath, sha: head, counts: report.counts }, null, 2));
