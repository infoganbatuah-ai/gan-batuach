type ChildRow = {
  id?: unknown;
  full_name?: unknown;
  photo_url?: unknown;
  garden_id?: unknown;
};

type EnrollmentRow = {
  child_id?: unknown;
  garden_id?: unknown;
  full_name?: unknown;
  photo_url?: unknown;
  child?: { full_name?: unknown; photo_url?: unknown } | null;
};

export type ParentAttendanceChild = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  garden_id: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Attendance and pickup use the Garden child row ID. A permanent child file or
// enrollment ID must never be sent as a child_id, including for a non-primary guardian.
export function parentAttendanceChildren(children: ChildRow[], enrollments: EnrollmentRow[]): ParentAttendanceChild[] {
  const byId = new Map<string, ParentAttendanceChild>();
  for (const child of children) {
    const id = text(child.id);
    if (!id) continue;
    byId.set(id, {
      id,
      full_name: text(child.full_name),
      photo_url: text(child.photo_url),
      garden_id: text(child.garden_id)
    });
  }
  for (const enrollment of enrollments) {
    const id = text(enrollment.child_id);
    if (!id) continue;
    const prior = byId.get(id);
    byId.set(id, {
      id,
      full_name: prior?.full_name ?? text(enrollment.full_name) ?? text(enrollment.child?.full_name),
      photo_url: prior?.photo_url ?? text(enrollment.photo_url) ?? text(enrollment.child?.photo_url),
      garden_id: prior?.garden_id ?? text(enrollment.garden_id)
    });
  }
  return [...byId.values()];
}
