export const localKeys = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MANAGEMENT_INVITATION_SECRET',
  'DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER',
  'DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL',
]);

// Next dev changes only its generated type imports; never exempt arbitrary edits.
export function isGeneratedNextEnv(current, baseline) {
  return current === baseline || current === baseline.replaceAll('import "./.next/types/', 'import "./.next/dev/types/');
}

const cameraPilotKeys = new Set([
  "GAN_CAMERA_PILOT_QA", "GAN_CAMERA_PILOT_GARDEN", "GAN_CAMERA_PILOT_SITE",
  "GAN_CAMERA_PILOT_CAMERA", "GAN_CAMERA_PILOT_VIEWER", "GAN_CAMERA_PILOT_ORIGIN",
  "GAN_CAMERA_PILOT_SERVICE_TOKEN", "GAN_CAMERA_PILOT_SIGNING_KEY"
]);

function validatedCameraPilot(pilot, uiOnly) {
  if (Object.keys(pilot).length === 0) return {};
  const scopeKey = "GAN_CAMERA_PILOT_SCOPE_TOKEN";
  const roleKey = "GAN_CAMERA_PILOT_SCOPE_ROLE";
  if (uiOnly || ![...cameraPilotKeys].every(key => Object.hasOwn(pilot, key)) ||
      !Object.keys(pilot).every(key => cameraPilotKeys.has(key) || key === scopeKey || key === roleKey) ||
      (Object.hasOwn(pilot, scopeKey) &&
        (!/^[A-Za-z0-9_-]{32,128}$/.test(pilot[scopeKey]) || pilot[scopeKey] === pilot.GAN_CAMERA_PILOT_SERVICE_TOKEN)) ||
      (Object.hasOwn(pilot, roleKey) &&
        (!Object.hasOwn(pilot, scopeKey) || !["parent", "staff"].includes(pilot[roleKey]))) ||
      !Object.values(pilot).every(value => typeof value === "string" && value.trim()) ||
      pilot.GAN_CAMERA_PILOT_QA !== "1") throw new Error("Invalid private synthetic camera pilot configuration.");
  const origin = pilot.GAN_CAMERA_PILOT_ORIGIN;
  if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin) || !new URL(origin).port) {
    throw new Error("Synthetic camera pilot requires a fixed loopback listener.");
  }
  return pilot;
}

export function integrationEnvironment(local, { uiOnly = false, sha, timestamp, system = {}, cameraPilot = {} } = {}) {
  for (const key of Object.keys(local)) if (!localKeys.has(key)) throw new Error(`Unapproved integration variable: ${key}`);
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'].filter(k => system[k]).map(k => [k, system[k]]));
  if (uiOnly && Object.keys(local).length) throw new Error('UI-only preview must not load backend credentials.');
  if (!uiOnly) {
    if (!local.NEXT_PUBLIC_SUPABASE_URL || !local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('A verified isolated local Supabase configuration is required.');
    const url = new URL(local.NEXT_PUBLIC_SUPABASE_URL);
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Integration backend must be an explicit HTTP loopback address, without credentials, path or query. Remote/Production URLs are forbidden.');
    }
  }
  return {
    ...env, ...local, ...validatedCameraPilot(cameraPilot, uiOnly),
    NODE_ENV: 'development', APP_ENV: 'local', NEXT_PUBLIC_APP_ENV: 'local',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000',
    INTEGRATION_DEVELOPMENT: 'true', INTEGRATION_COMMIT: sha, INTEGRATION_STARTED_AT: timestamp,
    INTEGRATION_BACKEND: uiOnly ? 'UNAVAILABLE_UI_ONLY' : 'LOCAL_SUPABASE',
    NEXT_PUBLIC_SUPABASE_URL: uiOnly ? 'http://127.0.0.1:54321' : local.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: uiOnly ? 'integration-ui-only-no-backend' : local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    PRODUCTION_ACTIVATION_APPROVED: 'false', LIVE_ACTIVATION_CONFIRM: '', NEXT_TELEMETRY_DISABLED: '1',
  };
}
