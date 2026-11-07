// The canonical Development launcher accepts only these two explicit modes.
// Keep the default on Next's installed Turbopack behavior; Webpack is a
// diagnostic opt-in, never an arbitrary Next/Node flag passthrough.
export function parseIntegrationArgs(args) {
  if (!Array.isArray(args) || args.length > 2 || new Set(args).size !== args.length
    || args.some(arg => arg !== '--ui-only' && arg !== '--webpack')) {
    throw new Error('Integration accepts only --ui-only and the explicit --webpack diagnostic flag.');
  }
  const uiOnly = args.includes('--ui-only');
  const webpackDiagnostic = args.includes('--webpack');
  return {
    uiOnly,
    bundler: webpackDiagnostic ? 'WEBPACK_DIAGNOSTIC' : 'TURBOPACK_DEFAULT',
    nextFlags: webpackDiagnostic ? ['--webpack'] : [],
  };
}
