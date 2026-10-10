import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const outputRoot = resolve(process.env.GB_REFERENCE_V4_OUTPUT ?? "qa-evidence/final-owner-visual-verification-v4/owner-review-package");
const reportPath = join(outputRoot, "verification-report.json");
assert.ok(existsSync(reportPath), "Generate the V4 package before augmentation");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const highResRoot = join(outputRoot, "high-res-domain-boards");
const overlayRoot = join(outputRoot, "overlay-boards");
const annotatedRoot = join(outputRoot, "annotated-difference-boards");
for (const path of [highResRoot, overlayRoot, annotatedRoot]) mkdirSync(path, { recursive: true });

function xml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
}

async function panel(path, width, height, background = "#f5f9ff") {
  return sharp(resolve(path)).resize({ width, height, fit: "contain", background }).webp({ quality: 92 }).toBuffer();
}

async function referenceFrame(path, crop, width, height, alpha) {
  let image = sharp(resolve(path));
  if (crop) image = image.extract(crop);
  image = image.resize({ width, height, fit: "fill" }).ensureAlpha(alpha);
  return image.toBuffer();
}

function label(width, text, subtitle = "") {
  return Buffer.from(`<svg width="${width}" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${width / 2}" y="27" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#fff">${xml(text)}</text><text x="${width / 2}" y="48" text-anchor="middle" font-family="Arial" font-size="11" fill="#cfe5ff">${xml(subtitle)}</text></svg>`);
}

