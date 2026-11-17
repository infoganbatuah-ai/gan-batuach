// Keep the canonical Development default explicit and narrow. The installed
// Next CLI accepts both flags; Turbopack remains available only for diagnosis.
export function parseIntegrationArgs(args) {
  if (!Array.isArray(args) || args.length > 2 || new Set(args).size !== args.length
    || args.some(arg => arg !== '--ui-only' && arg !== '--webpack' && arg !== '--turbopack')
    || (args.includes('--webpack') && args.includes('--turbopack'))) {
    throw new Error('Integration accepts only --ui-only and one optional --webpack or --turbopack bundler flag.');
  }
  const uiOnly = args.includes('--ui-only');
  const turbopackDiagnostic = args.includes('--turbopack');
  return {
    uiOnly,
    bundler: turbopackDiagnostic ? 'TURBOPACK_DIAGNOSTIC_KNOWN_INTERMITTENT_FAILURE' : 'WEBPACK_STABLE_DEVELOPMENT',
    nextFlags: turbopackDiagnostic ? ['--turbopack'] : ['--webpack'],
  };
}
