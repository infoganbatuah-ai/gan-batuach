type Employment = { id: string; staff_id: string; status: string };
type Assignment = { staff_id: string; classroom_id: string; employment_id: string | null; garden_id: string; status: string };
type Classroom = { id: string; garden_id: string; name: string; status: string };

/** Display only current classrooms backed by an active employment in the selected garden. */
export function staffClassroomLabels(
  gardenId: string,
  employments: Employment[],
  assignments: Assignment[],
  classrooms: Classroom[]
): Map<string, string> {
  const activeEmployments = new Map(employments.filter((row) => row.status === "active").map((row) => [row.id, row.staff_id]));
  const activeClassrooms = new Map(classrooms.filter((row) => row.garden_id === gardenId && row.status === "active").map((row) => [row.id, row.name]));
  const names = new Map<string, Set<string>>();

  for (const row of assignments) {
    if (row.garden_id !== gardenId || row.status !== "active" || !row.employment_id) continue;
    if (activeEmployments.get(row.employment_id) !== row.staff_id) continue;
    const name = activeClassrooms.get(row.classroom_id)?.trim();
    if (!name) continue;
    const values = names.get(row.staff_id) ?? new Set<string>();
    values.add(name);
    names.set(row.staff_id, values);
  }

  return new Map([...names].map(([staffId, values]) => [staffId, [...values].sort((a, b) => a.localeCompare(b, "he")).join(" / ")]));
}
