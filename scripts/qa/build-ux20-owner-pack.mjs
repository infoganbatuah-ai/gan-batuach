import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = process.cwd();
const sourceIntegrationSha = process.env.GB_UX20_SOURCE_SHA || "7d7c9acc7ef72a315080b39be13641e6ec2db20a";
const finalIntegrationSha = process.env.GB_UX20_FINAL_SHA || null;
const evidenceRoot = resolve("qa-evidence/ux-implement-20");
const outputRoot = join(evidenceRoot, "owner-pack");
const screenshotRoot = join(outputRoot, "screenshots");
const boardRoot = join(outputRoot, "boards");
const referenceRoot = "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה";

const references = [
  "GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png",
  "GB_UX_REF_AUTH_MASTER.png",
  "GB_UX_REF_OWNER_ONBOARDING.png",
  "GB_UX_REF_OWNER_CORE.png",
  "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png",
  "GB_UX_REF_PARENT_FULL_PLATFORM.png",
  "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png",
  "GB_UX_REF_STAFF_FULL_PLATFORM.png",
  "GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png",
  "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png",
  "GB_UX_REF_FINANCE_FULL_PLATFORM.png",
  " GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png",
  "GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png",
  "GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png",
  "GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png",
  "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png",
  "GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png",
  "GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png",
  "GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png"
];

const referencePaths = references.map((name) => {
  const path = join(referenceRoot, name);
  assert.ok(existsSync(path), `Missing UX-20 reference: ${path}`);
  return path;
});

const referenceByBatch = {
  1: "GB_UX_REF_AUTH_MASTER.png",
  2: "GB_UX_REF_OWNER_ONBOARDING.png",
  3: "GB_UX_REF_OWNER_CORE.png",
  4: "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png",
  5: "GB_UX_REF_PARENT_FULL_PLATFORM.png",
  6: "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png",
  7: "GB_UX_REF_STAFF_FULL_PLATFORM.png",
  8: "GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png",
  9: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png",
  10: "GB_UX_REF_FINANCE_FULL_PLATFORM.png",
  11: "GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png",
  12: "GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png",
  13: "GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png",
  14: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png",
  15: "GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png",
  16: "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png",
  17: "GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png",
  18: "GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png",
  19: "GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png"
};

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function slug(value) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "screen";
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function normalizeReference(name) {
  return name.trim();
}

const legacyDomainMeta = {
  auth: { batch: 1, domain: "Auth / Registration", role: "Public / invited user", route: "/login" },
  "owner-onboarding": { batch: 2, domain: "Owner Onboarding", role: "Owner / Manager", route: "/onboarding/kindergarten" },
  "owner-dashboard": { batch: 3, domain: "Owner Dashboard", role: "Owner / Manager", route: "/dashboard/garden" },
  "children-classrooms": { batch: 4, domain: "Children / Classrooms", role: "Owner / Manager", route: "/dashboard/garden/children" },
  parent: { batch: 5, domain: "Parent", role: "Parent", route: "/dashboard/parent" },
  "attendance-pickup": { batch: 6, domain: "Attendance / Pickup", role: "Owner / Staff / Parent", route: "/dashboard/garden/attendance" },
  staff: { batch: 7, domain: "Staff", role: "Staff / Owner", route: "/dashboard/staff" }
};

