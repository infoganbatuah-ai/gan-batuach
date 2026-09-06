import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const config = JSON.parse(readFileSync("config/digital-observer-ci-gates.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const qaFiles = readdirSync("scripts/qa").filter((file) => /\.(?:mjs|js|sql)$/.test(file)).sort();
const canonicalFiles = new Set([...config.domain, ...config.security].flatMap((suite) => suite.args.filter((arg) => arg.startsWith("scripts/"))).map((path) => path.replace("scripts/qa/", "")));
const integrationOverrides = new Set([
  "camera-queue-schema.test.mjs",
  "check-digital-observer-product.mjs",
  "check-event-backend.mjs",
  "check-guard-server-credential.mjs",
  "digital-guard-diagnostics-postgres.test.mjs",
  "digital-guard-persisted-learning.mjs",
  "probe-admin-dashboard-schema.mjs",
  "run-completion-role-boundary-probes.mjs"
]);
const deterministicOverrides = new Set([
  "build-ci-test-manifest.mjs",
  "check-eslint-baseline.mjs",
  "check-migration-health.mjs",
  "check-production-release-contract.mjs",
  "production-release-snapshot-core.mjs"
]);

function domain(file) {
  const rules = [
    [/(camera|gateway|connector|dvr|onvif|rtsp)/, "CAMERA / GATEWAY / CONNECTOR"],
    [/(inference|detector|vision|object)/, "AI / INFERENCE"],
    [/(journal|event-ingest|event-outbox|event-backend)/, "EVENT / JOURNAL"],
    [/(track|zone|spatial)/, "TRACKING / ZONES"],
    [/incident(?!-verification)/, "INCIDENT"],
    [/(evidence|event-media|clip)/, "EVIDENCE"],
    [/(context|baseline|learning)/, "CONTEXT / BASELINE"],
    [/(risk|decision)/, "RISK / DECISION"],
    [/verification/, "VERIFICATION"],
    [/(feedback|calibration)/, "FEEDBACK / CALIBRATION"],
    [/(watch|rule)/, "WATCH RULES"],
    [/(investigation|search)/, "INVESTIGATION"],
    [/(tenant|role-boundary|credential|encryption|security|storage-policy|auth)/, "SECURITY / TENANT ISOLATION"],
    [/(privacy|forget)/, "PRIVACY"],
    [/(mock|shadow|demo|fixture|seed)/, "MOCK / SHADOW ISOLATION"],
    [/(schema|migration|database|postgres)/, "DATABASE / MIGRATIONS"],
    [/(production-release|environment-safety)/, "PRODUCTION RELEASE"],
    [/(capture|visual|mobile|reference)/, "UI / E2E"]
  ];
  return rules.find(([pattern]) => pattern.test(file))?.[1] || "OTHER / SUPPORT";
}

function tier(file) {
  if (deterministicOverrides.has(file)) return "TIER 1 — CI DETERMINISTIC";
  if (/^(verify-production|inspect-production|monitor-real)/.test(file)) return "TIER 4 — PRODUCTION SMOKE";
  if (/benchmark-object-inference|capture-live|verify-live|real-camera|hardware|ota|private-nvr-lighting-pulse/.test(file)) return "TIER 3 — HARDWARE E2E";
  if (integrationOverrides.has(file) || /^(create|delete|seed|install|prepare|send|capture|probe|run-|normalize|report-|audit-|stage-)/.test(file)) return "TIER 2 — INTEGRATION";
  return "TIER 1 — CI DETERMINISTIC";
}

function packageCommands(file) {
  const target = `scripts/qa/${file}`;
  const names = Object.entries(packageJson.scripts || {})
    .filter(([, command]) => command.includes(target))
    .map(([name]) => `npm run ${name}`);
  return names.length ? names.join("; ") : file.endsWith(".sql") ? "SQL fixture (not directly executable)" : `node ${target}`;
}

function missingDependency(file) {
  const source = readFileSync(`scripts/qa/${file}`, "utf8");
  const packageName = ["@electric-sql", "pglite"].join("/");
  if (source.includes(packageName) && !packageJson.dependencies?.[packageName] && !packageJson.devDependencies?.[packageName]) {
    return packageName;
  }
  return "none known";
}

const rows = qaFiles.map((file) => {
  const testTier = tier(file);
  const production = testTier.startsWith("TIER 4");
  const integration = testTier.startsWith("TIER 2");
  return {
    file,
    command: packageCommands(file),
    tier: testTier,
    deterministic: testTier.startsWith("TIER 1") ? "YES" : "NO",
    network: production || integration ? "YES / ENV-DEPENDENT" : "NO",
    hardware: testTier.startsWith("TIER 3") || /camera-connection-layer-production|software-connector-production/.test(file) ? "YES" : "NO",
    productionCredentials: production ? "YES" : "NO",
    destructive: /^(delete|seed|install|prepare)/.test(file) || file.endsWith(".sql") ? "YES / CONTROLLED" : "NO",
    domain: domain(file),
    status: canonicalFiles.has(file) ? "CANONICAL CI" : production ? "PRODUCTION SMOKE" : integration ? "INTEGRATION / SUPPORT" : /legacy|demo/.test(file) ? "LEGACY / FIXTURE" : "SUPPORTING",
    missing: missingDependency(file)
  };
});

const capabilityRows = [
  ["Real camera source", "lib/domain/digital-observer/camera-connection-layer.ts (frozen)", "/api/digital-observer/connection-assessment", "digital_observer_camera_sources; camera_streams", "qa:digital-observer-camera-connections", "PUSH 14 / 15 / 16B", "GATE 3 + hardware registry"],
  ["AI / inference", "services/video-gateway/object-inference-client.mjs (frozen)", "/api/video-gateway/cloud-events", "observer_intelligence_signals", "check-object-inference; qa:real-detection-event-bridge", "PUSH 3–4", "GATE 3"],
  ["Tracking / zones", "services/video-gateway/journal-tracker.mjs (frozen)", "/api/video-gateway/cloud-events", "observer_intelligence_signals", "check-event-tracker-configuration; check-spatial-entry-geometry", "PUSH 5 / 5B / 9D", "GATE 3 + hardware registry"],
  ["Events", "lib/domain/event-engine/event-journal-service.ts", "/api/digital-observer/event-journal", "observer_intelligence_signals", "check-event-journal; check-event-ingest; check-event-outbox", "PUSH 4", "GATE 3"],
  ["Incidents", "lib/domain/digital-observer/incident-correlation.ts", "/api/digital-observer/incidents", "observer_correlated_events; observer_correlated_event_links", "qa:digital-observer-incidents", "PUSH 6", "GATE 3"],
  ["Evidence", "lib/domain/event-engine/event-evidence-compatibility.ts", "/api/digital-observer/event-clips/[id]/media", "digital_observer_event_clips", "check-event-evidence-compatibility; qa:digital-observer-event-media", "PUSH 7 / 7B.1", "GATE 3 + hardware registry"],
  ["Context / baseline", "lib/domain/digital-observer/learning-engine.ts", "Incident projection", "site_behavior_baselines", "check-real-event-context-baseline", "PUSH 8", "GATE 3"],
  ["Risk / decision", "lib/domain/digital-observer/risk-decision-engine.ts", "/api/digital-observer/incidents", "digital_observer_risk_evaluations; digital_observer_decision_intents", "qa:digital-observer-risk", "PUSH 9", "GATE 3"],
  ["Verification", "lib/domain/digital-observer/incident-verification-engine.ts", "/api/digital-observer/incidents", "digital_observer_incident_verifications", "qa:digital-observer-verification", "PUSH 10", "GATE 3"],
  ["Feedback / calibration", "lib/domain/digital-observer/feedback-calibration.ts", "/api/digital-observer/incidents/feedback", "digital_observer_feedback_revisions; digital_observer_calibration_samples", "qa:digital-observer-feedback", "PUSH 11", "GATE 3"],
  ["Watch rules", "lib/domain/digital-observer/watch-rule-compiler.ts", "/api/digital-observer/watch-rules", "observer_watch_requests; digital_observer_watch_rule_versions", "qa:digital-observer-watch-rules", "PUSH 12", "GATE 3"],
  ["Investigation", "lib/domain/digital-observer/investigation-search-service.ts", "/api/digital-observer/investigation", "canonical Event/Incident/Evidence projections", "qa:digital-observer-investigation", "PUSH 13", "GATE 3"]
];

const lines = [
  "# DIGITAL OBSERVER CI TEST MANIFEST",
  "",
  `Generated from tracked repository state by \`scripts/qa/build-ci-test-manifest.mjs\`. CI contract: \`${config.version}\`.`,
  "",
  "## CI TEST TIERS",
  "",
  "- **TIER 1 — CI DETERMINISTIC:** no Production secrets, provider sends, deployment, database mutation or physical hardware.",
  "- **TIER 2 — INTEGRATION:** may require a local/test Supabase instance, authenticated QA users, browser tooling or controlled fixture mutation.",
  "- **TIER 3 — HARDWARE E2E:** requires a real camera/DVR/NVR, Connector/Gateway or physical input.",
  "- **TIER 4 — PRODUCTION SMOKE:** bounded read-only or explicitly controlled post-deploy verification; never normal PR CI.",
  "",
  "## CANONICAL CI GATES",
  "",
  "| Gate | Command | Required result |",
  "|---|---|---|",
  "| Gate 1 — Static quality | `npm run typecheck`; `npm run lint:ci` | Typecheck PASS; no lint regression; canonical scope has zero errors |",
  "| Gate 2 — Build | `npm run build` | Production build PASS with live activation disabled |",
  "| Gate 3 — Domain regression | `npm run qa:ci:domain` | All configured deterministic domain suites PASS |",
  "| Gate 4 — Security | `npm run qa:ci:security`; `npm audit --audit-level=high` | Isolation suites PASS; no high/critical vulnerability |",
  "| Gate 5 — Database | `npm run qa:migrations` | Unique timestamps; no new unreviewed destructive migration |",
  "| Gate 6 — Release preflight | `npm run qa:release-contract` | Clean snapshot accepted; dirty/secret/wrong-project snapshots rejected |",
  "",
  "## DOMAIN REGRESSION MANIFEST",
  "",
  "| Capability | Canonical implementation | Canonical API | Table/schema | Primary regression | Production proof | Release gate |",
  "|---|---|---|---|---|---|---|",
  ...capabilityRows.map((row) => `| ${row.join(" | ")} |`),
  "",
  "## TIER 1 CANONICAL SUITES",
  "",
  ...[...config.domain, ...config.security].map((suite) => `- \`${suite.name}\`: \`node ${suite.args.join(" ")}\``),
  "",
  "## COMPLETE QA SCRIPT INVENTORY",
  "",
  `Inventory count: **${rows.length}** files. Classifications are conservative; environment-dependent scripts stay outside Tier 1.`,
  "",
  "| File | Command | Tier | Deterministic | Network | Hardware | Production credentials | Destructive | Domain | Classification | Missing dependency |",
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((row) => `| \`scripts/qa/${row.file}\` | ${row.command.replaceAll("|", "\\|")} | ${row.tier} | ${row.deterministic} | ${row.network} | ${row.hardware} | ${row.productionCredentials} | ${row.destructive} | ${row.domain} | ${row.status} | ${row.missing} |`),
  "",
  "## MAINTENANCE RULE",
  "",
  "Any new canonical capability must add its deterministic regression to `config/digital-observer-ci-gates.json`, update the capability row in this generator, and keep hardware/Production proof outside normal CI. Regenerate with `node scripts/qa/build-ci-test-manifest.mjs`."
];

writeFileSync("DIGITAL_OBSERVER_CI_TEST_MANIFEST.md", `${lines.join("\n")}\n`);
console.log(JSON.stringify({ status: "PASS", output: "DIGITAL_OBSERVER_CI_TEST_MANIFEST.md", qa_files: rows.length, canonical_suites: config.domain.length + config.security.length }, null, 2));
