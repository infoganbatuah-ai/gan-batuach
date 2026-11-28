const DEVELOPMENT = "DEVELOPMENT / INTEGRATION";
const BASE_URL = "http://127.0.0.1:3000";
const OUTPUT_PARENT = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach";
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SYNTHETIC_EMAIL = /^[a-z0-9][a-z0-9._-]*@integration\.qa\.invalid$/;

export const requiredRegressionIds = Object.freeze([
  "auth-registration",
  "owner-onboarding",
  "children-classrooms",
  "parent-unassigned",
  "attendance-pickup",
  "staff-full-platform",
  "candidate-recruitment",
  "inspector",
  "finance",
  "messaging-notifications",
  "documents",
  "tasks-complaints-corrective-actions",
  "inspections",
  "reports-analytics",
  "safety-cameras",
  "global-states-rtl-accessibility",
]);

export class CaptureAdmissionError extends Error {
  constructor(code) {
    super(code);
    this.name = "CaptureAdmissionError";
    this.code = code;
  }
}

const refuse = (code) => { throw new CaptureAdmissionError(code); };

export function requireRegressionScenarios(targets) {
  if (!Array.isArray(targets) || targets.length !== requiredRegressionIds.length) refuse("SCENARIO_INVENTORY");
  const ids = new Set();
  for (const target of targets) {
    if (!target || typeof target.id !== "string" || ids.has(target.id) ||
        !requiredRegressionIds.includes(target.id) ||
        typeof target.route !== "string" || !target.route.startsWith("/") || target.route.startsWith("//") ||
        typeof target.role !== "string" || !target.role ||
        typeof target.reference !== "string" || !target.reference.endsWith(".png")) refuse("SCENARIO_INVENTORY");
    ids.add(target.id);
  }
  if (requiredRegressionIds.some(id => !ids.has(id))) refuse("SCENARIO_INVENTORY");
  return targets;
}

export function requireCaptureSource({ branch, sourceSha, expectedSha, baseUrl, environment,
  productionAllowed, projectId, runtimeRoot, outputRoot, outputExists = false,
  workingTreeClean = false }) {
  if (branch !== "integration/development") refuse("WRONG_BRANCH");
  if (!SHA.test(sourceSha ?? "") || !SHA.test(expectedSha ?? "") || sourceSha !== expectedSha) refuse("WRONG_SHA");
  if (!workingTreeClean) refuse("DIRTY_SOURCE");
  if (baseUrl !== BASE_URL) refuse("UNSAFE_TARGET");
  if (environment !== DEVELOPMENT || productionAllowed !== false || projectId !== "gan-batuach-integration" ||
      runtimeRoot !== OUTPUT_PARENT) refuse("UNSAFE_ENVIRONMENT");
  if (typeof outputRoot !== "string" || !outputRoot.startsWith(`${OUTPUT_PARENT}/`) ||
      outputRoot.slice(OUTPUT_PARENT.length + 1).includes("/") ||
      !/^gan-[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(outputRoot.slice(OUTPUT_PARENT.length + 1)) ||
      outputRoot.includes("..")) refuse("UNSAFE_OUTPUT");
  if (outputExists) refuse("OUTPUT_EXISTS");
  return { sourceSha, baseUrl, outputRoot };
}

export function requireSyntheticIdentities({ metadata, requiredEmails, unassignedEmail }) {
  if (metadata?.environment !== DEVELOPMENT || !Array.isArray(metadata?.users) ||
      !Array.isArray(requiredEmails) || !SYNTHETIC_EMAIL.test(unassignedEmail ?? "")) refuse("MISSING_FIXTURE");
  const users = new Map();
  for (const email of [...requiredEmails, unassignedEmail]) {
    if (!SYNTHETIC_EMAIL.test(email ?? "")) refuse("MISSING_FIXTURE");
    const matches = metadata.users.filter(user => user?.email === email);
    if (matches.length !== 1 || !UUID.test(matches[0].id ?? "") ||
        typeof matches[0].password !== "string" || !matches[0].password) refuse("MISSING_FIXTURE");
    users.set(email, matches[0]);
  }
  const unassigned = users.get(unassignedEmail);
  if (unassigned?.role !== "parent" || unassigned?.qaScenario !== "PARENT_UNASSIGNED_NO_CHILD") refuse("INVALID_FIXTURE");
  return users;
}

export function requireDevelopmentVersion(version, expectedSha) {
  if (!version || version.environment !== DEVELOPMENT || version.commit !== expectedSha ||
      version.backend !== "LOCAL_SUPABASE" || version.production !== false ||
      typeof version.startedAt !== "string" || !Number.isFinite(Date.parse(version.startedAt))) refuse("WRONG_VERSION");
  return { environment: version.environment, commit: version.commit, backend: version.backend,
    startedAt: version.startedAt, production: false };
}

export function captureResult({ targets, viewports, captures, sourceSha, version, failedAt = null }) {
  requireRegressionScenarios(targets);
  if (!Array.isArray(viewports) || viewports.length !== 2 ||
      viewports[0]?.label !== "desktop" || viewports[0]?.width !== 1440 || viewports[0]?.height !== 1024 ||
      viewports[1]?.label !== "mobile" || viewports[1]?.width !== 390 || viewports[1]?.height !== 844 ||
      !Array.isArray(captures)) refuse("CAPTURE_INVENTORY");
  const taken = new Map();
  for (const item of captures) {
    const key = `${item?.id}:${item?.viewport}`;
    if (taken.has(key) || !targets.some(target => target.id === item?.id) ||
        !viewports.some(viewport => `${viewport.width}x${viewport.height}` === item?.viewport) ||
        typeof item.file !== "string" || !item.file.startsWith("/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/gan-") ||
        !DIGEST.test(item.sha256 ?? "")) refuse("CAPTURE_INVENTORY");
    taken.set(key, item);
  }
  const rows = targets.flatMap(target => viewports.map(viewport => {
    const size = `${viewport.width}x${viewport.height}`;
    const item = taken.get(`${target.id}:${size}`);
    return { id: target.id, route: target.route, role: target.role, reference: target.reference,
      viewport: size, file: item?.file ?? null, sha256: item?.sha256 ?? null,
      status: item ? "CAPTURED_PENDING_VISUAL_REVIEW" :
        failedAt?.id === target.id && failedAt?.viewport === size ? "CAPTURE_FAILED" : "NOT_RUN" };
  }));
  const complete = !failedAt && rows.every(row => row.status === "CAPTURED_PENDING_VISUAL_REVIEW");
  return { environment: DEVELOPMENT, productionAccess: false, sourceSha,
    version, viewports, captures: rows, mechanicalStatus: complete ? "CAPTURED" : "INCOMPLETE",
    visualReview: "NOT_REVIEWED", status: complete ? "CAPTURED_PENDING_VISUAL_REVIEW" : "CAPTURE_INCOMPLETE" };
}