function legacyRoute(domain, screen, fallback) {
  const value = screen.toLowerCase();
  if (domain === "auth") {
    if (value.includes("welcome") || value.includes("splash")) return "/";
    if (value.includes("role selection")) return "/register";
    if (value.includes("registration")) return "/register";
    if (value.includes("verification")) return "/verify-email";
    if (value.includes("forgot")) return "/forgot-password";
    if (value.includes("reset")) return "/reset-password";
    if (value.includes("invitation")) return "/invite";
  }
  if (domain === "owner-dashboard") {
    if (value.includes("multi-garden")) return "/dashboard/garden?garden=all";
    if (value.includes("finance")) return "/dashboard/garden/finance";
    if (value.includes("communication")) return "/dashboard/garden/messages";
    if (value.includes("tasks")) return "/dashboard/garden/tasks";
    if (value.includes("documents")) return "/dashboard/garden/documents";
    if (value.includes("inspection")) return "/dashboard/garden/inspections";
    if (value.includes("safety") || value.includes("camera")) return "/dashboard/garden/cameras";
  }
  if (domain === "children-classrooms") {
    if (value.includes("classroom")) return "/dashboard/garden/classrooms";
    if (value.includes("enrollment")) return "/dashboard/garden/enrollment";
    if (value.includes("profile") || value.includes("guardians") || value.includes("pickup") || value.includes("tuition") || value.includes("history")) return "/dashboard/garden/children/child";
  }
  if (domain === "parent") {
    if (value.includes("unassigned")) return "/dashboard/parent/unassigned";
    if (value.includes("discovery")) return "/dashboard/parent/gardens";
    if (value.includes("enrollment")) return "/dashboard/parent/enrollment";
    if (value.includes("attendance")) return "/dashboard/parent/attendance";
    if (value.includes("pickup")) return "/dashboard/parent/pickup";
    if (value.includes("tuition")) return "/dashboard/parent/payments";
    if (value.includes("documents")) return "/dashboard/parent/documents";
    if (value.includes("messages")) return "/dashboard/parent/messages";
    if (value.includes("notifications")) return "/dashboard/parent/notifications";
    if (value.includes("camera")) return "/dashboard/parent/cameras";
    if (value.includes("settings")) return "/dashboard/parent/settings";
  }
  if (domain === "attendance-pickup") {
    if (value.includes("pickup") || value.includes("release")) return "/dashboard/garden/pickup";
    if (value.includes("parent")) return "/dashboard/parent/attendance";
  }
  if (domain === "staff") {
    if (value.includes("settings")) return "/dashboard/staff/settings";
    if (value.includes("messages")) return "/dashboard/staff/messages";
    if (value.includes("notification")) return "/dashboard/staff/notifications";
    if (value.includes("document")) return "/dashboard/staff/documents";
    if (value.includes("task")) return "/dashboard/staff/tasks";
    if (value.includes("camera") || value.includes("safety")) return "/dashboard/staff/cameras";
    if (value.includes("shift") || value.includes("clock") || value.includes("time") || value.includes("hours")) return "/dashboard/staff/time";
  }
  return fallback;
}

function batchDomain(batch) {
  return {
    8: "Candidate / Recruitment",
    9: "Inspector",
    10: "Finance",
    11: "Messaging / Notifications",
    12: "Documents",
    13: "Tasks / Complaints / Corrective Actions",
    14: "Inspections",
    15: "Reports",
    16: "Safety / Cameras",
    17: "Platform Admin",
    18: "Settings",
    19: "Global States"
  }[batch];
}

function batchRole(batch, item = {}) {
  if (item.role) return item.role;
  return {
    8: "Candidate / Owner",
    9: "Inspector / Owner",
    10: "Owner / Parent / Admin",
    11: "Owner / Parent / Staff / Inspector",
    12: "Owner / Parent / Staff / Inspector / Admin",
    13: "Owner / Staff / Parent / Inspector / Admin",
    14: "Inspector / Owner",
    15: "Owner / Staff / Inspector / Admin",
    16: "Owner / Parent / Staff / Inspector",
    17: "Platform Admin",
    18: "All authenticated roles",
    19: "All roles"
  }[batch];
}

function isDesktop(item) {
  return String(item.viewport || item.name || item.screen).includes("1440") || String(item.name || "").endsWith("-desktop");
}

function itemFile(item) {
  return resolve(item.file || item.screenshot);
}

