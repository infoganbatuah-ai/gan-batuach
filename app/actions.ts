"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { normalizeOptionalEmail, normalizeOptionalPhone } from "@/lib/onboarding/user-provisioning";

function value(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  if (rawValue && typeof rawValue === "object" && "name" in rawValue) {
    return String(rawValue.name ?? "").trim();
  }
  return String(rawValue ?? "").trim();
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((item) => String(item).trim()).filter(Boolean);
}

function identityValue(formData: FormData, key: string) {
  return value(formData, key).replace(/\D/g, "");
}

async function contactExists(supabase: Awaited<ReturnType<typeof createClient>>, email: string, phone: string) {
  const normalizedEmail = normalizeOptionalEmail(email);
  const normalizedPhone = normalizeOptionalPhone(phone);
  const [emailProfiles, emailLeads, phoneProfiles, phoneLeads] = await Promise.all([
    normalizedEmail ? supabase.from("profiles" as any).select("id", { count: "exact", head: true }).or(`email.eq.${normalizedEmail},username.eq.${normalizedEmail}`) : Promise.resolve({ count: 0 }),
    normalizedEmail ? supabase.from("leads" as any).select("id", { count: "exact", head: true }).eq("email", normalizedEmail) : Promise.resolve({ count: 0 }),
    normalizedPhone ? supabase.from("profiles" as any).select("id", { count: "exact", head: true }).eq("phone", normalizedPhone) : Promise.resolve({ count: 0 }),
    normalizedPhone ? supabase.from("leads" as any).select("id", { count: "exact", head: true }).eq("phone", normalizedPhone) : Promise.resolve({ count: 0 })
  ]);
  return {
    email: Boolean((emailProfiles.count ?? 0) + (emailLeads.count ?? 0)),
    phone: Boolean((phoneProfiles.count ?? 0) + (phoneLeads.count ?? 0))
  };
}

export async function createParentLead(formData: FormData) {
  const supabase = await createClient();
  const gardenId = value(formData, "garden_id") || null;
  const childName = value(formData, "child_name") || value(formData, "children_names");
  const parentIdentityNumber = identityValue(formData, "parent_identity_number");
  const childIdentityNumber = identityValue(formData, "child_identity_number");
  const requestedAgeGroup = value(formData, "requested_age_group");
  const requestedStartDate = value(formData, "requested_start_date");
  const address = value(formData, "address");
  const notes = [
    value(formData, "notes"),
    requestedAgeGroup ? `קבוצת גיל מבוקשת: ${requestedAgeGroup}` : "",
    requestedStartDate ? `תאריך כניסה מבוקש: ${requestedStartDate}` : "",
    address ? `כתובת: ${address}` : "",
    childName ? `ילד: ${childName}` : ""
  ]
    .filter(Boolean)
    .join("\n");
  const duplicateReader = isAdminClientConfigured() ? createAdminClient() : supabase;
  if (childIdentityNumber) {
    const [childExisting, fileExisting] = await Promise.all([
      duplicateReader.from("children" as any).select("id", { count: "exact", head: true }).eq("identity_number", childIdentityNumber),
      duplicateReader.from("permanent_child_files" as any).select("id", { count: "exact", head: true }).eq("identity_number", childIdentityNumber)
    ]);
    if ((childExisting.count ?? 0) + (fileExisting.count ?? 0) > 0) {
      redirect(`/join-parent?${gardenId ? `gardenId=${gardenId}&` : ""}error=${encodeURIComponent("ילד עם תעודת זהות זו כבר קיים במערכת. כדי להוסיף אותו לגן נוסף יש להתחבר למשתמש ההורה הקיים.")}`);
    }
  }
  if (parentIdentityNumber) {
    const [parentExisting, profileExisting] = await Promise.all([
      duplicateReader.from("parents" as any).select("id", { count: "exact", head: true }).eq("identity_number", parentIdentityNumber),
      duplicateReader.from("profiles" as any).select("id", { count: "exact", head: true }).eq("identity_number", parentIdentityNumber)
    ]);
    if ((parentExisting.count ?? 0) + (profileExisting.count ?? 0) > 0) {
      redirect(`/join-parent?${gardenId ? `gardenId=${gardenId}&` : ""}error=${encodeURIComponent("קיים כבר משתמש הורה במערכת. יש להתחבר לחשבון הקיים ולהגיש בקשת הצטרפות לגן נוסף.")}`);
    }
  }

  const leadRow = {
    garden_id: gardenId,
    lead_type: "parent",
    parent_name: value(formData, "parent_name"),
    parent_identity_number: parentIdentityNumber || null,
    phone: value(formData, "phone"),
    email: value(formData, "email") || null,
    child_name: childName || null,
    child_identity_number: childIdentityNumber || null,
    child_age: value(formData, "child_age") || null,
    requested_age_group: requestedAgeGroup || null,
    requested_start_date: requestedStartDate || null,
    address: address || null,
    notes,
    status: "new",
    source: "public_kindergarten_page",
    missing_details: []
  };

  const writer = isAdminClientConfigured() ? createAdminClient() : supabase;
  const writeResult = isAdminClientConfigured()
    ? await writer.from("leads" as any).insert(leadRow).select("id").single()
    : await writer.from("leads" as any).insert(leadRow);
  const lead = isAdminClientConfigured() ? writeResult.data : null;
  const error = writeResult.error;

  if (error) {
    const target = gardenId
      ? `/join-parent?gardenId=${encodeURIComponent(gardenId)}&error=${encodeURIComponent("לא ניתן לשלוח את בקשת ההצטרפות כרגע. נסו שוב או פנו לגן.")}`
      : `/join-parent?error=${encodeURIComponent("לא ניתן לשלוח את בקשת ההצטרפות כרגע. נסו שוב או בחרו גן מחדש.")}`;
    console.error("[parent-lead:create] insert failed", { garden_id: gardenId, error: error.message });
    redirect(target);
  }

  if (gardenId && isAdminClientConfigured()) {
    const admin = writer;
    const { data: garden } = await admin.from("gardens" as any).select("id, name, manager_id, owner_profile_id").eq("id", gardenId).maybeSingle();
    const recipients = Array.from(new Set([garden?.manager_id, garden?.owner_profile_id].filter(Boolean)));
    if (recipients.length) {
      const notificationResult = await admin.from("notifications" as any).insert(recipients.map((recipientId) => ({
        garden_id: gardenId,
        recipient_id: recipientId,
        title: "בקשת הצטרפות חדשה לגן",
        body: `${leadRow.parent_name || "הורה"} שלח/ה בקשת רישום${leadRow.child_name ? ` עבור ${leadRow.child_name}` : ""}.`,
        entity_type: "lead",
        entity_id: lead?.id,
        severity: "medium",
        metadata: { href: "/dashboard/garden/leads", lead_id: lead?.id, garden_name: garden?.name ?? null, child_name: leadRow.child_name, parent_name: leadRow.parent_name }
      })));
      if (notificationResult.error) {
        console.error("[parent-lead:create] notification failed", { garden_id: gardenId, lead_id: lead?.id, error: notificationResult.error.message });
      }
    }
    const auditResult = await admin.from("audit_logs" as any).insert({ garden_id: gardenId, entity_type: "leads", entity_id: lead?.id, action: "parent_lead_submitted", after_data: leadRow });
    if (auditResult.error) {
      console.error("[parent-lead:create] audit log failed", { garden_id: gardenId, lead_id: lead?.id, error: auditResult.error.message });
    }
  }

  revalidatePath("/");
  revalidatePath("/gardens");
  revalidatePath("/dashboard/garden");
  revalidatePath("/dashboard/garden/leads");
  const successRedirect = value(formData, "success_redirect");
  redirect(successRedirect && successRedirect.startsWith("/") ? successRedirect : "/gardens?lead=sent");
}

