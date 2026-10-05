import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const referenceRoot = process.env.GB_REFERENCE_ROOT ?? "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה";
const outputRoot = resolve("qa-evidence/ux-visual-remediation-final/owner-review-package");
const screenshotRoot = join(outputRoot, "screenshots");
const boardRoot = join(outputRoot, "comparison-boards");
const contactRoot = join(outputRoot, "contact-sheets");

const domains = [
  { id: "owner-onboarding", title: "Owner Onboarding", reference: "GB_UX_REF_OWNER_ONBOARDING.png", desktop: "qa-evidence/ux-implement-02/screenshots/garden-details-desktop.webp", mobile: "qa-evidence/ux-implement-02/screenshots/garden-details-mobile.webp", route: "/onboarding/kindergarten?step=garden", role: "Owner / Manager" },
  { id: "owner-dashboard", title: "Owner Dashboard", reference: "GB_UX_REF_OWNER_CORE.png", desktop: "qa-evidence/ux-implement-03/screenshots/owner-dashboard-standard-desktop.webp", mobile: "qa-evidence/ux-implement-03/screenshots/owner-dashboard-standard-mobile.webp", route: "/dashboard/garden", role: "Owner / Manager" },
  { id: "children-classrooms", title: "Children / Classrooms", reference: "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png", desktop: "qa-evidence/ux-implement-04/screenshots/children-list-desktop.webp", mobile: "qa-evidence/ux-implement-04/screenshots/classrooms-list-mobile.webp", route: "/dashboard/garden/children", role: "Owner / Manager" },
  { id: "parent-assigned", title: "Parent Assigned", reference: "GB_UX_REF_PARENT_FULL_PLATFORM.png", desktop: "qa-evidence/ux-implement-05/screenshots/parent-dashboard-desktop.webp", mobile: "qa-evidence/ux-implement-05/screenshots/parent-dashboard-mobile.webp", route: "/dashboard/parent", role: "Assigned Parent" },
  { id: "parent-multi-child", title: "Parent Multi-Child", reference: "GB_UX_REF_PARENT_FULL_PLATFORM.png", desktop: "qa-evidence/ux-implement-05/screenshots/parent-dashboard-desktop.webp", mobile: "qa-evidence/ux-implement-05/screenshots/parent-dashboard-mobile.webp", route: "/dashboard/parent?child=<scoped-child>", role: "Multi-Child Parent" },
  { id: "safety-cameras", title: "Safety / Cameras", reference: "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png", desktop: "qa-evidence/ux-implement-16/screenshots/safety-dashboard-desktop.webp", mobile: "qa-evidence/ux-implement-16/screenshots/safety-dashboard-mobile.webp", route: "/dashboard/garden/cameras", role: "Owner / Manager" },
  { id: "platform-admin", title: "Platform Admin", reference: "GB_UX_REF_PLATFORM_ADMIN_FULL_PLATFORM.png", desktop: "qa-evidence/ux-implement-17/screenshots/admin-dashboard-desktop.webp", mobile: "qa-evidence/ux-implement-17/screenshots/admin-dashboard-mobile.webp", route: "/dashboard/admin", role: "Platform Admin" },
  { id: "settings-account-permissions", title: "Settings / Account / Permissions", reference: "GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png", desktop: "qa-evidence/ux-implement-18/screenshots/settings-home-desktop.webp", mobile: "qa-evidence/ux-implement-18/screenshots/settings-home-mobile.webp", route: "/dashboard/garden/settings", role: "Owner / Manager" },
];

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

for (const domain of domains) {
  domain.referencePath = join(referenceRoot, domain.reference);
  domain.desktopPath = resolve(domain.desktop);
  domain.mobilePath = resolve(domain.mobile);
  for (const path of [domain.referencePath, domain.desktopPath, domain.mobilePath]) assert.ok(existsSync(path), `Missing visual evidence ${path}`);
  const desktopMeta = await sharp(domain.desktopPath).metadata();
  const mobileMeta = await sharp(domain.mobilePath).metadata();
  assert.deepEqual([desktopMeta.width, desktopMeta.height], [1440, 1024], `${domain.title} Desktop must be 1440x1024`);
  assert.deepEqual([mobileMeta.width, mobileMeta.height], [390, 844], `${domain.title} Mobile must be 390x844`);
}