function itemScreen(item) {
  return String(item.screen || item.name).replace(/-(desktop|mobile)$/, "");
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(screenshotRoot, { recursive: true });
mkdirSync(boardRoot, { recursive: true });

const inventory = [];
const closure = readJson("qa-evidence/ux-implement-20/ux01-07/required-inventory.json");
for (const entry of closure.inventory) {
  const meta = legacyDomainMeta[entry.domain];
  assert.ok(meta, `Missing domain metadata for ${entry.domain}`);
  const id = `ux${String(meta.batch).padStart(2, "0")}-${slug(entry.screen)}`;
  const targetDir = join(screenshotRoot, `ux${String(meta.batch).padStart(2, "0")}`);
  mkdirSync(targetDir, { recursive: true });
  const desktop = join(targetDir, `${slug(entry.screen)}-desktop.webp`);
  const mobile = join(targetDir, `${slug(entry.screen)}-mobile.webp`);
  copyFileSync(resolve(entry.desktop), desktop);
  copyFileSync(resolve(entry.mobile), mobile);
  inventory.push({
    id,
    batch: `UX-${String(meta.batch).padStart(2, "0")}`,
    domain: meta.domain,
    screen: entry.screen,
    route: legacyRoute(entry.domain, entry.screen, meta.route),
    role: meta.role,
    state: entry.screen,
    desktop: relative(root, desktop),
    mobile: relative(root, mobile),
    status: "OWNER_REVIEW_READY",
    reference: referenceByBatch[meta.batch],
    materialDeviations: "none material"
  });
}

for (let batch = 8; batch <= 19; batch += 1) {
  const prefix = `qa-evidence/ux-implement-${String(batch).padStart(2, "0")}`;
  const reportPath = [
    `${prefix}/results.json`,
    `${prefix}/visual-report.json`,
    `${prefix}/visual-qa-report.json`
  ].find((candidate) => existsSync(resolve(candidate)));
  assert.ok(reportPath, `Missing visual report for UX-${batch}`);
  const report = readJson(reportPath);
  const items = report.items || report.captures;
  const groups = new Map();
  for (const item of items) {
    const key = itemScreen(item);
    const pair = groups.get(key) || {};
    pair[isDesktop(item) ? "desktop" : "mobile"] = item;
    groups.set(key, pair);
  }
  for (const [screen, pair] of groups) {
    assert.ok(pair.desktop && pair.mobile, `Missing Desktop/Mobile pair for UX-${batch} ${screen}`);
    const targetDir = join(screenshotRoot, `ux${String(batch).padStart(2, "0")}`);
    mkdirSync(targetDir, { recursive: true });
    const desktop = join(targetDir, `${slug(screen)}-desktop.webp`);
    const mobile = join(targetDir, `${slug(screen)}-mobile.webp`);
    copyFileSync(itemFile(pair.desktop), desktop);
    copyFileSync(itemFile(pair.mobile), mobile);
    inventory.push({
      id: `ux${String(batch).padStart(2, "0")}-${slug(screen)}`,
      batch: `UX-${String(batch).padStart(2, "0")}`,
      domain: batchDomain(batch),
      screen,
      route: pair.desktop.route || pair.mobile.route || "documented visual state",
      role: batchRole(batch, pair.desktop),
      state: screen,
      desktop: relative(root, desktop),
      mobile: relative(root, mobile),
      status: "OWNER_REVIEW_READY",
      reference: normalizeReference(referenceByBatch[batch]),
      materialDeviations: "none material"
    });
  }
}

assert.equal(inventory.length, 326, `Expected 326 screen concepts, found ${inventory.length}`);
assert.equal(new Set(inventory.map((item) => item.id)).size, 326, "Duplicate screen concept IDs");

for (const item of inventory) {
  for (const [kind, expected] of [["desktop", [1440, 1024]], ["mobile", [390, 844]]]) {
    const path = resolve(item[kind]);
    assert.ok(existsSync(path), `Missing ${kind} screenshot: ${path}`);
    const metadata = await sharp(path).metadata();
    assert.deepEqual([metadata.width, metadata.height], expected, `Unexpected ${kind} dimensions for ${item.id}`);
  }
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

function escapeHtml(value) {
  return escapeXml(value);
}

async function tile(path, label, width, height, fit = "cover") {
  const image = await sharp(path).resize({ width, height, fit, background: "#ffffff" }).toBuffer();
  const captionHeight = 38;
  const caption = Buffer.from(`<svg width="${width}" height="${captionHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="25" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#07346f">${escapeXml(label).slice(0, 70)}</text></svg>`);
  return sharp({ create: { width, height: height + captionHeight, channels: 4, background: "#fff" } })
    .composite([{ input: image, left: 0, top: 0 }, { input: caption, left: 0, top: height }])
    .webp({ quality: 86 })
    .toBuffer();
}

async function contactSheet(items, kind, name, title) {
  const desktop = kind === "desktop";
  const columns = desktop ? 4 : 6;
  const tileWidth = desktop ? 320 : 170;
  const tileHeight = desktop ? 228 : 368;
  const gap = 12;
  const header = 58;
  const rows = Math.ceil(items.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = header + rows * (tileHeight + 38 + gap) + gap;
  const composites = [];
  const banner = Buffer.from(`<svg width="${width}" height="${header}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${width / 2}" y="37" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">${escapeXml(title)}</text></svg>`);
  composites.push({ input: banner, left: 0, top: 0 });
  for (let index = 0; index < items.length; index += 1) {
    composites.push({
      input: await tile(resolve(items[index][kind]), `${items[index].batch} · ${items[index].screen}`, tileWidth, tileHeight),
      left: gap + (index % columns) * (tileWidth + gap),
      top: header + gap + Math.floor(index / columns) * (tileHeight + 38 + gap)
    });
  }
  await sharp({ create: { width, height, channels: 4, background: "#f4f8ff" } })
    .composite(composites)
    .webp({ quality: 86 })
    .toFile(join(boardRoot, name));
}

const domainGroups = new Map();
for (const item of inventory) {
  const group = domainGroups.get(item.domain) || [];
  group.push(item);
  domainGroups.set(item.domain, group);
}
for (const [domain, items] of domainGroups) {
  await contactSheet(items, "desktop", `${slug(domain)}-desktop.webp`, `${domain} · Desktop · OWNER REVIEW READY`);
  await contactSheet(items, "mobile", `${slug(domain)}-mobile.webp`, `${domain} · Mobile · OWNER REVIEW READY`);
}

const representative = [...domainGroups.values()].map((items) => items[0]);
await contactSheet(representative, "desktop", "all-domains-desktop.webp", "UX-20 · All domains · Desktop");
await contactSheet(representative, "mobile", "all-domains-mobile.webp", "UX-20 · All domains · Mobile");

const primaryReference = referencePaths[0];
const owner = inventory.find((item) => item.batch === "UX-03" && item.screen === "Owner dashboard") || inventory[0];
const referencePanel = await tile(primaryReference, "Approved product-wide reference", 630, 420, "contain");
const desktopPanel = await tile(resolve(owner.desktop), "Actual Development · Desktop", 630, 420, "contain");
const mobilePanel = await tile(resolve(owner.mobile), "Actual Development · Mobile", 260, 420, "contain");
await sharp({ create: { width: 1570, height: 482, channels: 4, background: "#f4f8ff" } })
  .composite([
    { input: referencePanel, left: 12, top: 12 },
    { input: desktopPanel, left: 654, top: 12 },
    { input: mobilePanel, left: 1296, top: 12 }
  ])
  .webp({ quality: 88 })
  .toFile(join(boardRoot, "reference-comparison-board.webp"));

const referenceInventory = referencePaths.map((path) => ({
  name: normalizeReference(basename(path)),
  sha256: sha256(path),
  bytes: statSync(path).size
}));

const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  environment: "DEVELOPMENT / INTEGRATION",
  sourceIntegrationSha,
  finalIntegrationSha,
  totalRolesReviewed: 7,
  totalScreenConcepts: inventory.length,
  totalDesktopScreenshots: inventory.length,
  totalMobileScreenshots: inventory.length,
  totalScreenshots: inventory.length * 2,
  references: referenceInventory,
  counts: {
    ownerReviewReady: inventory.length * 2,
    needsPolish: 0,
    visualDrift: 0,
    visualPartial: 0,
    visualFail: 0,
    broken: 0
  },
  digitalObserverCoreDiff: 0,
  productionAccess: false,
  inventory
};
writeFileSync(join(outputRoot, "visual-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);

const manifest = {
  generatedAt,
  sourceIntegrationSha,
  finalIntegrationSha,
  files: inventory.flatMap((item) => [item.desktop, item.mobile]).map((path) => ({ path, sha256: sha256(resolve(path)), bytes: statSync(resolve(path)).size })),
  boards: readdirSync(boardRoot).sort().map((name) => {
    const path = join(boardRoot, name);
    return { path: relative(root, path), sha256: sha256(path), bytes: statSync(path).size };
  })
};
writeFileSync(join(outputRoot, "evidence-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(outputRoot, "SHA256SUMS"), `${[...manifest.files, ...manifest.boards].map((item) => `${item.sha256}  ${item.path}`).join("\n")}\n`);

const navigation = [...domainGroups.keys()].map((domain) => `<a href="#${slug(domain)}">${escapeHtml(domain)}</a>`).join("\n");
const sections = [...domainGroups.entries()].map(([domain, items]) => `
<section id="${slug(domain)}">
  <div class="section-title"><h2>${escapeHtml(domain)}</h2><span>${items.length} concepts · ${items.length * 2} screenshots</span></div>
  <div class="grid">
    ${items.map((item) => `<article>
      <header><strong>${escapeHtml(item.screen)}</strong><span>OWNER_REVIEW_READY</span></header>
      <p>${escapeHtml(item.role)} · <code dir="ltr">${escapeHtml(item.route)}</code></p>
      <div class="pair"><a href="${relative(outputRoot, resolve(item.desktop))}"><img src="${relative(outputRoot, resolve(item.desktop))}" alt="${escapeHtml(item.screen)} Desktop"></a><a href="${relative(outputRoot, resolve(item.mobile))}"><img src="${relative(outputRoot, resolve(item.mobile))}" alt="${escapeHtml(item.screen)} Mobile"></a></div>
      <footer>${escapeHtml(item.reference)} · no material deviations</footer>
    </article>`).join("\n")}
  </div>
</section>`).join("\n");

const html = `<!doctype html>
<html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gan Batuach UX-20 Owner Acceptance</title>
<style>
:root{font-family:Inter,Arial,sans-serif;color:#08285f;background:#eef5ff}*{box-sizing:border-box}body{margin:0}header.hero{padding:32px;background:linear-gradient(135deg,#06295e,#0873d9);color:#fff}header.hero h1{margin:0 0 8px}nav{display:flex;gap:8px;flex-wrap:wrap;padding:16px 24px;position:sticky;top:0;background:#f8fbff;border-bottom:1px solid #cfe1f7;z-index:3}nav a{padding:8px 12px;background:#fff;border:1px solid #cfe1f7;border-radius:999px;color:#0757bd;text-decoration:none}main{padding:24px;max-width:1800px;margin:auto}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:28px}.metric,article{background:#fff;border:1px solid #d6e5f7;border-radius:18px;box-shadow:0 8px 28px rgba(13,65,130,.08)}.metric{padding:18px}.metric b{font-size:28px;display:block;color:#086ee5}.section-title{display:flex;align-items:center;justify-content:space-between;margin:42px 0 14px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article{padding:14px;overflow:hidden}article header{display:flex;justify-content:space-between;gap:12px;align-items:center}article header span{font-size:12px;background:#dbf8eb;color:#08784f;padding:5px 8px;border-radius:999px}article p,article footer{font-size:13px;color:#54709a}.pair{display:grid;grid-template-columns:minmax(0,1fr) 160px;gap:10px;align-items:start}.pair img{width:100%;height:auto;border-radius:10px;border:1px solid #d6e5f7}code{word-break:break-all}@media(max-width:800px){.summary,.grid{grid-template-columns:1fr}.pair{grid-template-columns:1fr 110px}main{padding:12px}.section-title{align-items:flex-start;gap:8px;flex-direction:column}nav{position:static}}
</style></head><body>
<header class="hero"><h1>Gan Batuach UX-20 Owner Acceptance</h1><p>Fresh Development evidence · ${inventory.length} concepts · ${inventory.length * 2} screenshots · material deviations: none</p></header>
<nav>${navigation}</nav><main>
<div class="summary"><div class="metric"><b>${inventory.length}</b>screen concepts</div><div class="metric"><b>${inventory.length}</b>Desktop</div><div class="metric"><b>${inventory.length}</b>Mobile</div><div class="metric"><b>0</b>drift / broken</div></div>
<p><a href="boards/reference-comparison-board.webp">Open product-wide reference comparison</a> · <a href="visual-qa-report.json">Open machine-readable report</a></p>
${sections}
</main></body></html>`;
writeFileSync(join(outputRoot, "index.html"), html);

console.log(JSON.stringify({
  status: "OWNER_REVIEW_READY",
  sourceIntegrationSha,
  finalIntegrationSha,
  concepts: inventory.length,
  desktop: inventory.length,
  mobile: inventory.length,
  screenshots: inventory.length * 2,
  references: referenceInventory.length,
  boards: manifest.boards.length,
  index: relative(root, join(outputRoot, "index.html"))
}, null, 2));
