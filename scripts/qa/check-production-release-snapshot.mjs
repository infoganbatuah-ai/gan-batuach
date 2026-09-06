import { validateProductionReleaseSnapshot } from "./production-release-snapshot-core.mjs";

try {
  console.log(JSON.stringify(validateProductionReleaseSnapshot(), null, 2));
} catch (error) {
  const code = error instanceof Error ? error.message : "RELEASE_PREFLIGHT_FAILED";
  console.error(JSON.stringify({
    status: "FAIL",
    gate: "production-release-preflight",
    code
  }, null, 2));
  process.exit(1);
}