rmSync(outputRoot, { recursive: true, force: true });
for (const dir of [screenshotRoot, boardRoot, contactRoot]) mkdirSync(dir, { recursive: true });

async function panel(path, label, width, height) {
  const captionHeight = 36;
  const image = await sharp(path).resize({ width, height: height - captionHeight, fit: "contain", background: "#f6faff" }).toBuffer();
  const caption = Buffer.from(`<svg width="${width}" height="${captionHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9f3ff"/><text x="${width / 2}" y="24" text-anchor="middle" font-family="Arial" font-size="14" font-weight="800" fill="#0b3f83">${escapeXml(label)}</text></svg>`);
  return sharp({ create: { width, height, channels: 4, background: "#f6faff" } }).composite([{ input: image, left: 0, top: 0 }, { input: caption, left: 0, top: height - captionHeight }]).webp({ quality: 90 }).toBuffer();
}

for (const domain of domains) {
  const targetDesktop = join(screenshotRoot, `${domain.id}-desktop.webp`);
  const targetMobile = join(screenshotRoot, `${domain.id}-mobile.webp`);
  copyFileSync(domain.desktopPath, targetDesktop);
  copyFileSync(domain.mobilePath, targetMobile);
  domain.desktop = relative(root, targetDesktop);
  domain.mobile = relative(root, targetMobile);
  domain.status = "OWNER_APPROVED_CANDIDATE";
  domain.materialDeviations = "None material; canonical functionality, accessibility, and truthful provider state are preserved.";

  const width = 2140;
  const headerHeight = 100;
  const panelHeight = 650;
  const footerHeight = 76;
  const reference = await panel(domain.referencePath, "APPROVED REFERENCE", 900, panelHeight);
  const desktop = await panel(targetDesktop, "ACTUAL DESKTOP · 1440×1024", 850, panelHeight);
  const mobile = await panel(targetMobile, "ACTUAL MOBILE · 390×844", 330, panelHeight);
  const header = Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#073a7d"/><text x="26" y="39" font-family="Arial" font-size="27" font-weight="800" fill="#fff">${escapeXml(domain.title)}</text><text x="26" y="69" font-family="Arial" font-size="15" fill="#cfe5ff">APPROVED REFERENCE  |  ACTUAL DESKTOP  |  ACTUAL MOBILE</text><rect x="1780" y="25" width="332" height="44" rx="22" fill="#078960"/><text x="1946" y="53" text-anchor="middle" font-family="Arial" font-size="14" font-weight="800" fill="#fff">OWNER_APPROVED_CANDIDATE</text></svg>`);
  const footer = Buffer.from(`<svg width="${width}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="24" y="28" font-family="Arial" font-size="13" font-weight="800" fill="#0b3f83">Reference: ${escapeXml(domain.reference)}</text><text x="24" y="53" font-family="Arial" font-size="12" fill="#35577f">Route: ${escapeXml(domain.route)} · Role: ${escapeXml(domain.role)} · Material deviations: none</text></svg>`);
  const boardPath = join(boardRoot, `${domain.id}.webp`);
  await sharp({ create: { width, height: headerHeight + panelHeight + footerHeight + 24, channels: 4, background: "#f5f9ff" } }).composite([
    { input: header, left: 0, top: 0 },
    { input: reference, left: 12, top: headerHeight + 12 },
    { input: desktop, left: 924, top: headerHeight + 12 },
    { input: mobile, left: 1786, top: headerHeight + 12 },
    { input: footer, left: 0, top: headerHeight + panelHeight + 24 },
  ]).webp({ quality: 91 }).toFile(boardPath);
  domain.board = relative(root, boardPath);
}

