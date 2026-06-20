import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, ".visual-matching");

const baseUrl = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const authState = process.env.VISUAL_AUTH_STATE;
const threshold = Number(process.env.VISUAL_DIFF_THRESHOLD ?? "28");

const viewports = {
  mobile: { width: 390, height: 844, isMobile: true },
  desktop: { width: 1440, height: 1024, isMobile: false }
};

const screens = {
  "login-general": {
    path: "/login",
    reference: "/Users/danielderi/Desktop/עיצוב גן בטוח/עמוד ראשי/עמוד התחברות כללי לכל המשתמשים.png",
    auth: false
  },
  "teacher-dashboard-main": {
    path: "/dashboard/garden",
    reference: "/Users/danielderi/Desktop/עיצוב גן בטוח/גננת/דשבורד ראשי גננת.png",
    auth: true
  },
  "teacher-attendance": {
    path: "/dashboard/garden/attendance",
    reference: "/Users/danielderi/Desktop/עיצוב גן בטוח/גננת/נוכחות דשבורד גננת.png",
    auth: true
  }
};

function requestedScreens() {
  const requested = process.argv.slice(2);
  if (!requested.length) return Object.keys(screens);
  const unknown = requested.filter((name) => !screens[name]);
  if (unknown.length) {
    throw new Error(`Unknown visual screen(s): ${unknown.join(", ")}. Known: ${Object.keys(screens).join(", ")}`);
  }
  return requested;
}

async function ensurePlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      [
        "Playwright is not installed in this workspace.",
        "Install it before running visual matching:",
        "  npm install -D playwright",
        "  npx playwright install chromium",
        "",
        "Then run:",
        "  npm run visual:match -- login-general"
      ].join("\n")
    );
  }
}

async function ensureReference(screenName, referencePath) {
  try {
    await fs.access(referencePath);
  } catch {
    throw new Error(`Missing reference for ${screenName}: ${referencePath}`);
  }
}

async function capture(page, screenName, screen, viewportName, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = new URL(screen.path, baseUrl).toString();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({
    path: path.join(outputRoot, screenName, `${viewportName}-actual.png`),
    fullPage: false,
    animations: "disabled"
  });
  return page.url();
}

async function normalizeReference(referencePath, screenName, viewportName, viewport) {
  const normalized = path.join(outputRoot, screenName, `${viewportName}-reference-normalized.png`);
  await sharp(referencePath)
    .resize(viewport.width, viewport.height, {
      fit: "contain",
      position: "top",
      background: { r: 248, g: 250, b: 255, alpha: 1 }
    })
    .png()
    .toFile(normalized);
  return normalized;
}

async function createDiff(actualPath, normalizedReferencePath, screenName, viewportName, viewport) {
  const [actualRaw, referenceRaw] = await Promise.all([
    sharp(actualPath).ensureAlpha().resize(viewport.width, viewport.height, { fit: "fill" }).raw().toBuffer(),
    sharp(normalizedReferencePath).ensureAlpha().raw().toBuffer()
  ]);

  const diff = Buffer.alloc(actualRaw.length);
  let different = 0;
  const pixels = viewport.width * viewport.height;

  for (let i = 0; i < actualRaw.length; i += 4) {
    const delta =
      Math.abs(actualRaw[i] - referenceRaw[i]) +
      Math.abs(actualRaw[i + 1] - referenceRaw[i + 1]) +
      Math.abs(actualRaw[i + 2] - referenceRaw[i + 2]);

    if (delta > threshold) {
      different += 1;
      diff[i] = 255;
      diff[i + 1] = 49;
      diff[i + 2] = 112;
      diff[i + 3] = 210;
    } else {
      diff[i] = actualRaw[i];
      diff[i + 1] = actualRaw[i + 1];
      diff[i + 2] = actualRaw[i + 2];
      diff[i + 3] = 52;
    }
  }

  const diffPath = path.join(outputRoot, screenName, `${viewportName}-diff.png`);
  await sharp(diff, {
    raw: {
      width: viewport.width,
      height: viewport.height,
      channels: 4
    }
  }).png().toFile(diffPath);

  return {
    path: diffPath,
    mismatchPercent: Number(((different / pixels) * 100).toFixed(2))
  };
}

async function writeReport(results) {
  const lines = [
    "# Visual Matching Report",
    "",
    `Base URL: ${baseUrl}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Screen | Viewport | Actual | Reference normalized | Diff | Mismatch | Final URL |",
    "|---|---:|---|---|---|---:|---|"
  ];

  for (const result of results) {
    lines.push(
      `| ${result.screen} | ${result.viewport} | ${path.relative(root, result.actual)} | ${path.relative(root, result.reference)} | ${path.relative(root, result.diff)} | ${result.mismatchPercent}% | ${result.finalUrl} |`
    );
  }

  lines.push(
    "",
    "Manual review checklist:",
    "- Compare `*-actual.png` with the original reference PNG.",
    "- Open `*-diff.png` to find layout, spacing, typography, and clipping drift.",
    "- Fix the screen before moving to the next reference.",
    "- Dashboard screens require an authenticated Playwright storage state via `VISUAL_AUTH_STATE`."
  );

  await fs.writeFile(path.join(outputRoot, "VISUAL_MATCHING_REPORT.md"), `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const names = requestedScreens();
  const { chromium } = await ensurePlaywright();
  await fs.mkdir(outputRoot, { recursive: true });

  const browser = await chromium.launch();
  const contextOptions = authState ? { storageState: authState } : {};
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const results = [];

  for (const screenName of names) {
    const screen = screens[screenName];
    await ensureReference(screenName, screen.reference);
    await fs.mkdir(path.join(outputRoot, screenName), { recursive: true });

    if (screen.auth && !authState) {
      console.warn(`Warning: ${screenName} usually requires login. Set VISUAL_AUTH_STATE to avoid capturing the login redirect.`);
    }

    for (const [viewportName, viewport] of Object.entries(viewports)) {
      const actual = path.join(outputRoot, screenName, `${viewportName}-actual.png`);
      const finalUrl = await capture(page, screenName, screen, viewportName, viewport);
      const reference = await normalizeReference(screen.reference, screenName, viewportName, viewport);
      const diff = await createDiff(actual, reference, screenName, viewportName, viewport);
      results.push({
        screen: screenName,
        viewport: `${viewportName} ${viewport.width}x${viewport.height}`,
        actual,
        reference,
        diff: diff.path,
        mismatchPercent: diff.mismatchPercent,
        finalUrl
      });
    }
  }

  await browser.close();
  await writeReport(results);

  console.log(`Visual matching complete. Report: ${path.relative(root, path.join(outputRoot, "VISUAL_MATCHING_REPORT.md"))}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
