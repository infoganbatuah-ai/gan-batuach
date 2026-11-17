export type AdminRequestKind = "parent" | "staff";

type SelectionQuery = { kind?: string | string[]; id?: string | string[] };
type RequestRow = { id: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAdminRequestSelection(query: SelectionQuery): { kind: AdminRequestKind; id: string } | null {
  if ((query.kind !== "parent" && query.kind !== "staff") || typeof query.id !== "string" || !uuid.test(query.id)) return null;
  return { kind: query.kind, id: query.id };
}

export function selectAdminRequestRow<T extends RequestRow>(rows: T[], id: string): T | null {
  return rows.find((row) => row.id === id) ?? null;
}
