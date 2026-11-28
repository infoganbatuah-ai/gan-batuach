export type AdminInspectionRow = {
  status: string | null;
  gardens?: { name?: string | null; city?: string | null } | null;
  inspectors?: { full_name?: string | null } | null;
};

const statuses = new Set(["open", "in_progress", "waiting_approval", "done", "overdue", "rejected", "blocked", "cancelled"]);

export function normalizeAdminInspectionFilters(params: { q?: string | string[]; status?: string | string[] }) {
  const rawQuery = typeof params.q === "string" ? params.q : "";
  const rawStatus = typeof params.status === "string" ? params.status : "";
  return {
    q: rawQuery.trim().slice(0, 80),
    status: statuses.has(rawStatus) ? rawStatus : "all"
  };
}

export function filterAdminInspections<T extends AdminInspectionRow>(rows: T[], filters: { q: string; status: string }): T[] {
  const query = filters.q.toLocaleLowerCase("he-IL");
  return rows.filter((row) => {
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (!query) return true;
    return [row.gardens?.name, row.gardens?.city, row.inspectors?.full_name]
      .some((value) => value?.toLocaleLowerCase("he-IL").includes(query));
  });
}
