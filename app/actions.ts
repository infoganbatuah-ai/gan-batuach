"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createParentLead(formData: FormData) {
  const supabase = createAdminClient();
  const gardenId = value(formData, "garden_id") || null;
  const notes = [
    value(formData, "notes"),
    value(formData, "desired_enrollment_date") ? `תאריך כניסה רצוי: ${value(formData, "desired_enrollment_date")}` : "",
    value(formData, "children_names") ? `ילדים: ${value(formData, "children_names")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await supabase.from("leads").insert({
    garden_id: gardenId,
    lead_type: "parent",
    parent_name: value(formData, "parent_name"),
    phone: value(formData, "phone"),
    email: value(formData, "email") || null,
    child_name: value(formData, "children_names") || null,
    child_age: value(formData, "child_age") || null,
    notes,
    status: "new_parent_lead"
  });

  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/gardens");
  redirect("/gardens?lead=sent");
}

export async function createGardenLead(formData: FormData) {
  const supabase = createAdminClient();
  const notes = [
    value(formData, "notes"),
    value(formData, "age_groups") ? `קבוצות גיל: ${value(formData, "age_groups")}` : "",
    value(formData, "camera_status") ? `מצלמות: ${value(formData, "camera_status")}` : "",
    value(formData, "documents_status") ? `מסמכים: ${value(formData, "documents_status")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await supabase.from("leads").insert({
    lead_type: "garden",
    garden_name: value(formData, "garden_name"),
    owner_name: value(formData, "owner_name"),
    city: value(formData, "city"),
    phone: value(formData, "phone"),
    email: value(formData, "email") || null,
    children_count: Number(value(formData, "children_count") || 0),
    staff_count: Number(value(formData, "staff_count") || 0),
    notes,
    status: "new_garden_onboarding"
  });

  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/join-kindergarten?lead=sent");
}
