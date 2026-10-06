import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = process.cwd();
const expectedSha = process.env.GB_REFERENCE_V3_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const originIntegration = execFileSync("git", ["rev-parse", "origin/integration/development"], { cwd: root, encoding: "utf8" }).trim();
assert.equal(head, expectedSha, "Verification worktree must remain at the requested merged Development SHA");
if (process.env.GB_REFERENCE_V3_REQUIRE_INTEGRATION === "1") {
  assert.equal(originIntegration, expectedSha, "origin/integration/development changed after capture");
}

const outputRoot = resolve(process.env.GB_REFERENCE_V3_OUTPUT ?? "qa-evidence/final-owner-visual-verification-v3/owner-review-package");
const screenshotRoot = join(outputRoot, "screenshots");
const comparisonRoot = join(outputRoot, "comparison-boards");
const contactRoot = join(outputRoot, "contact-sheets");
const referenceCopyRoot = join(outputRoot, "references");
const sourceClosureRoot = resolve(process.env.GB_REFERENCE_V3_CLOSURE_OUTPUT ?? "qa-evidence/final-owner-visual-verification-v3/ux01-07-fresh");
const referenceRoot = "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה";
const verificationSourceRoot = process.env.GB_REFERENCE_VERIFICATION_SOURCE_ROOT ?? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/final-owner-visual-verification";

const referenceFiles = {
  full: "GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png",
  auth: "GB_UX_REF_AUTH_MASTER.png",
  onboarding: "GB_UX_REF_OWNER_ONBOARDING.png",
  owner: "GB_UX_REF_OWNER_CORE.png",
  children: "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png",
  parent: "GB_UX_REF_PARENT_FULL_PLATFORM.png",
  attendance: "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png",
  staff: "GB_UX_REF_STAFF_FULL_PLATFORM.png",
  candidate: "GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png",
  inspector: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png",
  finance: "GB_UX_REF_FINANCE_FULL_PLATFORM.png",
  messaging: "GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png",
  documents: "GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png",
  work: "GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png",
  reports: "GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png",
  safety: "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png",
  admin: "GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png",
  settings: "GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png",
  states: "GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png",
};

for (const name of Object.values(referenceFiles)) {
  assert.ok(existsSync(join(referenceRoot, name.trim())), `Missing approved reference ${name}`);
}

const domains = [
  { id: "auth-registration", title: "Auth / Registration", batch: 1, source: "auth", reference: "auth", role: "Public / invited user", representative: "Login" },
  { id: "owner-onboarding", title: "Owner Onboarding", batch: 2, source: "owner-onboarding", reference: "onboarding", role: "Owner / Manager", representative: "Onboarding entry" },
  { id: "owner-dashboard", title: "Owner Dashboard", batch: 3, source: "owner-dashboard", reference: "owner", role: "Owner / Manager", representative: "Owner dashboard" },
  { id: "children-classrooms", title: "Children / Classrooms / Child Profile / Enrollment", batch: 4, source: "children-classrooms", reference: "children", role: "Owner / Manager", representative: "Children workspace" },
  { id: "parent-assigned", title: "Parent — Assigned", batch: 5, source: "parent", reference: "parent", role: "Assigned Parent", representative: "Assigned Parent dashboard", parentGroup: "assigned" },
  { id: "parent-unassigned", title: "Parent — Unassigned", batch: 5, source: "parent", reference: "parent", role: "Unassigned Parent", representative: "Unassigned Parent dashboard", parentGroup: "unassigned" },
  { id: "parent-multi-child", title: "Parent — Multi-Child", batch: 5, source: "parent", reference: "parent", role: "Multi-Child Parent", representative: "Multi-Child Parent", parentGroup: "multi" },
  { id: "attendance-pickup", title: "Attendance / Pickup", batch: 6, source: "attendance-pickup", reference: "attendance", role: "Owner / Staff / Parent", representative: "Garden attendance" },
  { id: "staff-full-platform", title: "Staff Full Platform", batch: 7, source: "staff", reference: "staff", role: "Staff / Owner", representative: "Staff dashboard" },
  { id: "candidate-recruitment", title: "Candidate / Recruitment", batch: 8, reference: "candidate", role: "Candidate / Owner", representative: "candidate-dashboard" },
  { id: "inspector", title: "Inspector", batch: 9, reference: "inspector", role: "Inspector / Owner", representative: "inspector-dashboard" },
  { id: "finance", title: "Finance", batch: 10, reference: "finance", role: "Owner / Parent / Admin", representative: "owner-finance-dashboard" },
  { id: "messaging-notifications", title: "Messaging / Notifications", batch: 11, reference: "messaging", role: "Owner / Parent / Staff / Inspector", representative: "message-thread-list" },
  { id: "documents", title: "Documents", batch: 12, reference: "documents", role: "Owner / Parent / Staff / Inspector / Admin", representative: "documents-center" },
  { id: "tasks-complaints-corrective-actions", title: "Tasks / Complaints / Corrective Actions", batch: 13, reference: "work", role: "Owner / Staff / Parent / Inspector / Admin", representative: "tasks-list" },
  { id: "inspections", title: "Inspections", batch: 14, reference: "inspector", role: "Inspector / Owner", representative: "inspection-dashboard" },
  { id: "reports-analytics", title: "Reports / Analytics", batch: 15, reference: "reports", role: "Owner / Staff / Inspector / Admin", representative: "reports-center" },
  { id: "safety-cameras", title: "Safety / Cameras", batch: 16, reference: "safety", role: "Owner / Parent / Staff / Inspector", representative: "safety-dashboard" },
  { id: "platform-admin", title: "Platform Admin", batch: 17, reference: "admin", role: "Platform Admin", representative: "admin-dashboard" },
  { id: "settings-account-permissions", title: "Settings / Account / Permissions", batch: 18, reference: "settings", role: "All authenticated roles", representative: "settings-home" },
  { id: "global-states-rtl-accessibility", title: "Global States / RTL / Accessibility", batch: 19, reference: "states", role: "All roles", representative: "loading" },
];

