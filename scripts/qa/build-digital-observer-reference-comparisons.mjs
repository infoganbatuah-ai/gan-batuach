import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const root = process.cwd();
const experienceDir = resolve(root, process.env.DO_REFERENCE_EXPERIENCE_DIR || "qa-evidence/digital-observer-reference-acceptance-final");
const flowDir = resolve(root, process.env.DO_REFERENCE_FLOW_DIR || "qa-evidence/digital-observer-reference-acceptance-final-flows");
const adminDir = resolve(root, process.env.DO_REFERENCE_ADMIN_DIR || "qa-evidence/digital-observer-admin-reference-final");
const overrideDirs = String(process.env.DO_REFERENCE_OVERRIDE_DIRS || process.env.DO_REFERENCE_OVERRIDE_DIR || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => resolve(root, value));
const outputDir = resolve(root, process.env.DO_REFERENCE_OUTPUT_DIR || `${process.env.DO_REFERENCE_EXPERIENCE_DIR || "qa-evidence/digital-observer-reference-acceptance-final"}/comparisons`);
mkdirSync(outputDir, { recursive: true });

const references = [
  {
    key: "01-business-product",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/דשבורד עסקי.png",
    sourceCrops: [
      { left: 17, top: 67, width: 736, height: 453 },
      { left: 783, top: 67, width: 736, height: 453 },
      { left: 17, top: 533, width: 736, height: 456 },
      { left: 783, top: 533, width: 736, height: 456 }
    ],
    screens: [
      [experienceDir, "business-dashboard-reference-1024.jpg"],
      [experienceDir, "business-sites-reference-1024.jpg"],
      [experienceDir, "business-cameras-reference-1024.jpg"],
      [experienceDir, "business-people-reference-1024.jpg"]
    ],
    detailScreens: [
      [experienceDir, "business-dashboard-reference-1024.jpg"],
      [experienceDir, "business-sites-reference-1024.jpg"],
      [experienceDir, "business-cameras-reference-1024.jpg"],
      [experienceDir, "business-permissions-reference-1024.jpg"]
    ]
  },
  {
    key: "02-camera-onboarding",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/הוספת מצלמה ביתי.png",
    sourceCrops: [
      { left: 20, top: 50, width: 398, height: 837 },
      { left: 444, top: 50, width: 397, height: 837 },
      { left: 869, top: 50, width: 396, height: 837 },
      { left: 1292, top: 50, width: 396, height: 837 }
    ],
    screens: [
      [flowDir, "home-camera-step-1-reference-camera.jpg"],
      [flowDir, "home-camera-step-2-reference-camera.jpg"],
      [flowDir, "home-camera-step-3-reference-camera.jpg"],
      [flowDir, "home-camera-step-4-reference-camera.jpg"]
    ],
    detailScreens: [
      [flowDir, "home-camera-step-1-reference-camera.jpg"],
      [flowDir, "home-camera-step-2-reference-camera.jpg"],
      [flowDir, "home-camera-step-3-reference-camera.jpg"],
      [flowDir, "home-camera-step-4-reference-camera.jpg"]
    ]
  },
  {
    key: "03-home-product",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/דשבורד ביתי.png",
    sourceCrops: [
      { left: 52, top: 16, width: 720, height: 454 },
      { left: 837, top: 16, width: 717, height: 454 },
      { left: 52, top: 499, width: 720, height: 423 },
      { left: 837, top: 499, width: 717, height: 423 }
    ],
    screens: [
      [experienceDir, "home-dashboard-reference-1024.jpg"],
      [experienceDir, "home-cameras-reference-1024.jpg"],
      [experienceDir, "home-alerts-timeline-reference-1024.jpg"],
      [experienceDir, "home-observer-reference-1024.jpg"]
    ],
    detailScreens: [
      [experienceDir, "home-dashboard-reference-1024.jpg"],
      [experienceDir, "home-cameras-reference-1024.jpg"],
      [experienceDir, "home-alerts-timeline-reference-1024.jpg"],
      [experienceDir, "home-observer-reference-1024.jpg"]
    ]
  },
  {
    key: "04-events-people-recordings",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/הקלטות, אנשים מוכרים, מרכז התראות, פרטי אירוע.png",
    sourceCrops: [
      { left: 15, top: 14, width: 733, height: 473 },
      { left: 776, top: 14, width: 733, height: 473 },
      { left: 15, top: 507, width: 733, height: 473 },
      { left: 776, top: 507, width: 733, height: 473 }
    ],
    screens: [
      [experienceDir, "home-alerts-reference-1024.jpg"],
      [experienceDir, "home-alert-detail-reference-1024.jpg"],
      [experienceDir, "home-recordings-reference-1024.jpg"],
      [experienceDir, "home-people-reference-1024.jpg"]
    ],
    detailScreens: [
      [experienceDir, "home-alerts-reference-1024.jpg"],
      [experienceDir, "home-alert-detail-reference-1024.jpg"],
      [experienceDir, "home-recordings-reference-1024.jpg"],
      [experienceDir, "home-people-reference-1024.jpg"]
    ]
  },
  {
    key: "05-mobile-product",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/חידוד לאיך נראה המובייל + התראות  לנייד.png",
    sourceCrops: [
      { left: 0, top: 0, width: 341, height: 768 },
      { left: 341, top: 0, width: 341, height: 768 },
      { left: 682, top: 0, width: 342, height: 768 },
      { left: 0, top: 768, width: 341, height: 768 },
      { left: 341, top: 768, width: 341, height: 768 },
      { left: 682, top: 768, width: 342, height: 768 }
    ],
    screens: [
      [experienceDir, "public-login-mobile-390.jpg"],
      [experienceDir, "home-dashboard-mobile-390.jpg"],
      [experienceDir, "home-alert-detail-mobile-390.jpg"],
      [experienceDir, "home-camera-detail-mobile-390.jpg"],
      [flowDir, "home-camera-step-1-mobile-390.jpg"],
      [experienceDir, "home-settings-mobile-390.jpg"]
    ],
    detailScreens: [
      [experienceDir, "public-login-mobile-390.jpg"],
      [experienceDir, "home-dashboard-mobile-390.jpg"],
      [experienceDir, "home-alert-detail-mobile-390.jpg"],
      [experienceDir, "home-camera-detail-mobile-390.jpg"],
      [flowDir, "home-camera-step-1-mobile-390.jpg"],
      [experienceDir, "home-settings-mobile-390.jpg"]
    ]
  },
  {
    key: "06-billing-settings-admin",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/תשלומים, מנויים וניהול מערכת.png",
    sourceCrops: [
      { left: 15, top: 50, width: 740, height: 440 },
      { left: 780, top: 50, width: 740, height: 440 },
      { left: 15, top: 540, width: 740, height: 445 },
      { left: 780, top: 540, width: 740, height: 445 }
    ],
    screens: [
      [experienceDir, "home-billing-reference-1024.jpg"],
      [experienceDir, "home-billing-payment-reference-1024.jpg"],
      [experienceDir, "home-settings-reference-1024.jpg"],
      [adminDir, "center-reference-1024.png"]
    ],
    detailScreens: [
      [experienceDir, "home-billing-reference-1024.jpg"],
      [experienceDir, "home-billing-payment-reference-1024.jpg"],
      [experienceDir, "home-settings-reference-1024.jpg"],
      [adminDir, "center-reference-1024.png"]
    ]
  },
  {
    key: "07-auth-onboarding",
    browserFrame: "light",
    source: "/Users/danielderi/Desktop/תצפיתן דיגיטלי/רישום והתחברות ביתי ועסקי.png",
    sourceCrops: [
      { left: 15, top: 18, width: 370, height: 990 },
      { left: 395, top: 18, width: 370, height: 990 },
      { left: 774, top: 18, width: 370, height: 990 },
      { left: 1155, top: 18, width: 366, height: 990 }
    ],
    screens: [
      [experienceDir, "public-login-reference-auth.jpg"],
      [experienceDir, "public-account-type-reference-auth.jpg"],
      [flowDir, "home-onboarding-step-1-reference-auth.jpg"],
      [flowDir, "business-onboarding-step-1-reference-auth.jpg"]
    ],
    detailScreens: [
      [experienceDir, "public-login-reference-auth.jpg"],
      [experienceDir, "public-account-type-reference-auth.jpg"],
      [flowDir, "home-onboarding-step-1-reference-auth.jpg"],
      [flowDir, "business-onboarding-step-1-reference-auth.jpg"]
    ]
  }
];

