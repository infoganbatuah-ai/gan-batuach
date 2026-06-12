"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { kindergartenAgeGroups, regulatoryAcceptanceItems } from "@/lib/domain/kindergarten-onboarding";
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

function normalizeGrowthLeadSource(lead: Record<string, any>) {
  const source = String(lead.source ?? "");
  if (source === "demo_booking") return "demo_booking";
  if (source === "parent_request") return "parent_request";
  if (source.includes("referral")) return "referral";
  if (source.includes("campaign")) return "campaign";
  if (lead.lead_type === "garden") return "kindergarten_registration";
  return "campaign";
}

function normalizeGrowthLeadStatus(status?: string | null) {
  const normalized = String(status ?? "new");
  if (["new", "contacted", "qualified", "approved", "converted", "rejected"].includes(normalized)) return normalized;
  if (["lead_review", "lead_approved", "registration_pending", "credentials_sent", "onboarding_in_progress", "onboarding_submitted", "pending_final_approval"].includes(normalized)) return "qualified";
  if (["active"].includes(normalized)) return "converted";
  if (["not_relevant", "archived"].includes(normalized)) return "rejected";
  return "new";
}

function normalizeGrowthFunnelStage(stage?: string | null, leadSource?: string) {
  const normalized = String(stage ?? "");
  if (["visit", "lead", "demo", "qualification", "approval", "conversion", "activation", "lost"].includes(normalized)) return normalized;
  if (["book_demo", "trial"].includes(normalized)) return "demo";
  if (["subscription", "converted"].includes(normalized)) return "conversion";
  if (["parent_request", "learn"].includes(normalized)) return "lead";
  if (leadSource === "demo_booking") return "demo";
  return "lead";
}

