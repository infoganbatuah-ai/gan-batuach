export function observerRecordingMatchesQuery(query: string, ...values: Array<string | null | undefined>) {
  const needle = query.trim().toLocaleLowerCase("he-IL");
  return !needle || values.some(value => String(value ?? "").toLocaleLowerCase("he-IL").includes(needle));
}
