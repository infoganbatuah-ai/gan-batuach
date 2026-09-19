export const localKeys = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);

export function integrationEnvironment(local, { uiOnly = false, sha, timestamp, system = {} } = {}) {
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
    ...env, ...local,
    NODE_ENV: 'development', APP_ENV: 'local', NEXT_PUBLIC_APP_ENV: 'local',
    INTEGRATION_DEVELOPMENT: 'true', INTEGRATION_COMMIT: sha, INTEGRATION_STARTED_AT: timestamp,
    INTEGRATION_BACKEND: uiOnly ? 'UNAVAILABLE_UI_ONLY' : 'LOCAL_SUPABASE',
    NEXT_PUBLIC_SUPABASE_URL: uiOnly ? 'http://127.0.0.1:54321' : local.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: uiOnly ? 'integration-ui-only-no-backend' : local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    PRODUCTION_ACTIVATION_APPROVED: 'false', LIVE_ACTIVATION_CONFIRM: '', NEXT_TELEMETRY_DISABLED: '1',
  };
}
