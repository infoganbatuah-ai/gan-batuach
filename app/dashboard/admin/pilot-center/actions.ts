"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function requireAllowed(value: string, allowed: string[], field: string) {
  if (!allowed.includes(value)) throw new Error(`Invalid ${field}`);
  return value;
}

function revalidatePilotPaths() {
  revalidatePath("/dashboard/admin/pilot-center");
  revalidatePath("/dashboard/admin/launch-readiness");
}

export async function updatePilotProgram(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const pilotStatus = requireAllowed(text(formData, "pilot_status"), ["planned", "inviting", "active", "paused", "completed", "cancelled"], "pilot status");
  const onboardingStatus = requireAllowed(text(formData, "onboarding_status"), ["not_started", "invited", "in_progress", "completed", "blocked"], "onboarding status");
  const observerStatus = requireAllowed(text(formData, "observer_status"), ["not_started", "configured", "shadow_active", "review_active", "blocked"], "observer status");
  const satisfactionScore = optionalText(formData, "satisfaction_score");
  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("pilot_programs" as any).update({
    pilot_status: pilotStatus,
    onboarding_status: onboardingStatus,
    observer_status: observerStatus,
    satisfaction_score: satisfactionScore === null ? null : Number(satisfactionScore),
    notes: optionalText(formData, "notes"),
    completed_at: pilotStatus === "completed" ? now : null,
    updated_at: now
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePilotPaths();
}

export async function updatePilotParticipant(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const participantStatus = requireAllowed(text(formData, "participant_status"), ["invited", "active", "completed", "suspended"], "participant status");
  const now = new Date().toISOString();
  const updates: Record<string, string | null> = {
    participant_status: participantStatus,
    updated_at: now
  };
  if (participantStatus === "active") updates.activated_at = now;
  if (participantStatus === "completed") updates.completed_at = now;
  if (participantStatus === "suspended") updates.suspended_at = now;

  const supabase = await createClient();
  const { error } = await supabase.from("pilot_participants" as any).update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePilotPaths();
}
