import { readFileSync, writeFileSync } from "node:fs";
import { prepareObserverQaAuthConfig } from "../../lib/domain/digital-observer/observer-qa-auth-build.mjs";

// Produces a candidate file only. No Capacitor sync, build, signing, install,
// redirect registration, deployment, or network request occurs here.
const [platform, sourcePath, outputPath] = process.argv.slice(2);
if (!platform || !sourcePath || !outputPath || sourcePath === outputPath) {
  throw new Error("OBSERVER_QA_CONFIG_PATH_REQUIRED");
}
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const config = prepareObserverQaAuthConfig({
  optIn: process.env.OBSERVER_QA_AUTH_BUILD,
  platform,
  bundleId: process.env.OBSERVER_QA_BUNDLE_ID,
  origin: process.env.OBSERVER_QA_ORIGIN,
  launchUrl: process.env.OBSERVER_QA_LAUNCH_URL,
  callback: process.env.OBSERVER_QA_CALLBACK
}, source);
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx", mode: 0o600 });
