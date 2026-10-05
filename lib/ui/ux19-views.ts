export const ux19Views = [
  "loading",
  "empty",
  "error",
  "permission-denied",
  "unavailable",
  "offline-degraded",
  "success",
  "destructive-confirmation",
  "validation",
  "status-variants",
  "calendar-date",
  "select-dropdown",
  "toggles",
  "search-filter",
  "settings",
  "modal-drawer",
  "mixed-direction",
  "accessibility"
] as const;

export type Ux19View = (typeof ux19Views)[number];
