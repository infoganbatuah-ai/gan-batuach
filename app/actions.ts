"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((item) => String(item).trim()).filter(Boolean);
}

export async function createParentLead(formData: FormData) {
  const supabase = await createClient();
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

  if (error) redirect(`/gardens?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath("/gardens");
  redirect("/gardens?lead=sent");
}

export async function createGardenLead(formData: FormData) {
  const supabase = await createClient();
  const notes = [
    value(formData, "notes"),
    values(formData, "age_groups").length ? `קבוצות גיל: ${values(formData, "age_groups").join(", ")}` : "",
    value(formData, "custom_age_range") ? `טווח גיל מותאם: ${value(formData, "custom_age_range")}` : "",
    value(formData, "capacity") ? `קיבולת: ${value(formData, "capacity")}` : "",
    value(formData, "manager_name") ? `מנהל/גננת: ${value(formData, "manager_name")}` : "",
    value(formData, "food_kitchen") ? `מטבח/אוכל: ${value(formData, "food_kitchen")}` : "",
    value(formData, "address") ? `כתובת: ${value(formData, "address")}` : "",
    value(formData, "camera_status") ? `מצלמות: ${value(formData, "camera_status")}` : "",
    value(formData, "documents_status") ? `מסמכים: ${value(formData, "documents_status")}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await supabase.from("leads").insert({
    lead_type: "garden",
    garden_name: value(formData, "garden_name"),
    owner_name: value(formData, "owner_name"),
    manager_name: value(formData, "manager_name") || null,
    city: value(formData, "city"),
    address: value(formData, "address") || null,
    age_groups: values(formData, "age_groups"),
    capacity: Number(value(formData, "capacity") || 0),
    phone: value(formData, "phone"),
    email: value(formData, "email") || null,
    children_count: Number(value(formData, "children_count") || 0),
    staff_count: Number(value(formData, "staff_count") || 0),
    notes,
    status: "new"
  });

  if (error) redirect(`/join-kindergarten?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath("/dashboard/admin");
  redirect("/join-kindergarten?lead=sent");
}

export async function createInspectorLead(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("leads").insert({
    lead_type: "inspector",
    parent_name: value(formData, "full_name"),
    city: value(formData, "city_area"),
    phone: value(formData, "phone"),
    email: value(formData, "email") || null,
    experience: value(formData, "experience") || null,
    certifications: value(formData, "certifications") || null,
    notes: value(formData, "notes") || null,
    status: "new"
  });

  if (error) redirect(
    "/join-inspector?error=" + encodeURIComponent(error.message)
  );
  revalidatePath("/");
  revalidatePath("/dashboard/admin");
  redirect("/join-inspector?lead=sent");
}