async function mirrorGrowthLead(supabase: Awaited<ReturnType<typeof createClient>>, lead: Record<string, any>) {
  if (!lead?.id) return;
  try {
    const leadSource = normalizeGrowthLeadSource(lead);
    const contactName = lead.manager_name || lead.owner_name || lead.parent_name || null;
    const { error } = await supabase.from("growth_leads" as any).insert({
      source_lead_id: lead.id,
      lead_source: leadSource,
      status: normalizeGrowthLeadStatus(lead.status),
      funnel_stage: normalizeGrowthFunnelStage(lead.funnel_stage, leadSource),
      interest_score: Math.max(0, Math.min(100, Number(lead.lead_score ?? 0))),
      garden_name: lead.garden_name || null,
      parent_name: lead.parent_name || null,
      contact_name: contactName,
      manager_name: lead.manager_name || null,
      phone: lead.phone || null,
      email: lead.email || null,
      city: lead.city || null,
      address: lead.address || null,
      campaign: lead.campaign || null,
      utm_source: lead.utm_source || null,
      utm_medium: lead.utm_medium || null,
      utm_campaign: lead.utm_campaign || null,
      qualification: lead.qualification || {},
      metadata: { source: lead.source ?? null, lead_type: lead.lead_type ?? null, conversion_goal: lead.conversion_goal ?? null }
    });
    if (error && error.code !== "23505") {
      console.error("[growth-lead:mirror] insert failed", error.message);
    }
  } catch (error) {
    console.error("[growth-lead:mirror] skipped", error);
  }
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
  const selectedAgeGroups = values(formData, "age_groups");
  const allowedAgeGroups = new Set(kindergartenAgeGroups.map((group) => group.key));
  const validAgeGroups = selectedAgeGroups.filter((group) => allowedAgeGroups.has(group as any));
  if (validAgeGroups.length === 0) redirect("/join-kindergarten?error=" + encodeURIComponent("יש לבחור לפחות קבוצת גיל אחת"));
  const acceptedTerms = values(formData, "regulatory_acceptance");
  const requiredTerms = regulatoryAcceptanceItems.map((item) => item.key);
  const missingTerms = requiredTerms.filter((item) => !acceptedTerms.includes(item));
  if (missingTerms.length) redirect("/join-kindergarten?error=" + encodeURIComponent("יש לאשר את כל תנאי הרישום והאמנה"));
  const city = value(formData, "city");
  const street = value(formData, "street");
  const buildingNumber = value(formData, "building_number");
  const address = value(formData, "address") || [street, buildingNumber, city].filter(Boolean).join(", ");
  const notes = [
    value(formData, "notes"),
    validAgeGroups.length ? `קבוצות גיל: ${validAgeGroups.join(", ")}` : "",
    value(formData, "custom_age_range") ? `טווח גיל מותאם: ${value(formData, "custom_age_range")}` : "",
    value(formData, "capacity") ? `קיבולת: ${value(formData, "capacity")}` : "",
    value(formData, "manager_name") ? `מנהל/גננת: ${value(formData, "manager_name")}` : "",
    value(formData, "food_kitchen") ? `מטבח/אוכל: ${value(formData, "food_kitchen")}` : "",
    address ? `כתובת: ${address}` : "",
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
  const qualification = {
    children_count: Number(value(formData, "children_count") || 0),
    staff_count: Number(value(formData, "staff_count") || 0),
    capacity: Number(value(formData, "capacity") || 0),
    camera_status: value(formData, "camera_status") || null,
    documents_status: value(formData, "documents_status") || null,
    requested_plan: value(formData, "requested_plan") || null,
    urgency: value(formData, "urgency") || null,
    street: street || null,
    building_number: buildingNumber || null,
    age_groups: validAgeGroups,
    regulatory_acceptance: acceptedTerms,
    regulatory_terms_version: value(formData, "regulatory_terms_version") || "2026-06-13",
    terms_accepted_at: new Date().toISOString()
  };
  const leadScore = Math.min(100, 30 + (qualification.children_count ? 20 : 0) + (qualification.camera_status ? 15 : 0) + (value(formData, "email") ? 10 : 0));

  const leadPayload = {
    lead_type: "garden",
    garden_name: value(formData, "garden_name"),
    owner_name: value(formData, "owner_name"),
    manager_name: value(formData, "manager_name") || null,
    manager_identity_number: managerIdentityNumber || null,
    owner_identity_number: ownerIdentityNumber || null,
    city,
    address: address || null,
    age_groups: validAgeGroups,
    capacity: Number(value(formData, "capacity") || 0),
    phone: value(formData, "phone"),
    email: value(formData, "email") || null,
    children_count: Number(value(formData, "children_count") || 0),
    staff_count: Number(value(formData, "staff_count") || 0),
    notes,
    status: "registration_pending",
    source: value(formData, "source") || "public_website",
    campaign: value(formData, "campaign") || "kindergarten_conversion",
    utm_source: value(formData, "utm_source") || null,
    utm_medium: value(formData, "utm_medium") || null,
    utm_campaign: value(formData, "utm_campaign") || null,
    funnel_stage: value(formData, "funnel_stage") || "book_demo",
    conversion_goal: value(formData, "conversion_goal") || "demo_to_trial",
    qualification,
    lead_score: leadScore
  };

  const { data: lead, error } = await supabase.from("leads").insert(leadPayload).select("id").single();

  if (error) redirect(`/join-kindergarten?error=${encodeURIComponent(error.message)}`);
  if (lead?.id) {
    await mirrorGrowthLead(supabase, { id: lead.id, ...leadPayload });
    await supabase.from("kindergarten_legal_acceptances" as any).insert(acceptedTerms.map((acceptanceType) => ({
      lead_id: lead.id,
      acceptance_type: acceptanceType,
      accepted: true,
      version: qualification.regulatory_terms_version,
      metadata: { source: "public_kindergarten_registration" }
    })));
  }
  revalidatePath("/");
  revalidatePath("/dashboard/admin");
  redirect("/join-kindergarten?lead=sent");
}

export async function createDemoBooking(formData: FormData) {
  const supabase = await createClient();
  const contactName = value(formData, "contact_name");
  const contactPhone = value(formData, "contact_phone");
  const contactEmail = value(formData, "contact_email");
  const gardenName = value(formData, "garden_name");
  const city = value(formData, "city");
  const childrenCount = Number(value(formData, "children_count") || 0);
  const staffCount = Number(value(formData, "staff_count") || 0);
  const preferredTime = value(formData, "preferred_time");
  const preferredDemoDate = value(formData, "preferred_demo_date");
  const qualification = {
    role: value(formData, "role"),
    current_tools: value(formData, "current_tools"),
    biggest_challenge: value(formData, "biggest_challenge"),
    camera_status: value(formData, "camera_status"),
    decision_timeline: value(formData, "decision_timeline"),
    interest: values(formData, "interest"),
    preferred_demo_date: preferredDemoDate || null
  };
  const score = Math.min(100, 35 + (childrenCount >= 20 ? 20 : 0) + (contactEmail ? 10 : 0) + (qualification.decision_timeline === "now" ? 20 : 0));

  const leadPayload = {
    lead_type: "garden",
    garden_name: gardenName,
    manager_name: contactName,
    city,
    phone: contactPhone,
    email: contactEmail || null,
    children_count: childrenCount,
    staff_count: staffCount,
    notes: [
      `בקשת הדגמה: ${preferredDemoDate || preferredTime || "לא צוין מועד מועדף"}`,
      qualification.biggest_challenge ? `אתגר מרכזי: ${qualification.biggest_challenge}` : "",
      qualification.current_tools ? `כלים קיימים: ${qualification.current_tools}` : "",
      qualification.interest?.length ? `עניין: ${qualification.interest.join(", ")}` : ""
    ].filter(Boolean).join("\n"),
    status: "new",
    source: "demo_booking",
    campaign: "kindergarten_demo_funnel",
    funnel_stage: "book_demo",
    conversion_goal: "demo_to_trial",
    qualification,
    lead_score: score
  };

  const { data: lead, error: leadError } = await supabase
    .from("leads" as any)
    .insert(leadPayload)
    .select("id")
    .single();

  if (leadError) {
    redirect(`/book-demo?error=${encodeURIComponent("לא ניתן לשלוח בקשת הדגמה כרגע. נסו שוב או צרו קשר.")}`);
  }
  await mirrorGrowthLead(supabase, { id: lead?.id, ...leadPayload });

  const { error: bookingError } = await supabase.from("demo_booking_requests" as any).insert({
    lead_id: lead?.id,
    garden_name: gardenName,
    contact_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail || null,
    city,
    children_count: childrenCount,
    staff_count: staffCount,
    preferred_time: preferredTime || null,
    preferred_demo_date: preferredDemoDate || null,
    qualification,
    status: "new",
    notes: value(formData, "notes") || null
  });

  if (bookingError) {
    console.error("[demo-booking:create] insert failed", bookingError.message);
  }

  await supabase.from("website_conversion_events" as any).insert({
    lead_id: lead?.id,
    event_type: "demo_booked",
    page_path: "/book-demo",
    audience: "kindergartens",
    campaign: "kindergarten_demo_funnel",
    metadata: { garden_name: gardenName, city, children_count: childrenCount }
  });

  revalidatePath("/");
  revalidatePath("/dashboard/admin/leads");
  redirect("/book-demo?lead=sent");
}

export async function createParentDemandLead(formData: FormData) {
  const supabase = await createClient();
  const parentName = value(formData, "parent_name");
  const parentPhone = value(formData, "parent_phone");
  const parentEmail = value(formData, "parent_email");
  const gardenName = value(formData, "garden_name");
  const gardenAddress = value(formData, "garden_address");
  const managerName = value(formData, "manager_name");
  const managerPhone = value(formData, "manager_phone");
  const childAgeGroups = values(formData, "child_age_groups");
  const qualification = {
    parent_origin: true,
    parent_name: parentName,
    parent_phone: parentPhone,
    parent_email: parentEmail || null,
    kindergarten_address: gardenAddress || null,
    child_age_groups: childAgeGroups,
    child_age_unknown: childAgeGroups.includes("unknown"),
    manager_name: managerName || null,
    manager_phone: managerPhone || null,
    contact_next_step: "contact_parent_then_kindergarten"
  };
  const notes = [
    "פניית הורה: מבקש/ת שהגן יצטרף לגן בטוח.",
    childAgeGroups.length ? `קבוצות גיל: ${childAgeGroups.join(", ")}` : "",
    gardenAddress ? `כתובת גן: ${gardenAddress}` : "",
    managerName ? `שם מנהלת ידוע: ${managerName}` : "",
    managerPhone ? `טלפון מנהלת ידוע: ${managerPhone}` : "",
    value(formData, "notes") ? `הערה: ${value(formData, "notes")}` : ""
  ].filter(Boolean).join("\n");

  const leadPayload = {
    lead_type: "garden",
    parent_name: parentName,
    garden_name: gardenName,
    manager_name: managerName || null,
    address: gardenAddress || null,
    phone: parentPhone,
    email: parentEmail || null,
    notes,
    status: "new",
    source: "parent_request",
    campaign: "parent_demand",
    funnel_stage: "parent_request",
    conversion_goal: "parent_request_to_kindergarten_registration",
    qualification,
    lead_score: Math.min(100, 35 + (gardenName ? 20 : 0) + (managerPhone ? 20 : 0) + (parentEmail ? 10 : 0))
  };

  const { error, data: lead } = await supabase
    .from("leads" as any)
    .insert(leadPayload)
    .select("id")
    .single();

  if (error) redirect(`/parents-demand?error=${encodeURIComponent("לא ניתן לשלוח את הבקשה כרגע. נסו שוב בעוד רגע.")}`);
  await mirrorGrowthLead(supabase, { id: lead?.id, ...leadPayload });

  await supabase.from("website_conversion_events" as any).insert({
    lead_id: lead?.id,
    event_type: "parent_request",
    page_path: "/parents-demand",
    audience: "parents",
    campaign: "parent_demand",
    metadata: { garden_name: gardenName, parent_origin: true }
  });

  revalidatePath("/");
  revalidatePath("/dashboard/admin/leads");
  redirect("/parents-demand?lead=sent");
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
