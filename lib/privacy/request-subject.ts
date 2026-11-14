import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";

type SubjectMode = "self" | "child" | "garden";

type Profile = { id: string; role: string | null; garden_id?: string | null };

export class PrivacySubjectDenied extends Error {
  constructor() {
    super("Privacy request subject is unavailable or unauthorized");
  }
}

export async function resolvePrivacyRequestSubject(
  supabase: SupabaseClient,
  profile: Profile,
  mode: SubjectMode,
  childId?: string | null
) {
  if (mode === "self") {
    if (childId) throw new PrivacySubjectDenied();
    return {
      subjectType: profile.role ?? "parent",
      subjectUserId: profile.id,
      dataSubjectId: profile.id,
      childId: null,
      gardenId: null
    };
  }

  if (mode === "garden") {
    if (childId || !["manager", "owner", "network_manager"].includes(profile.role ?? "")) throw new PrivacySubjectDenied();
    const context = await resolveManagementGardenContext(profile);
    const gardenId = context.available ? context.activeGarden?.id : null;
    if (!gardenId) throw new PrivacySubjectDenied();
    return {
      subjectType: "garden",
      subjectUserId: null,
      dataSubjectId: gardenId,
      childId: null,
      gardenId
    };
  }

  if (profile.role !== "parent" || !childId) throw new PrivacySubjectDenied();
  const result = await supabase.rpc("management_privacy_child_garden", { target_child_id: childId });
  if (result.error || !result.data) throw new PrivacySubjectDenied();
  return {
    subjectType: "child",
    subjectUserId: null,
    dataSubjectId: childId,
    childId,
    gardenId: String(result.data)
  };
}
