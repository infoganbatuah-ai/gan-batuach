import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

const alwaysExcluded = [
  ".git",
  ".next",
  "node_modules",
  ".vercel",
  "__MACOSX",
  ".DS_Store",
  "coverage",
  "exports",
  "logs",
  "tmp",
  "temp"
];

const sensitiveNameMatchers = [
  (file) => basename(file).startsWith(".env"),
  (file) => /(^|\/)[^/]*(secret|credential|private-key|service-role|service-account|firebase-adminsdk)[^/]*$/i.test(file),
  (file) => /\.(pem|p12|pfx|key)$/i.test(file)
];

const archiveMatchers = [
  (file) => /\.zip$/i.test(file),
  (file) => /\.tar(\.gz)?$/i.test(file)
];

function isUnderExcludedPath(file) {
  return alwaysExcluded.some((pattern) => file === pattern || file.startsWith(`${pattern}/`) || file.includes(`/${pattern}/`));
}

function isSensitiveFile(file) {
  return sensitiveNameMatchers.some((matcher) => matcher(file));
}

function isArchiveFile(file) {
  return archiveMatchers.some((matcher) => matcher(file));
}

const outputDir = join(process.cwd(), "exports");
if (!existsSync(outputDir)) mkdirSync(outputDir);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(outputDir, `gan-batuach-clean-${stamp}.zip`);
const filesResult = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });

if (filesResult.status !== 0) {
  throw new Error("Clean export requires a git worktree so ignored files are excluded safely.");
}

const candidates = filesResult.stdout
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

const sensitiveCandidates = candidates.filter(isSensitiveFile);
const excludedFiles = candidates.filter((file) => isUnderExcludedPath(file) || isSensitiveFile(file) || isArchiveFile(file));
const files = candidates.filter((file) => !isUnderExcludedPath(file) && !isSensitiveFile(file) && !isArchiveFile(file));
const unsafeIncluded = files.filter((file) => isSensitiveFile(file) || isUnderExcludedPath(file) || isArchiveFile(file));

if (unsafeIncluded.length > 0) {
  console.error("Export aborted: sensitive or runtime files would be included:");
  for (const file of unsafeIncluded) console.error(`- ${file}`);
  process.exit(1);
}

if (files.length === 0) {
  throw new Error("Export aborted: no files selected for export.");
}

const result = spawnSync("zip", ["-q", output, "-@"], { input: files.join("\n"), encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });

if (result.status !== 0) {
  throw new Error("Clean export failed. Make sure the zip command is available.");
}

console.log("Export completed successfully.");
console.log(`Clean export created: ${output}`);
console.log(`Sensitive files excluded: ${sensitiveCandidates.length}`);
console.log(`Total files excluded: ${excludedFiles.length}`);
console.log(`Files included: ${files.length}`);
