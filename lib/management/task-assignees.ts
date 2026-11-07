export type TaskEmployment = {
  profile_id: string | null;
  start_date: string | null;
  end_date: string | null;
  staff?: {
    full_name?: string | null;
    profile_id?: string | null;
    approved_to_work?: boolean | null;
    onboarding_status?: string | null;
  } | null;
};

/** Only offer staff from an active employment in the selected Garden. The RPC remains authoritative. */
export function taskAssigneesFromEmployments(rows: TaskEmployment[], today: string) {
  const assignees = new Map<string, { id: string; name: string }>();
  for (const row of rows) {
    const staff = row.staff;
    if (!row.profile_id || row.profile_id !== staff?.profile_id ||
        !staff.approved_to_work || staff.onboarding_status !== "active" ||
        (row.start_date && row.start_date > today) ||
        (row.end_date && row.end_date < today)) continue;
    assignees.set(row.profile_id, { id: row.profile_id, name: staff.full_name?.trim() || "איש צוות" });
  }
  return [...assignees.values()];
}