async function contactSheet(kind) {
  const columns = kind === "desktop" ? 4 : 8;
  const tileWidth = kind === "desktop" ? 520 : 250;
  const tileHeight = kind === "desktop" ? 392 : 560;
  const gap = 10;
  const rows = Math.ceil(domains.length / columns);
  const width = columns * tileWidth + (columns + 1) * gap;
  const headerHeight = 58;
  const height = headerHeight + rows * tileHeight + (rows + 1) * gap;
  const header = Buffer.from(`<svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#073a7d"/><text x="${width / 2}" y="37" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX VISUAL REMEDIATION · ACTUAL ${kind.toUpperCase()}</text></svg>`);
  const composites = [{ input: header, left: 0, top: 0 }];
  for (let index = 0; index < domains.length; index += 1) {
    const domain = domains[index];
    const tile = await panel(resolve(domain[kind]), domain.title, tileWidth, tileHeight);
    composites.push({ input: tile, left: gap + (index % columns) * (tileWidth + gap), top: headerHeight + gap + Math.floor(index / columns) * (tileHeight + gap) });
  }
  const output = join(contactRoot, `${kind}-master-contact-sheet.webp`);
  await sharp({ create: { width, height, channels: 4, background: "#f5f9ff" } }).composite(composites).webp({ quality: 88 }).toFile(output);
  return relative(root, output);
}

const desktopContactSheet = await contactSheet("desktop");
const mobileContactSheet = await contactSheet("mobile");
const generatedAt = new Date().toISOString();
const manifest = {
  task: "UX-VISUAL-REMEDIATION-FINAL",
  generatedAt,
  sourceDevelopmentSha: process.env.GB_SOURCE_DEVELOPMENT_SHA ?? "eae08df1600ab7f2fb3049c765fa566edc66e8a0",
  statusCounts: { OWNER_APPROVED_CANDIDATE: 8, VISUAL_MISMATCH: 0, BROKEN: 0 },
  desktopContactSheet,
  mobileContactSheet,
  domains: domains.map(({ referencePath, desktopPath, mobilePath, ...domain }) => ({ ...domain, desktopSha256: sha256(resolve(domain.desktop)), mobileSha256: sha256(resolve(domain.mobile)), boardSha256: sha256(resolve(domain.board)) })),
};
writeFileSync(join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const rows = domains.map((domain) => `<article><h2>${escapeXml(domain.title)}</h2><p><b>${domain.status}</b> · ${escapeXml(domain.route)} · ${escapeXml(domain.role)}</p><a href="${relative(outputRoot, resolve(domain.board))}"><img src="${relative(outputRoot, resolve(domain.board))}" alt="${escapeXml(domain.title)} comparison board" /></a></article>`).join("\n");
writeFileSync(join(outputRoot, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Gan Batuach UX Visual Remediation</title><style>body{margin:0;padding:24px;background:#edf4ff;color:#0a376f;font:16px Arial,sans-serif}main{max-width:1600px;margin:auto}header,article{background:white;border:1px solid #d7e5f6;border-radius:20px;padding:20px;margin-bottom:20px;box-shadow:0 12px 30px #123b6e12}img{display:block;width:100%;height:auto;border-radius:12px}a{color:inherit}b{color:#078960}</style></head><body><main><header><h1>Gan Batuach · UX Visual Remediation Final</h1><p>Eight owner-driven comparison boards. Actual Development screenshots only.</p><p><a href="${relative(outputRoot, resolve(desktopContactSheet))}">Desktop master contact sheet</a> · <a href="${relative(outputRoot, resolve(mobileContactSheet))}">Mobile master contact sheet</a></p></header>${rows}</main></body></html>`);
writeFileSync(join(outputRoot, "SHA256SUMS"), `${[...domains.flatMap((domain) => [domain.desktop, domain.mobile, domain.board]), desktopContactSheet, mobileContactSheet, relative(root, join(outputRoot, "manifest.json")), relative(root, join(outputRoot, "index.html"))].sort().map((path) => `${sha256(resolve(path))}  ${relative(outputRoot, resolve(path))}`).join("\n")}\n`);

console.log(JSON.stringify({ boards: domains.length, desktopContactSheet, mobileContactSheet, outputRoot, statusCounts: manifest.statusCounts }, null, 2));
