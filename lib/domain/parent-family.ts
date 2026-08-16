import type { SupabaseClient } from "@supabase/supabase-js";

function uniqById(rows: any[]) {
  return rows.filter((row, index, all) => row?.id && all.findIndex((item) => item?.id === row.id) === index);
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export async function getParentFamilyContext(userSupabase: SupabaseClient<any, any, any>, profile: any) {
  const supabase = userSupabase;
  const parentByProfile = await supabase.from("parents" as any).select("*").eq("profile_id", profile.id);
  const parentByUser = await supabase.from("parents" as any).select("*").eq("user_id", profile.id);
  const parents = uniqById([...(parentByProfile.data ?? []), ...(parentByUser.data ?? [])]);
  const parentIds = parents.map((parent) => parent.id);

  const linkRows = await supabase
    .from("parent_kindergarten_links" as any)
    .select("id, parent_id, parent_profile_id, garden_id, kindergarten_id, status, source, created_at, approved_at, notes")
    .or(`parent_profile_id.eq.${profile.id}${parentIds.length ? `,parent_id.in.(${parentIds.join(",")})` : ""}`)
    .in("status", ["pending", "active"]);
  if (linkRows.error) console.error("Parent family links query failed", linkRows.error);

  const childByParent = parentIds.length
    ? await supabase
      .from("children" as any)
      .select("id, garden_id, permanent_child_file_id, primary_parent_id, full_name, birth_date, photo_url, face_image_url, status, allergies, hmo, medical_notes, age_group, classroom, payment_group_id, monthly_fee, custom_monthly_fee, payment_status, last_payment_date, next_payment_due, valid_until, debt_amount, payments_paused, approval_notes, manager_response")
      .in("primary_parent_id", parentIds)
      .limit(100)
    : { data: [], error: null };
  if (childByParent.error) console.error("Parent family children query failed", childByParent.error);

  const fileRows = await supabase
    .from("permanent_child_files" as any)
    .select("id, primary_parent_profile_id, primary_parent_id, full_name, birth_date, photo_url, face_image_url, allergies, hmo, medical_notes")
    .eq("primary_parent_profile_id", profile.id)
    .limit(100);
  if (fileRows.error) console.error("Parent family child files query failed", fileRows.error);

  const fileIds = (fileRows.data ?? []).map((file: any) => file.id);
  const enrollmentRows = fileIds.length
    ? await supabase
      .from("child_kindergarten_enrollments" as any)
      .select("id, child_id, permanent_child_file_id, garden_id, kindergarten_id, status, start_date, end_date, age_group_id, classroom_name, notes, kindergarten_fee_groups(group_name, monthly_fee)")
      .in("permanent_child_file_id", fileIds)
      .limit(150)
    : { data: [], error: null };
  if (enrollmentRows.error) console.error("Parent family enrollments query failed", enrollmentRows.error);

  const children = uniqById([...(childByParent.data ?? [])]);
  const childrenById = new Map(children.map((child: any) => [child.id, child]));
  const filesById = new Map((fileRows.data ?? []).map((file: any) => [file.id, file]));
  const enrollments = ((enrollmentRows.data ?? []) as any[]).map((enrollment) => {
    const child = enrollment.child_id ? childrenById.get(enrollment.child_id) : null;
    const file = enrollment.permanent_child_file_id ? filesById.get(enrollment.permanent_child_file_id) : null;
    return {
      ...enrollment,
      child: child ?? file ?? null,
      full_name: child?.full_name ?? file?.full_name ?? "ילד/ה",
      birth_date: child?.birth_date ?? file?.birth_date ?? null,
      photo_url: child?.photo_url ?? child?.face_image_url ?? file?.photo_url ?? file?.face_image_url ?? null,
      allergies: child?.allergies ?? file?.allergies ?? null,
      hmo: child?.hmo ?? file?.hmo ?? null,
      medical_notes: child?.medical_notes ?? file?.medical_notes ?? null,
      payment_status: child?.payment_status ?? "unpaid",
      monthly_fee: child?.custom_monthly_fee ?? enrollment.kindergarten_fee_groups?.monthly_fee ?? child?.monthly_fee ?? null,
      next_payment_due: child?.next_payment_due ?? null,
      valid_until: child?.valid_until ?? null,
      debt_amount: child?.debt_amount ?? 0
    };
  });

  const legacyEnrollments = children
    .filter((child: any) => !enrollments.some((enrollment) => enrollment.child_id === child.id && enrollment.garden_id === (child.garden_id ?? child.kindergarten_id)))
    .map((child: any) => ({
      id: `legacy-${child.id}`,
      child_id: child.id,
      permanent_child_file_id: child.permanent_child_file_id,
      garden_id: child.garden_id ?? child.kindergarten_id,
      kindergarten_id: child.garden_id ?? child.kindergarten_id,
      status: child.status,
      classroom_name: child.classroom ?? child.age_group,
      child,
      full_name: child.full_name,
      birth_date: child.birth_date,
      photo_url: child.photo_url ?? child.face_image_url,
      allergies: child.allergies,
      hmo: child.hmo,
      medical_notes: child.medical_notes,
      payment_status: child.payment_status,
      monthly_fee: child.custom_monthly_fee ?? child.monthly_fee,
      next_payment_due: child.next_payment_due,
      valid_until: child.valid_until,
      debt_amount: child.debt_amount ?? 0
    }));

  const allEnrollments = [...enrollments, ...legacyEnrollments];
  const linkedGardenIds = uniq([
    profile.garden_id,
    ...parents.flatMap((parent: any) => [parent.garden_id, parent.kindergarten_id]),
    ...((linkRows.data ?? []) as any[]).flatMap((link) => [link.garden_id, link.kindergarten_id]),
    ...allEnrollments.map((enrollment: any) => enrollment.garden_id ?? enrollment.kindergarten_id)
  ]);

  const gardensRes = linkedGardenIds.length
    ? await supabase
      .from("gardens" as any)
      .select("id, name, logo_url, image_url, phone, city, address, manager_id, owner_profile_id, last_inspection_score, safe_status, ages, framework_type, manager:profiles!gardens_manager_id_fkey(full_name, phone)")
      .in("id", linkedGardenIds)
    : { data: [], error: null };
  if (gardensRes.error) console.error("Parent family gardens query failed", gardensRes.error);

  return {
    parents,
    parentIds,
    links: linkRows.data ?? [],
    children,
    childFiles: fileRows.data ?? [],
    enrollments: allEnrollments,
    gardenIds: linkedGardenIds,
    gardens: gardensRes.data ?? []
  };
}
