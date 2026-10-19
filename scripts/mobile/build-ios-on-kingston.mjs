#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const volumeRoot = "/Volumes/DIGITAL_OBSERVER";
const storageRoot =
  process.env.DIGITAL_OBSERVER_XCODE_STORAGE_ROOT ??
  path.join(volumeRoot, "XcodeStorage", "DigitalObserver");

const action = process.argv[2] ?? "simulator";
const supportedActions = new Set(["simulator", "device"]);

if (!supportedActions.has(action)) {
  console.error(`Unsupported iOS build action: ${action}`);
  console.error(`Expected one of: ${[...supportedActions].join(", ")}`);
  process.exit(2);
}

if (!fs.existsSync(volumeRoot)) {
  console.error(
    `Kingston volume is not mounted at ${volumeRoot}; refusing to fall back to internal storage.`,
  );
  process.exit(3);
}

if (!projectRoot.startsWith(`${volumeRoot}${path.sep}`)) {
  console.error(
    `Digital Observer checkout is not on Kingston (${projectRoot}); refusing this build.`,
  );
  process.exit(4);
}

const paths = {
  derivedData: path.join(storageRoot, "DerivedData"),
  archives: path.join(storageRoot, "Archives"),
  packageClones: path.join(storageRoot, "SwiftPackages", "Clones"),
  packageCache: path.join(storageRoot, "SwiftPackages", "Cache"),
  resultBundles: path.join(storageRoot, "ResultBundles"),
};

for (const directory of Object.values(paths)) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
}

const resultBundle = path.join(
  paths.resultBundles,
  `${new Date().toISOString().replaceAll(":", "-")}-${action}.xcresult`,
);

const args = [
  "-project",
  "ios/App/App.xcodeproj",
  "-scheme",
  "App",
  "-configuration",
  "Debug",
  "-derivedDataPath",
  paths.derivedData,
  "-clonedSourcePackagesDirPath",
  paths.packageClones,
  "-packageCachePath",
  paths.packageCache,
  "-resultBundlePath",
  resultBundle,
];

if (action === "simulator") {
  args.push(
    "-sdk",
    "iphonesimulator",
    "-destination",
    "generic/platform=iOS Simulator",
    "CODE_SIGNING_ALLOWED=NO",
    "build",
  );
} else {
  args.push(
    "-sdk",
    "iphoneos",
    "-destination",
    "generic/platform=iOS",
    "CODE_SIGNING_ALLOWED=NO",
    "build",
  );
}

console.log(
  JSON.stringify(
    {
      action,
      projectRoot,
      storageRoot,
      ...paths,
      resultBundle,
      developerDir: "/Applications/Xcode.app/Contents/Developer",
      configuration: "Debug",
      signing: "disabled-for-build-qualification",
    },
    null,
    2,
  ),
);

const result = spawnSync("xcodebuild", args, {
  cwd: projectRoot,
  env: {
    ...process.env,
    DEVELOPER_DIR: "/Applications/Xcode.app/Contents/Developer",
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