const canvasWidth = 3200;
const canvasHeight = 1800;
const gutter = 44;
const labelHeight = 86;
const panelWidth = Math.floor((canvasWidth - gutter * 3) / 2);
const panelHeight = canvasHeight - gutter * 2;

function labelSvg(text) {
  return Buffer.from(`
    <svg width="${panelWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#062242"/>
      <text x="${panelWidth / 2}" y="55" text-anchor="middle" fill="#ffffff"
        font-family="Arial, sans-serif" font-size="32" font-weight="700">${text}</text>
    </svg>
  `);
}

async function containedImage(path, width, height) {
  return sharp(path)
    .rotate()
    .resize(width, height, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
}

async function containedMobileDeviceImage(path, width, height) {
  const frameHeight = Math.min(height - 18, Math.round((width - 18) / 0.49));
  const frameWidth = Math.round(frameHeight * 0.49);
  const bezel = Math.max(7, Math.round(frameWidth * 0.035));
  const screenWidth = frameWidth - bezel * 2;
  const screenHeight = frameHeight - bezel * 2;
  const left = Math.round((width - frameWidth) / 2);
  const top = Math.round((height - frameHeight) / 2);
  const screenshot = await sharp(path)
    .rotate()
    .resize(screenWidth, screenHeight, { fit: "cover", position: "top" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const shell = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <rect x="${left}" y="${top}" width="${frameWidth}" height="${frameHeight}" rx="${Math.round(frameWidth * 0.12)}" fill="#090d12"/>
    </svg>
  `);
  const chrome = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${left + Math.round(frameWidth * 0.34)}" y="${top + bezel - 1}" width="${Math.round(frameWidth * 0.32)}" height="${Math.max(12, Math.round(frameWidth * 0.055))}" rx="8" fill="#090d12"/>
      <rect x="${left + Math.round(frameWidth * 0.37)}" y="${top + frameHeight - bezel - 5}" width="${Math.round(frameWidth * 0.26)}" height="3" rx="2" fill="#ffffff" opacity="0.9"/>
    </svg>
  `);
  return sharp(shell)
    .composite([
      { input: screenshot, left: left + bezel, top: top + bezel },
      { input: chrome, left: 0, top: 0 }
    ])
    .png()
    .toBuffer();
}

async function containedBrowserImage(path, width, height, appearance) {
  const chromeHeight = Math.max(30, Math.round(height * 0.045));
  const browserHeight = height - 12;
  const screenHeight = browserHeight - chromeHeight;
  const metadata = await sharp(path).metadata();
  const sourceRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;
  const browserWidth = Math.min(width - 12, Math.max(220, Math.round(screenHeight * sourceRatio)));
  const left = Math.round((width - browserWidth) / 2);
  const top = Math.round((height - browserHeight) / 2);
  const dark = appearance === "dark";
  const chromeBackground = dark ? "#151d27" : "#f2f3f5";
  const pillBackground = dark ? "#26313d" : "#ffffff";
  const screenshot = await sharp(path)
    .rotate()
    .resize(browserWidth, screenHeight, { fit: "contain", position: "top", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const chrome = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <rect x="${left}" y="${top}" width="${browserWidth}" height="${browserHeight}" rx="8" fill="#ffffff" stroke="#d6dde3" stroke-width="1"/>
      <path d="M ${left + 8} ${top} H ${left + browserWidth - 8} Q ${left + browserWidth} ${top} ${left + browserWidth} ${top + 8} V ${top + chromeHeight} H ${left} V ${top + 8} Q ${left} ${top} ${left + 8} ${top}" fill="${chromeBackground}"/>
      <circle cx="${left + 17}" cy="${top + chromeHeight / 2}" r="4" fill="#ef5d58"/>
      <circle cx="${left + 31}" cy="${top + chromeHeight / 2}" r="4" fill="#f2bd4f"/>
      <circle cx="${left + 45}" cy="${top + chromeHeight / 2}" r="4" fill="#62c66d"/>
      <rect x="${left + browserWidth * 0.31}" y="${top + chromeHeight * 0.23}" width="${browserWidth * 0.38}" height="${chromeHeight * 0.54}" rx="6" fill="${pillBackground}" opacity="0.9"/>
    </svg>
  `);
  return sharp(chrome)
    .composite([{ input: screenshot, left, top: top + chromeHeight }])
    .png()
    .toBuffer();
}

function resolvedScreenPath(dir, file) {
  for (const overrideDir of overrideDirs) {
    const overridePath = resolve(overrideDir, file);
    if (existsSync(overridePath)) return overridePath;
  }

  return resolve(dir, file);
}

async function buildImplementationPanel(screens, mobileFramed = false, browserFrame = null) {
  const columns = 2;
  const rows = Math.ceil(screens.length / columns);
  const innerGap = 18;
  const tileWidth = Math.floor((panelWidth - innerGap * (columns + 1)) / columns);
  const tileHeight = Math.floor((panelHeight - labelHeight - innerGap * (rows + 1)) / rows);
  const composites = [{ input: labelSvg("IMPLEMENTATION - PRODUCTION QA"), left: 0, top: 0 }];

  for (let index = 0; index < screens.length; index += 1) {
    const [dir, file] = screens[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const screenPath = resolvedScreenPath(dir, file);
    composites.push({
      input: mobileFramed
        ? await containedMobileDeviceImage(screenPath, tileWidth, tileHeight)
        : browserFrame
          ? await containedBrowserImage(screenPath, tileWidth, tileHeight, browserFrame)
          : await containedImage(screenPath, tileWidth, tileHeight),
      left: innerGap + column * (tileWidth + innerGap),
      top: labelHeight + innerGap + row * (tileHeight + innerGap)
    });
  }

  return sharp({
    create: { width: panelWidth, height: panelHeight, channels: 3, background: "#eef3f6" }
  }).composite(composites).png().toBuffer();
}

async function buildSourcePanel(reference) {
  const columns = 2;
  const rows = Math.ceil(reference.sourceCrops.length / columns);
  const innerGap = 18;
  const tileWidth = Math.floor((panelWidth - innerGap * (columns + 1)) / columns);
  const tileHeight = Math.floor((panelHeight - labelHeight - innerGap * (rows + 1)) / rows);
  const composites = [{ input: labelSvg("SOURCE REFERENCE"), left: 0, top: 0 }];

  for (let index = 0; index < reference.sourceCrops.length; index += 1) {
    const crop = reference.sourceCrops[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tile = await sharp(reference.source)
      .extract(crop)
      .resize(tileWidth, tileHeight, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    composites.push({
      input: tile,
      left: innerGap + column * (tileWidth + innerGap),
      top: labelHeight + innerGap + row * (tileHeight + innerGap)
    });
  }

  return sharp({
    create: { width: panelWidth, height: panelHeight, channels: 3, background: "#eef3f6" }
  }).composite(composites).png().toBuffer();
}

async function buildDetailBoard(reference) {
  const screens = reference.detailScreens || reference.screens;
  const rowHeight = 680;
  const headerHeight = 82;
  const boardWidth = 2800;
  const boardGap = 24;
  const tileWidth = Math.floor((boardWidth - boardGap * 3) / 2);
  const tileImageHeight = rowHeight - 78;
  const boardHeight = headerHeight + rowHeight * reference.sourceCrops.length + boardGap;
  const composites = [];

  const heading = (text, width) => Buffer.from(`
    <svg width="${width}" height="${headerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#062242"/>
      <text x="${width / 2}" y="53" text-anchor="middle" fill="#ffffff"
        font-family="Arial, sans-serif" font-size="29" font-weight="700">${text}</text>
    </svg>
  `);
  composites.push({ input: heading("SOURCE PANELS", tileWidth), left: boardGap, top: 0 });
  composites.push({ input: heading("IMPLEMENTATION AT MATCHING VIEWPORT", tileWidth), left: boardGap * 2 + tileWidth, top: 0 });

  for (let index = 0; index < reference.sourceCrops.length; index += 1) {
    const crop = reference.sourceCrops[index];
    const [dir, file] = screens[index];
    const top = headerHeight + index * rowHeight + boardGap;
    const sourceTile = await sharp(reference.source)
      .extract(crop)
      .resize(tileWidth, tileImageHeight, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .png()
      .toBuffer();
    const screenPath = resolvedScreenPath(dir, file);
    const implementationTile = reference.key === "05-mobile-product"
      ? await containedMobileDeviceImage(screenPath, tileWidth, tileImageHeight)
      : reference.browserFrame
        ? await containedBrowserImage(screenPath, tileWidth, tileImageHeight, reference.browserFrame)
        : await containedImage(screenPath, tileWidth, tileImageHeight);
    composites.push({ input: sourceTile, left: boardGap, top });
    composites.push({ input: implementationTile, left: boardGap * 2 + tileWidth, top });
  }

  return sharp({
    create: { width: boardWidth, height: boardHeight, channels: 3, background: "#dce6eb" }
  }).composite(composites).png().toBuffer();
}

async function buildPanelPair(reference, index) {
  const pairWidth = 2400;
  const pairHeight = 1500;
  const pairGap = 32;
  const pairHeaderHeight = 88;
  const pairTileWidth = Math.floor((pairWidth - pairGap * 3) / 2);
  const pairTileHeight = pairHeight - pairHeaderHeight - pairGap * 2;
  const crop = reference.sourceCrops[index];
  const [dir, file] = (reference.detailScreens || reference.screens)[index];
  const screenPath = resolvedScreenPath(dir, file);
  const title = (text) => Buffer.from(`
    <svg width="${pairTileWidth}" height="${pairHeaderHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#062242"/>
      <text x="${pairTileWidth / 2}" y="58" text-anchor="middle" fill="#ffffff"
        font-family="Arial, sans-serif" font-size="34" font-weight="700">${text}</text>
    </svg>
  `);
  const source = await sharp(reference.source)
    .extract(crop)
    .resize(pairTileWidth, pairTileHeight, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  const implementation = reference.key === "05-mobile-product"
    ? await containedMobileDeviceImage(screenPath, pairTileWidth, pairTileHeight)
    : reference.browserFrame
      ? await containedBrowserImage(screenPath, pairTileWidth, pairTileHeight, reference.browserFrame)
      : await containedImage(screenPath, pairTileWidth, pairTileHeight);

  return sharp({
    create: { width: pairWidth, height: pairHeight, channels: 3, background: "#dce6eb" }
  }).composite([
    { input: title(`SOURCE ${index + 1}`), left: pairGap, top: 0 },
    { input: title(`IMPLEMENTATION ${index + 1}`), left: pairGap * 2 + pairTileWidth, top: 0 },
    { input: source, left: pairGap, top: pairHeaderHeight + pairGap },
    { input: implementation, left: pairGap * 2 + pairTileWidth, top: pairHeaderHeight + pairGap }
  ]).png().toBuffer();
}

const reportRows = [];
for (const reference of references) {
  const sourcePanel = await buildSourcePanel(reference);
  const implementationPanel = await buildImplementationPanel(
    reference.screens,
    reference.key === "05-mobile-product",
    reference.browserFrame
  );
  const output = resolve(outputDir, `${reference.key}.png`);
  const detailOutput = resolve(outputDir, `${reference.key}-detail.png`);

  await sharp({
    create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "#dce6eb" }
  }).composite([
    { input: sourcePanel, left: gutter, top: gutter },
    { input: implementationPanel, left: gutter * 2 + panelWidth, top: gutter }
  ]).png().toFile(output);

  await sharp(await buildDetailBoard(reference)).toFile(detailOutput);

  for (let index = 0; index < reference.sourceCrops.length; index += 1) {
    const pairOutput = resolve(outputDir, `${reference.key}-panel-${String(index + 1).padStart(2, "0")}.png`);
    await sharp(await buildPanelPair(reference, index)).toFile(pairOutput);
  }

  reportRows.push(`| ${reference.key} | ${reference.screens.length} | ${reference.key}.png | ${reference.key}-detail.png |`);
}

writeFileSync(resolve(outputDir, "REPORT.md"), [
  "# Digital Observer reference comparison boards",
  "",
  `Generated: ${new Date().toISOString()}`,
  "Source: seven user-provided reference images",
  "Implementation: clean local production screenshots",
  `Targeted screenshot overrides: ${overrideDirs.length ? (process.env.DO_REFERENCE_OVERRIDE_DIRS || process.env.DO_REFERENCE_OVERRIDE_DIR) : "none"}`,
  "Live camera, AI, biometric, notification, emergency or billing service activated: no",
  "",
  "| Reference | Implementation screens | Overview board | Panel-by-panel board |",
  "|---|---:|---|---|",
  ...reportRows,
  "",
  "> These boards support direct manual comparison. They do not assert pixel identity or prove unavailable live integrations."
].join("\n"), "utf8");

process.stdout.write(`Built ${references.length} source-versus-implementation comparison boards.\n`);