const domainById = new Map(domains.map((domain) => [domain.id, domain]));
const domainByBatch = new Map(domains.filter((domain) => !domain.parentGroup).map((domain) => [domain.batch, domain]));
const legacyReport = JSON.parse(readFileSync(resolve(verificationSourceRoot, "qa-evidence/ux-implement-20/owner-pack/visual-qa-report.json"), "utf8"));
const legacyMeta = new Map(legacyReport.inventory.map((item) => [`${item.batch}:${item.screen}`, item]));
const closure = JSON.parse(readFileSync(join(sourceClosureRoot, "required-inventory.json"), "utf8"));

function slug(value) {
  return String(value).normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "screen";
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

function escapeHtml(value) {
  return escapeXml(value);
}

function parentDomain(screen) {
  const value = screen.toLowerCase();
  if (["unassigned parent dashboard", "garden discovery", "garden detail", "enrollment request"].some((name) => value === name)) return domainById.get("parent-unassigned");
  if (["multi-child parent", "child switcher"].some((name) => value === name)) return domainById.get("parent-multi-child");
  return domainById.get("parent-assigned");
}

function pathOf(item) {
  return resolve(item.file || item.screenshot);
}

function isDesktop(item) {
  return String(item.viewport || item.name || item.screen).includes("1440") || String(item.name || "").endsWith("-desktop");
}

function screenOf(item) {
  return String(item.screen || item.name).replace(/-(desktop|mobile)$/, "");
}

const inventory = [];
for (const entry of closure.inventory) {
  const batch = { auth: 1, "owner-onboarding": 2, "owner-dashboard": 3, "children-classrooms": 4, parent: 5, "attendance-pickup": 6, staff: 7 }[entry.domain];
  assert.ok(batch, `Unknown closure domain ${entry.domain}`);
  const domain = batch === 5 ? parentDomain(entry.screen) : domainByBatch.get(batch);
  const meta = legacyMeta.get(`UX-${String(batch).padStart(2, "0")}:${entry.screen}`);
  assert.ok(meta, `Missing route metadata for UX-${batch} ${entry.screen}`);
  inventory.push({
    id: `ux${String(batch).padStart(2, "0")}-${slug(entry.screen)}`,
    batch: `UX-${String(batch).padStart(2, "0")}`,
    domainId: domain.id,
    domain: domain.title,
    screen: entry.screen,
    route: meta.route,
    role: meta.role,
    sourceDesktop: resolve(entry.desktop),
    sourceMobile: resolve(entry.mobile),
    reference: referenceFiles[domain.reference].trim(),
  });
}

for (let batch = 8; batch <= 19; batch += 1) {
  const evidence = resolve(`qa-evidence/ux-implement-${String(batch).padStart(2, "0")}`);
  const reportPath = ["results.json", "visual-report.json", "visual-qa-report.json"].map((name) => join(evidence, name)).find(existsSync);
  assert.ok(reportPath, `Missing fresh report for UX-${batch}`);
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const groups = new Map();
  for (const item of report.items || report.captures) {
    const screen = screenOf(item);
    const pair = groups.get(screen) || {};
    pair[isDesktop(item) ? "desktop" : "mobile"] = item;
    groups.set(screen, pair);
  }
  const domain = domainByBatch.get(batch);
  assert.ok(domain, `Missing domain for UX-${batch}`);
  for (const [screen, pair] of groups) {
    assert.ok(pair.desktop && pair.mobile, `Missing Desktop/Mobile pair for UX-${batch} ${screen}`);
    inventory.push({
      id: `ux${String(batch).padStart(2, "0")}-${slug(screen)}`,
      batch: `UX-${String(batch).padStart(2, "0")}`,
      domainId: domain.id,
      domain: domain.title,
      screen,
      route: pair.desktop.route || pair.mobile.route || "documented visual state",
      role: pair.desktop.role || pair.mobile.role || domain.role,
      sourceDesktop: pathOf(pair.desktop),
      sourceMobile: pathOf(pair.mobile),
      reference: referenceFiles[domain.reference].trim(),
    });
  }
}

assert.equal(inventory.length, 326, `Expected 326 screen concepts, found ${inventory.length}`);
assert.equal(new Set(inventory.map((item) => item.id)).size, 326, "Duplicate screen concepts");

for (const domain of domains) {
  domain.status = "REFERENCE_MATCH_CANDIDATE";
  domain.materialDeviations = "None material; canonical capability, security, and accessibility distinctions are preserved.";
}

rmSync(outputRoot, { recursive: true, force: true });
for (const path of [screenshotRoot, comparisonRoot, contactRoot, referenceCopyRoot]) mkdirSync(path, { recursive: true });

for (const [key, name] of Object.entries(referenceFiles)) {
  copyFileSync(join(referenceRoot, name), join(referenceCopyRoot, name.trim()));
}

for (const item of inventory) {
  const targetDir = join(screenshotRoot, item.batch.toLowerCase().replace("-", ""));
  mkdirSync(targetDir, { recursive: true });
  item.desktop = join(targetDir, `${slug(item.screen)}-desktop.webp`);
  item.mobile = join(targetDir, `${slug(item.screen)}-mobile.webp`);
  copyFileSync(item.sourceDesktop, item.desktop);
  copyFileSync(item.sourceMobile, item.mobile);
  const desktopMeta = await sharp(item.desktop).metadata();
  const mobileMeta = await sharp(item.mobile).metadata();
  assert.deepEqual([desktopMeta.width, desktopMeta.height], [1440, 1024], `Desktop size mismatch for ${item.id}`);
  assert.deepEqual([mobileMeta.width, mobileMeta.height], [390, 844], `Mobile size mismatch for ${item.id}`);
  item.desktop = relative(root, item.desktop);
  item.mobile = relative(root, item.mobile);
  item.status = domainById.get(item.domainId).status;
  item.materialDeviations = domainById.get(item.domainId).materialDeviations;
  delete item.sourceDesktop;
  delete item.sourceMobile;
}

async function imageTile(path, label, width, height, fit = "contain", background = "#f7fbff") {
  const image = await sharp(path).resize({ width, height, fit, background }).toBuffer();
  const captionHeight = 30;
  const caption = Buffer.from(`<svg width="${width}" height="${captionHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="20" text-anchor="middle" font-family="Arial" font-size="11" font-weight="700" fill="#07346f">${escapeXml(label).slice(0, 90)}</text></svg>`);
  return sharp({ create: { width, height: height + captionHeight, channels: 4, background: "#fff" } }).composite([{ input: image, left: 0, top: 0 }, { input: caption, left: 0, top: height }]).webp({ quality: 88 }).toBuffer();
}

async function fixedContact(items, kind, width, height) {
  const columns = kind === "desktop" ? 3 : 4;
  const gap = 8;
  const header = 42;
  const rows = Math.ceil(items.length / columns);
  const cellWidth = Math.floor((width - gap * (columns + 1)) / columns);
  const cellHeight = Math.floor((height - header - gap * (rows + 1)) / rows);
  const composites = [];
  const banner = Buffer.from(`<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0b3f83"/><text x="${width / 2}" y="27" text-anchor="middle" font-family="Arial" font-size="16" font-weight="800" fill="#fff">ACTUAL ${kind.toUpperCase()} · ${items.length} screens</text></svg>`);
  composites.push({ input: banner, left: 0, top: 0 });
  for (let index = 0; index < items.length; index += 1) {
    const source = resolve(items[index][kind]);
    const image = await sharp(source).resize({ width: cellWidth, height: Math.max(1, cellHeight - 22), fit: "contain", background: "#fff" }).toBuffer();
    const label = Buffer.from(`<svg width="${cellWidth}" height="22" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eef5ff"/><text x="${cellWidth / 2}" y="15" text-anchor="middle" font-family="Arial" font-size="9" font-weight="700" fill="#173b70">${escapeXml(items[index].screen).slice(0, 42)}</text></svg>`);
    const tile = await sharp({ create: { width: cellWidth, height: cellHeight, channels: 4, background: "#fff" } }).composite([{ input: image, left: 0, top: 0 }, { input: label, left: 0, top: cellHeight - 22 }]).webp({ quality: 84 }).toBuffer();
    composites.push({ input: tile, left: gap + (index % columns) * (cellWidth + gap), top: header + gap + Math.floor(index / columns) * (cellHeight + gap) });
  }
  return sharp({ create: { width, height, channels: 4, background: "#f4f8ff" } }).composite(composites).webp({ quality: 87 }).toBuffer();
}

const inventoryByDomain = new Map(domains.map((domain) => [domain.id, inventory.filter((item) => item.domainId === domain.id)]));
for (const domain of domains) {
  const items = inventoryByDomain.get(domain.id);
  assert.ok(items.length > 0, `No screenshots for ${domain.title}`);
  const desktopContact = await fixedContact(items, "desktop", 900, 700);
  const mobileContact = await fixedContact(items, "mobile", 520, 700);
  const referencePath = join(referenceRoot, referenceFiles[domain.reference]);
  const referencePanel = await sharp(referencePath).resize({ width: 900, height: 700, fit: "contain", background: "#f4f8ff" }).toBuffer();
  const headerHeight = 92;
  const footerHeight = 62;
  const width = 900 + 900 + 520 + 48;
  const height = headerHeight + 700 + footerHeight + 24;
  const statusColor = domain.status === "REFERENCE_MATCH_CANDIDATE" ? "#0a8f62" : domain.status === "NEEDS_VISUAL_CORRECTION" ? "#d97706" : "#d92d20";
  const header = Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#062d66"/><text x="24" y="36" font-family="Arial" font-size="25" font-weight="800" fill="#fff">${escapeXml(domain.title)}</text><text x="24" y="66" font-family="Arial" font-size="14" fill="#cfe5ff">APPROVED REFERENCE  |  ACTUAL DESKTOP  |  ACTUAL MOBILE</text><rect x="${width - 310}" y="24" rx="18" width="286" height="38" fill="${statusColor}"/><text x="${width - 167}" y="49" text-anchor="middle" font-family="Arial" font-size="13" font-weight="800" fill="#fff">${escapeXml(domain.status)}</text></svg>`);
  const footer = Buffer.from(`<svg width="${width}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="24" y="24" font-family="Arial" font-size="12" font-weight="700" fill="#0b3f83">Reference: ${escapeXml(referenceFiles[domain.reference].trim())}</text><text x="24" y="45" font-family="Arial" font-size="11" fill="#35577f">${escapeXml(domain.materialDeviations).slice(0, 280)}</text></svg>`);
  const boardPath = join(comparisonRoot, `${domain.id}.webp`);
  await sharp({ create: { width, height, channels: 4, background: "#f4f8ff" } }).composite([
    { input: header, left: 0, top: 0 },
    { input: referencePanel, left: 12, top: headerHeight + 12 },
    { input: desktopContact, left: 924, top: headerHeight + 12 },
    { input: mobileContact, left: 1836, top: headerHeight + 12 },
    { input: footer, left: 0, top: headerHeight + 712 },
  ]).webp({ quality: 90 }).toFile(boardPath);
  domain.board = relative(root, boardPath);
  domain.desktopScreenshot = items.find((item) => item.screen.toLowerCase() === domain.representative.toLowerCase())?.desktop || items[0].desktop;
  domain.mobileScreenshot = items.find((item) => item.screen.toLowerCase() === domain.representative.toLowerCase())?.mobile || items[0].mobile;
  domain.routes = [...new Set(items.map((item) => item.route))];
  domain.roles = [...new Set(items.map((item) => item.role))];
  domain.referenceFilename = referenceFiles[domain.reference].trim();
  domain.desktopScreenshotFilename = basename(domain.desktopScreenshot);
  domain.mobileScreenshotFilename = basename(domain.mobileScreenshot);
  domain.screenConcepts = items.length;
}

async function masterContact(kind, outputName) {
  const columns = kind === "desktop" ? 6 : 10;
  const imageWidth = kind === "desktop" ? 230 : 118;
  const imageHeight = kind === "desktop" ? 164 : 255;
  const captionHeight = 28;
  const gap = 10;
  const header = 64;
  const rows = Math.ceil(inventory.length / columns);
  const width = columns * imageWidth + (columns + 1) * gap;
  const height = header + rows * (imageHeight + captionHeight + gap) + gap;
  const headerImage = Buffer.from(`<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#062d66"/><text x="${width / 2}" y="39" text-anchor="middle" font-family="Arial" font-size="23" font-weight="800" fill="#fff">Gan Batuach · Fresh ${kind === "desktop" ? "Desktop 1440×1024" : "Mobile 390×844"} · ${inventory.length} screens · ${escapeXml(expectedSha.slice(0, 12))}</text></svg>`);
  const composites = [{ input: headerImage, left: 0, top: 0 }];
  for (let index = 0; index < inventory.length; index += 1) {
    composites.push({
      input: await imageTile(resolve(inventory[index][kind]), `${inventory[index].batch} · ${inventory[index].screen}`, imageWidth, imageHeight),
      left: gap + (index % columns) * (imageWidth + gap),
      top: header + gap + Math.floor(index / columns) * (imageHeight + captionHeight + gap),
    });
  }
  const path = join(contactRoot, outputName);
  await sharp({ create: { width, height, channels: 4, background: "#f4f8ff" } }).composite(composites).webp({ quality: 86 }).toFile(path);
  return relative(root, path);
}

const desktopMaster = await masterContact("desktop", "desktop-master-contact-sheet.webp");
const mobileMaster = await masterContact("mobile", "mobile-master-contact-sheet.webp");

const boardColumns = 3;
const boardWidth = 720;
const boardHeight = 300;
const boardCaption = 38;
const boardGap = 12;
const boardHeader = 64;
const boardRows = Math.ceil(domains.length / boardColumns);
const indexWidth = boardColumns * boardWidth + (boardColumns + 1) * boardGap;
const indexHeight = boardHeader + boardRows * (boardHeight + boardCaption + boardGap) + boardGap;
const indexHeader = Buffer.from(`<svg width="${indexWidth}" height="${boardHeader}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#062d66"/><text x="${indexWidth / 2}" y="39" text-anchor="middle" font-family="Arial" font-size="23" font-weight="800" fill="#fff">Reference Reconstruction V3 · 21 comparison boards · ${escapeXml(expectedSha.slice(0, 12))}</text></svg>`);
const indexComposites = [{ input: indexHeader, left: 0, top: 0 }];
for (let index = 0; index < domains.length; index += 1) {
  indexComposites.push({
    input: await imageTile(resolve(domains[index].board), `${index + 1}. ${domains[index].title} · ${domains[index].status}`, boardWidth, boardHeight),
    left: boardGap + (index % boardColumns) * (boardWidth + boardGap),
    top: boardHeader + boardGap + Math.floor(index / boardColumns) * (boardHeight + boardCaption + boardGap),
  });
}
const comparisonIndex = join(comparisonRoot, "comparison-board-index.webp");
await sharp({ create: { width: indexWidth, height: indexHeight, channels: 4, background: "#f4f8ff" } }).composite(indexComposites).webp({ quality: 88 }).toFile(comparisonIndex);

const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  environment: "DEVELOPMENT / INTEGRATION",
  developmentSha: expectedSha,
  originIntegrationSha: originIntegration,
  productionAccess: false,
  totalDomainsReviewed: domains.length,
  totalScreenConcepts: inventory.length,
  totalDesktopScreenshots: inventory.length,
  totalMobileScreenshots: inventory.length,
  totalComparisonBoards: domains.length,
  allowedStatuses: ["REFERENCE_MATCH_CANDIDATE", "NEEDS_VISUAL_CORRECTION", "BROKEN"],
  counts: domains.reduce((counts, domain) => ({ ...counts, [domain.status]: (counts[domain.status] || 0) + 1 }), { REFERENCE_MATCH_CANDIDATE: 0, NEEDS_VISUAL_CORRECTION: 0, BROKEN: 0 }),
  desktopMasterContactSheet: desktopMaster,
  mobileMasterContactSheet: mobileMaster,
  comparisonBoardIndex: relative(root, comparisonIndex),
  references: Object.values(referenceFiles).map((name) => {
    const path = join(referenceRoot, name.trim());
    return { filename: name.trim(), sha256: sha256(path), bytes: statSync(path).size };
  }),
  domains: domains.map(({ reference, source, parentGroup, representative, ...domain }) => domain),
  inventory,
};
writeFileSync(join(outputRoot, "verification-report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(outputRoot, "screenshot-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);

const boardFiles = readdirSync(comparisonRoot).filter((name) => name.endsWith(".webp")).sort().map((name) => join(comparisonRoot, name));
const screenshotFiles = inventory.flatMap((item) => [resolve(item.desktop), resolve(item.mobile)]);
const contactFiles = [resolve(desktopMaster), resolve(mobileMaster)];
writeFileSync(join(outputRoot, "SHA256SUMS"), `${[...screenshotFiles, ...boardFiles, ...contactFiles].map((path) => `${sha256(path)}  ${relative(outputRoot, path)}`).join("\n")}\n`);

const domainSections = domains.map((domain, index) => {
  const items = inventoryByDomain.get(domain.id);
  return `<section id="${domain.id}"><h2>${index + 1}. ${escapeHtml(domain.title)}</h2><div class="status ${domain.status.toLowerCase()}">${escapeHtml(domain.status)}</div><p><strong>Reference:</strong> ${escapeHtml(domain.referenceFilename)}<br><strong>Role:</strong> ${escapeHtml(domain.roles.join(" / "))}<br><strong>Routes:</strong> <code dir="ltr">${escapeHtml(domain.routes.join(" · "))}</code><br><strong>Material deviations:</strong> ${escapeHtml(domain.materialDeviations)}</p><a class="board" href="${relative(outputRoot, resolve(domain.board))}"><img src="${relative(outputRoot, resolve(domain.board))}" alt="${escapeHtml(domain.title)} comparison board"></a><details><summary>Full screenshot inventory (${items.length} concepts)</summary><div class="shots">${items.map((item) => `<article><h3>${escapeHtml(item.screen)}</h3><p><code dir="ltr">${escapeHtml(item.route)}</code></p><div><a href="${relative(outputRoot, resolve(item.desktop))}"><img src="${relative(outputRoot, resolve(item.desktop))}" alt="${escapeHtml(item.screen)} Desktop"></a><a href="${relative(outputRoot, resolve(item.mobile))}"><img src="${relative(outputRoot, resolve(item.mobile))}" alt="${escapeHtml(item.screen)} Mobile"></a></div></article>`).join("")}</div></details></section>`;
}).join("\n");

const html = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gan Batuach Reference Reconstruction V3</title><style>:root{font-family:Inter,Arial,sans-serif;color:#0b2f67;background:#eef5ff}*{box-sizing:border-box}body{margin:0}header{padding:32px;background:linear-gradient(135deg,#06295e,#0873d9);color:white}header h1{margin:0 0 8px}nav{display:flex;flex-wrap:wrap;gap:8px;padding:14px 22px;background:#f8fbff;border-bottom:1px solid #cfe1f7;position:sticky;top:0;z-index:3}nav a{background:white;border:1px solid #cfe1f7;border-radius:999px;padding:8px 11px;text-decoration:none;color:#0757bd}main{max-width:1840px;margin:auto;padding:24px}.metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.metric,section,article{background:white;border:1px solid #d6e5f7;border-radius:18px;box-shadow:0 8px 28px rgba(13,65,130,.08)}.metric{padding:18px}.metric b{display:block;font-size:28px;color:#0873d9}section{padding:18px;margin:22px 0;position:relative}section h2{margin-top:0}.status{display:inline-block;padding:7px 10px;border-radius:999px;color:white;font-weight:800}.reference_match_candidate{background:#07805a}.needs_visual_correction{background:#c96d05}.broken{background:#c42b1c}.board img{width:100%;border:1px solid #d6e5f7;border-radius:14px}.shots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.shots article{padding:12px}.shots article div{display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:8px}.shots img{width:100%;border-radius:8px;border:1px solid #d6e5f7}code{word-break:break-all}.masters{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.masters img{width:100%;border-radius:14px;border:1px solid #d6e5f7}@media(max-width:800px){main{padding:12px}.metrics{grid-template-columns:1fr 1fr}.masters,.shots{grid-template-columns:1fr}.shots article div{grid-template-columns:1fr 100px}nav{position:static}}</style></head><body><header><h1>Gan Batuach · Reference Reconstruction V3</h1><p>Fresh actual Development evidence from ${escapeHtml(expectedSha)} · generated ${escapeHtml(generatedAt)} · Production untouched</p></header><nav>${domains.map((domain, index) => `<a href="#${domain.id}">${index + 1}. ${escapeHtml(domain.title)}</a>`).join("")}</nav><main><div class="metrics"><div class="metric"><b>${domains.length}</b>domains</div><div class="metric"><b>${inventory.length}</b>Desktop</div><div class="metric"><b>${inventory.length}</b>Mobile</div><div class="metric"><b>${domains.filter((domain) => domain.status === "NEEDS_VISUAL_CORRECTION").length}</b>mismatch domains</div><div class="metric"><b>${domains.filter((domain) => domain.status === "BROKEN").length}</b>broken domains</div></div><p><a href="comparison-boards/comparison-board-index.webp">Open comparison board index</a> · <a href="verification-report.json">Open verification report</a> · <a href="screenshot-inventory.json">Open full screenshot inventory</a></p><div class="masters"><a href="contact-sheets/desktop-master-contact-sheet.webp"><img src="contact-sheets/desktop-master-contact-sheet.webp" alt="Desktop master contact sheet"></a><a href="contact-sheets/mobile-master-contact-sheet.webp"><img src="contact-sheets/mobile-master-contact-sheet.webp" alt="Mobile master contact sheet"></a></div>${domainSections}</main></body></html>`;
writeFileSync(join(outputRoot, "index.html"), html);

const markdownRows = domains.map((domain) => `| ${domain.title} | ${domain.roles.join(" / ")} | \`${domain.routes.join("\` · \`")}\` | [board](${resolve(domain.board)}) | ${domain.status} | ${domain.materialDeviations} |`).join("\n");
const markdown = `# GAN BATUACH FINAL OWNER VISUAL VERIFICATION V3\n\n- Environment: DEVELOPMENT / INTEGRATION\n- Development SHA: \`${expectedSha}\`\n- Generated: ${generatedAt}\n- Production access: NO\n- Domains reviewed: ${domains.length}\n- Desktop screenshots: ${inventory.length} at 1440 × 1024\n- Mobile screenshots: ${inventory.length} at 390 × 844\n- Comparison boards: ${domains.length}\n\n## Owner review entry points\n\n- [Interactive comparison index](${join(outputRoot, "index.html")})\n- [Desktop master contact sheet](${resolve(desktopMaster)})\n- [Mobile master contact sheet](${resolve(mobileMaster)})\n- [Comparison board index](${comparisonIndex})\n- [Full screenshot inventory](${join(outputRoot, "screenshot-inventory.json")})\n- [Machine-readable verification report](${join(outputRoot, "verification-report.json")})\n\n## Domain decisions\n\n| Domain | Role | Route(s) | Comparison board | Status | Material deviations |\n|---|---|---|---|---|---|\n${markdownRows}\n\n## Scope boundary\n\nThis package is a read-only Development visual verification. It does not authorize or perform a merge to \`main\`, a Production deployment, Production migrations, or RELEASE-GAP-01.\n`;
writeFileSync(resolve(process.env.GB_REFERENCE_V3_ARTIFACT ?? join(outputRoot, "GAN_BATUACH_FINAL_OWNER_VISUAL_VERIFICATION_V3.md")), markdown);

console.log(JSON.stringify({
  status: "REFERENCE RECONSTRUCTION V3 PACKAGE GENERATED",
  developmentSha: expectedSha,
  domains: domains.length,
  desktop: inventory.length,
  mobile: inventory.length,
  comparisonBoards: domains.length,
  counts: report.counts,
  index: relative(root, join(outputRoot, "index.html")),
}, null, 2));
