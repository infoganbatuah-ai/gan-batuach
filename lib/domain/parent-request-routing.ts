import type { SupabaseClient } from "@supabase/supabase-js";

export type RequestRecipient = {
  id: string;
  profile_id?: string | null;
  role: string;
  group: string;
  label: string;
  description?: string | null;
};

export const requestTypeOptions = [
  "שאלה כללית",
  "בריאות / אלרגיה",
  "איסוף / שחרור",
  "תשלום",
  "יומן יומי",
  "תלונה",
  "מצלמות",
  "מסמכים",
  "אחר"
];

export function defaultRecipientGroupForRequestType(type: string) {
  if (type.includes("בריאות")) return "manager";
  if (type.includes("איסוף")) return "staff";
  if (type.includes("תשלום")) return "owner";
  if (type.includes("יומן")) return "staff";
  if (type.includes("תלונה")) return "manager_admin";
  if (type.includes("מצלמות")) return "manager_admin";
  if (type.includes("מסמכים")) return "manager";
  return "manager";
}

export async function getParentRequestRecipients(supabase: SupabaseClient<any, any, any>, gardenId: string): Promise<RequestRecipient[]> {
  const [gardenRes, staffRes, adminsRes] = await Promise.all([
    supabase.from("gardens" as any).select("manager:manager_id(id, full_name, role), owner:owner_profile_id(id, full_name, role), inspector:inspector_id(id, full_name, role)").eq("id", gardenId).maybeSingle(),
    supabase.from("staff" as any).select("profile_id, full_name, role_title, profiles:profile_id(id, full_name, role)").eq("garden_id", gardenId).limit(80),
    supabase.from("profiles" as any).select("id, full_name, role").eq("role", "admin").limit(5)
  ]);
  if (gardenRes.error) console.error("Parent request recipients garden query failed", gardenRes.error);
  if (staffRes.error) console.error("Parent request recipients staff query failed", staffRes.error);
  if (adminsRes.error) console.error("Parent request recipients admin query failed", adminsRes.error);

  const garden = gardenRes.data as any;
  const recipients: RequestRecipient[] = [];
  if (garden?.manager?.id) recipients.push({ id: `profile:${garden.manager.id}`, profile_id: garden.manager.id, role: "manager", group: "manager", label: `${garden.manager.full_name ?? "מנהלת הגן"} - מנהלת הגן` });
  if (garden?.owner?.id) recipients.push({ id: `profile:${garden.owner.id}`, profile_id: garden.owner.id, role: "owner", group: "owner", label: `${garden.owner.full_name ?? "בעלים"} - בעלים` });
  for (const row of (staffRes.data ?? []) as any[]) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const profileId = row.profile_id ?? profile?.id;
    if (profileId) recipients.push({ id: `profile:${profileId}`, profile_id: profileId, role: "staff", group: "staff", label: `${profile?.full_name ?? row.full_name ?? "איש צוות"} - ${row.role_title ?? "צוות הגן"}` });
  }
  if (garden?.inspector?.id) recipients.push({ id: `profile:${garden.inspector.id}`, profile_id: garden.inspector.id, role: "inspector", group: "inspector", label: `${garden.inspector.full_name ?? "מפקחת"} - מפקחת` });
  for (const admin of (adminsRes.data ?? []) as any[]) {
    recipients.push({ id: `profile:${admin.id}`, profile_id: admin.id, role: "admin", group: "admin", label: `${admin.full_name ?? "תמיכת גן בטוח"} - תמיכת גן בטוח` });
  }
  recipients.push({ id: "group:manager", role: "manager", group: "manager", label: "גננת / מנהלת הגן" });
  recipients.push({ id: "group:owner", role: "owner", group: "owner", label: "בעלים" });
  recipients.push({ id: "group:staff", role: "staff", group: "staff", label: "צוות הגן" });
  recipients.push({ id: "group:inspector", role: "inspector", group: "inspector", label: "מפקח משויך" });
  recipients.push({ id: "group:admin", role: "admin", group: "admin", label: "אדמין מערכת / תמיכה" });
  return recipients.filter((recipient, index, all) => all.findIndex((item) => item.id === recipient.id) === index);
}