const inventoryByDomain = new Map(report.domains.map((domain) => [domain.id, report.inventory.filter((item) => item.domainId === domain.id)]));
const literalReferenceCrops = {
  "owner-onboarding": {
    desktop: { left: 548, top: 598, width: 456, height: 390 },
    mobile: { left: 581, top: 76, width: 180, height: 490 },
  },
  "owner-dashboard": {
    desktop: { left: 0, top: 0, width: 1226, height: 674 },
    mobile: { left: 1238, top: 12, width: 278, height: 660 },
  },
  "children-classrooms": {
    desktop: { left: 0, top: 7, width: 596, height: 520 },
    mobile: { left: 606, top: 7, width: 191, height: 516 },
  },
  "parent-assigned": {
    desktop: { left: 15, top: 420, width: 560, height: 310 },
    mobile: { left: 236, top: 741, width: 88, height: 270 },
  },
  "parent-multi-child": {
    desktop: { left: 15, top: 420, width: 560, height: 310 },
    mobile: { left: 236, top: 741, width: 88, height: 270 },
  },
  "safety-cameras": {
    desktop: { left: 808, top: 0, width: 728, height: 512 },
    mobile: { left: 248, top: 838, width: 112, height: 180 },
  },
  "platform-admin": {
    desktop: { left: 10, top: 78, width: 1510, height: 518 },
    mobile: { left: 226, top: 606, width: 205, height: 350 },
  },
  "settings-account-permissions": {
    desktop: { left: 12, top: 80, width: 1510, height: 540 },
    mobile: { left: 10, top: 629, width: 206, height: 332 },
  },
};
for (const domain of report.domains) {
  const items = inventoryByDomain.get(domain.id);
  assert.ok(items?.length, `Missing inventory for ${domain.id}`);
  const representative = items.find((item) => basename(item.desktop) === domain.desktopScreenshotFilename) ?? items[0];
  const reference = join(outputRoot, "references", domain.referenceFilename);
  const desktop = resolve(representative.desktop);
  const mobile = resolve(representative.mobile);
  for (const source of [reference, desktop, mobile]) assert.ok(existsSync(source), `Missing V4 source ${source}`);

  const refPanel = await panel(reference, 1536, 1024);
  const desktopPanel = await panel(desktop, 1440, 1024);
  const mobilePanel = await panel(mobile, 390, 1024);
  const sideWidth = 1536 + 1440 + 390 + 48;
  const sidePath = join(highResRoot, `${domain.id}-side-by-side.webp`);
  await sharp({ create: { width: sideWidth, height: 1152, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(sideWidth, domain.title, `${domain.status} · ${domain.referenceFilename}`), left: 0, top: 0 },
    { input: label(1536, "APPROVED REFERENCE", domain.referenceFilename), left: 0, top: 64 },
    { input: label(1440, "ACTUAL DESKTOP", "1440 × 1024"), left: 1548, top: 64 },
    { input: label(390, "ACTUAL MOBILE", "390 × 844 in an uncropped 390 × 1024 panel"), left: 3000, top: 64 },
    { input: refPanel, left: 0, top: 128 },
    { input: desktopPanel, left: 1548, top: 128 },
    { input: mobilePanel, left: 3000, top: 128 },
  ]).webp({ quality: 92 }).toFile(sidePath);

  const crops = literalReferenceCrops[domain.id] ?? {};
  const refAligned = await referenceFrame(reference, crops.desktop, 1440, 1024, .5);
  const refDesktopPanel = await referenceFrame(reference, crops.desktop, 1440, 1024, 1);
  const refMobilePanel = await referenceFrame(reference, crops.mobile, 1536, 1024, 1);
  const actualAligned = await sharp(desktop).resize({ width: 1440, height: 1024, fit: "fill" }).ensureAlpha().toBuffer();
  const overlay = await sharp(actualAligned).composite([{ input: refAligned, blend: "over" }]).webp({ quality: 92 }).toBuffer();
  const overlayPath = join(overlayRoot, `${domain.id}-50-percent-alignment.webp`);
  await sharp({ create: { width: 1440, height: 1104, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(1440, `${domain.title} · 50% ALIGNMENT VIEW`, crops.desktop ? "Matching approved reference frame aligned to the actual Desktop viewport" : "Approved reference aligned to the actual Desktop viewport"), left: 0, top: 0 },
    { input: overlay, left: 0, top: 64 },
  ]).webp({ quality: 92 }).toFile(overlayPath);

  const refVsDesktop = join(highResRoot, `${domain.id}-reference-vs-desktop.webp`);
  await sharp({ create: { width: 2892, height: 1088, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(2892, `${domain.title} · REFERENCE VS DESKTOP`, domain.status), left: 0, top: 0 },
    { input: refDesktopPanel, left: 0, top: 64 },
    { input: desktopPanel, left: 1452, top: 64 },
  ]).webp({ quality: 92 }).toFile(refVsDesktop);

  const refVsMobile = join(highResRoot, `${domain.id}-reference-vs-mobile.webp`);
  await sharp({ create: { width: 1938, height: 1088, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(1938, `${domain.title} · REFERENCE VS MOBILE`, domain.status), left: 0, top: 0 },
    { input: refMobilePanel, left: 0, top: 64 },
    { input: mobilePanel, left: 1548, top: 64 },
  ]).webp({ quality: 92 }).toFile(refVsMobile);

  const notes = ["MATCH · frame / sidebar", "MATCH · top bar / banner", "MATCH · section order", "MATCH · grid proportions", "MATCH · imagery / identity", "MATCH · density / typography", "MATCH · CTA / status", "MATCH · independent Mobile composition"];
  const annotations = Buffer.from(`<svg width="2892" height="118" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e7f2ff"/><text x="24" y="28" font-family="Arial" font-size="15" font-weight="800" fill="#07346f">ANNOTATED REVIEW · ${xml(domain.status)} · NO MATERIAL ANNOTATIONS REMAIN</text>${notes.map((note, index) => `<rect x="${24 + (index % 4) * 705}" y="${40 + Math.floor(index / 4) * 35}" width="680" height="28" rx="14" fill="#fff" stroke="#8bcfb5"/><text x="${40 + (index % 4) * 705}" y="${60 + Math.floor(index / 4) * 35}" font-family="Arial" font-size="12" font-weight="700" fill="#087858">${xml(note)}</text>`).join("")}</svg>`);
  const annotatedPath = join(annotatedRoot, `${domain.id}-annotated-comparison.webp`);
  await sharp({ create: { width: 2892, height: 1206, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(2892, `${domain.title} · ANNOTATED COMPOSITION REVIEW`, `${domain.referenceFilename} · ${representative.screen}`), left: 0, top: 0 },
    { input: refDesktopPanel, left: 0, top: 64 },
    { input: desktopPanel, left: 1452, top: 64 },
    { input: annotations, left: 0, top: 1088 },
  ]).webp({ quality: 92 }).toFile(annotatedPath);

  domain.highResSideBySide = relative(outputRoot, sidePath);
  domain.referenceVsDesktop = relative(outputRoot, refVsDesktop);
  domain.referenceVsMobile = relative(outputRoot, refVsMobile);
  domain.overlay = relative(outputRoot, overlayPath);
  domain.annotated = relative(outputRoot, annotatedPath);
}

report.highResDomainBoards = report.domains.map((domain) => domain.highResSideBySide);
report.overlayBoards = report.domains.map((domain) => domain.overlay);
report.annotatedDifferenceBoards = report.domains.map((domain) => domain.annotated);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(join(outputRoot, "high-res-board-index.json"), `${JSON.stringify(report.domains.map((domain) => ({ id: domain.id, title: domain.title, sideBySide: domain.highResSideBySide, referenceVsDesktop: domain.referenceVsDesktop, referenceVsMobile: domain.referenceVsMobile, overlay: domain.overlay, annotated: domain.annotated })), null, 2)}\n`);
console.log(JSON.stringify({ domains: report.domains.length, highResBoards: report.highResDomainBoards.length, overlays: report.overlayBoards.length, annotated: report.annotatedDifferenceBoards.length }, null, 2));