export async function createGardenLead(formData: FormData) {
  const supabase = await createClient();
  const duplicate = await contactExists(supabase, value(formData, "email"), value(formData, "phone"));
  if (duplicate.email) redirect("/join-kindergarten?error=" + encodeURIComponent("המייל כבר קיים במערכת"));
  if (duplicate.phone) redirect("/join-kindergarten?error=" + encodeURIComponent("הטלפון כבר קיים במערכת"));
  const ownerIdentityNumber = identityValue(formData, "owner_identity_number");
  const managerIdentityNumber = identityValue(formData, "manager_identity_number");
  const identityReader = isAdminClientConfigured() ? createAdminClient() : supabase;
  const identityChecks = [ownerIdentityNumber, managerIdentityNumber].filter(Boolean);
  if (identityChecks.length) {
    const { count } = await identityReader.from("profiles" as any).select("id", { count: "exact", head: true }).in("identity_number", identityChecks);
    if ((count ?? 0) > 0) redirect("/join-kindergarten?error=" + encodeURIComponent("משתמש מנהלת/בעלים כבר קיים. ניתן להוסיף גן נוסף לחשבון הקיים."));
  }
  const notes = [
    value(formData, "notes"),
    values(formData, "age_groups").length ? `קבוצות גיל: ${values(formData, "age_groups").join(", ")}` : "",
    value(formData, "custom_age_range") ? `טווח גיל מותאם: ${value(formData, "custom_age_range")}` : "",
    value(formData, "capacity") ? `קיבולת: ${value(formData, "capacity")}` : "",
    value(formData, "manager_name") ? `מנהל/גננת: ${value(formData, "manager_name")}` : "",
    value(formData, "food_kitchen") ? `מטבח/אוכל: ${value(formData, "food_kitchen")}` : "",
    value(formData, "address") ? `כתובת: ${value(formData, "address")}` : "",
    value(formData, "camera_status") ? `מצלמות: ${value(formData, "camera_status")}` : "",
    value(formData, "documents_status") ? `מסמכים: ${value(formData, "documents_status")}` : "",
    value(formData, "business_document_name") ? `מסמך עסק: ${value(formData, "business_document_name")}` : "",
    value(formData, "license_document_name") ? `רישיון גן: ${value(formData, "license_document_name")}` : "",
    value(formData, "teacher_certificate_name") ? `אישור לימודים/הוראה: ${value(formData, "teacher_certificate_name")}` : "",
    value(formData, "additional_documents_note") ? `מסמכים נוספים: ${value(formData, "additional_documents_note")}` : "",
    value(formData, "kindergarten_terms_commitment") ? "התחייבות לתקנון גני ילדים: אושרה" : ""
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await supabase.from("leads").insert({
    lead_type: "garden",
    garden_name: value(formData, "garden_name"),
    owner_name: value(formData, "owner_name"),
    manager_name: value(formData, "manager_name") || null,
    manager_identity_number: managerIdentityNumber || null,
    owner_identity_number: ownerIdentityNumber || null,
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
  const duplicate = await contactExists(supabase, value(formData, "email"), value(formData, "phone"));
  if (duplicate.email) redirect("/join-inspector?error=" + encodeURIComponent("המייל כבר קיים במערכת"));
  if (duplicate.phone) redirect("/join-inspector?error=" + encodeURIComponent("הטלפון כבר קיים במערכת"));
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
