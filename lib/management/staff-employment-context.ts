import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const STAFF_GARDEN_COOKIE = "gb_staff_active_garden";

export type StaffEmployment = {
  employment_id: string;
  staff_id: string;
  garden_id: string;
  garden_name: string;
  role_title: string | null;
  classroom_names: string[];
};

export function chooseStaffEmployment(employments: StaffEmployment[], selectedId: string | null, legacyId: string | null) {
  if (selectedId) return employments.find(item => item.garden_id === selectedId) ?? null;
  if (legacyId) {
    const legacy = employments.find(item => item.garden_id === legacyId);
    if (legacy) return legacy;
  }
  return employments.length === 1 ? employments[0] : null;
}

export async function resolveStaffEmploymentContext(profile: { id: string; garden_id?: string | null }) {
  const supabase = await createClient();
  const result = await supabase.rpc("staff_employments_for_current_user" as never);
  if (result.error) return { available: false as const, employments: [] as StaffEmployment[], activeEmployment: null };
  const employments = (result.data ?? []) as StaffEmployment[];
  const selectedId = (await cookies()).get(STAFF_GARDEN_COOKIE)?.value ?? null;
  return { available: true as const, employments, activeEmployment: chooseStaffEmployment(employments, selectedId, profile.garden_id ?? null) };
}
