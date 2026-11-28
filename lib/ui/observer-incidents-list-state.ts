export function observerIncidentsListState(hasError: boolean, incidentCount: number) {
  if (hasError) return "error" as const;
  return incidentCount > 0 ? "list" as const : "empty" as const;
}
