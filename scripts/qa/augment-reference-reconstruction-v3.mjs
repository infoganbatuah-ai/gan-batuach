import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = process.cwd();
const outputRoot = resolve(process.env.GB_REFERENCE_V3_OUTPUT ?? "qa-evidence/final-owner-visual-verification-v3/owner-review-package");
const reportPath = join(outputRoot, "verification-report.json");
assert.ok(existsSync(reportPath), "Generate the V3 package before augmentation");
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

function label(width, text, subtitle = "") {
  return Buffer.from(`<svg width="${width}" height="64" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${width / 2}" y="27" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#fff">${xml(text)}</text><text x="${width / 2}" y="48" text-anchor="middle" font-family="Arial" font-size="11" fill="#cfe5ff">${xml(subtitle)}</text></svg>`);
}

const inventoryByDomain = new Map(report.domains.map((domain) => [domain.id, report.inventory.filter((item) => item.domainId === domain.id)]));
for (const domain of report.domains) {
  const items = inventoryByDomain.get(domain.id);
  assert.ok(items?.length, `Missing inventory for ${domain.id}`);
  const representative = items.find((item) => basename(item.desktop) === domain.desktopScreenshotFilename) ?? items[0];
  const reference = join(outputRoot, "references", domain.referenceFilename);
  const desktop = resolve(representative.desktop);
  const mobile = resolve(representative.mobile);
  for (const source of [reference, desktop, mobile]) assert.ok(existsSync(source), `Missing V3 source ${source}`);

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

  const refAligned = await sharp(reference).resize({ width: 1440, height: 1024, fit: "fill" }).ensureAlpha(.5).toBuffer();
  const actualAligned = await sharp(desktop).resize({ width: 1440, height: 1024, fit: "fill" }).ensureAlpha().toBuffer();
  const overlay = await sharp(actualAligned).composite([{ input: refAligned, blend: "over" }]).webp({ quality: 92 }).toBuffer();
  const overlayPath = join(overlayRoot, `${domain.id}-50-percent-alignment.webp`);
  await sharp({ create: { width: 1440, height: 1104, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(1440, `${domain.title} · 50% ALIGNMENT VIEW`, "Reference board scaled to the actual Desktop viewport for composition review"), left: 0, top: 0 },
    { input: overlay, left: 0, top: 64 },
  ]).webp({ quality: 92 }).toFile(overlayPath);

  const refVsDesktop = join(highResRoot, `${domain.id}-reference-vs-desktop.webp`);
  await sharp({ create: { width: 2892, height: 1088, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(2892, `${domain.title} · REFERENCE VS DESKTOP`, domain.status), left: 0, top: 0 },
    { input: await panel(reference, 1440, 1024), left: 0, top: 64 },
    { input: desktopPanel, left: 1452, top: 64 },
  ]).webp({ quality: 92 }).toFile(refVsDesktop);

  const refVsMobile = join(highResRoot, `${domain.id}-reference-vs-mobile.webp`);
  await sharp({ create: { width: 1938, height: 1088, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(1938, `${domain.title} · REFERENCE VS MOBILE`, domain.status), left: 0, top: 0 },
    { input: refPanel, left: 0, top: 64 },
    { input: mobilePanel, left: 1548, top: 64 },
  ]).webp({ quality: 92 }).toFile(refVsMobile);

  const notes = ["01 frame / sidebar", "02 top bar / banner", "03 section order", "04 grid proportions", "05 imagery / identity", "06 density / typography", "07 CTA / status", "08 independent Mobile composition"];
  const annotations = Buffer.from(`<svg width="2892" height="118" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e7f2ff"/><text x="24" y="28" font-family="Arial" font-size="15" font-weight="800" fill="#07346f">ALIGNMENT CHECKPOINTS · ${xml(domain.status)}</text>${notes.map((note, index) => `<rect x="${24 + (index % 4) * 705}" y="${40 + Math.floor(index / 4) * 35}" width="680" height="28" rx="14" fill="#fff" stroke="#bdd8f4"/><text x="${40 + (index % 4) * 705}" y="${60 + Math.floor(index / 4) * 35}" font-family="Arial" font-size="12" font-weight="700" fill="#245482">${xml(note)}</text>`).join("")}</svg>`);
  const annotatedPath = join(annotatedRoot, `${domain.id}-annotated-comparison.webp`);
  await sharp({ create: { width: 2892, height: 1206, channels: 4, background: "#eef5ff" } }).composite([
    { input: label(2892, `${domain.title} · ANNOTATED COMPOSITION REVIEW`, `${domain.referenceFilename} · ${representative.screen}`), left: 0, top: 0 },
    { input: await panel(reference, 1440, 1024), left: 0, top: 64 },
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
