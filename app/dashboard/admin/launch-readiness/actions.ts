"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const launchPaths = ["/dashboard/admin/launch-readiness", "/dashboard/admin/pilot-center"];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value || null;
}

function numberInRange(formData: FormData, key: string, min: number, max: number) {
  const parsed = Number(text(formData, key));
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function requireAllowed(value: string, allowed: string[], field: string) {
  if (!allowed.includes(value)) throw new Error(`Invalid ${field}`);
  return value;
}

function revalidateLaunchPaths() {
  launchPaths.forEach((path) => revalidatePath(path));
}

export async function updateLaunchReadinessScore(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const status = requireAllowed(text(formData, "status"), ["ready", "partial", "not_ready", "blocked"], "readiness status");
  const supabase = await createClient();
  const { error } = await supabase.from("launch_readiness_scores" as any).update({
    score: numberInRange(formData, "score", 0, 100),
    status,
    evidence_summary: optionalText(formData, "evidence_summary"),
    recommended_action: optionalText(formData, "recommended_action"),
    updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLaunchPaths();
}

export async function updateProductionConfiguration(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const readinessStatus = requireAllowed(text(formData, "readiness_status"), ["ready", "partial", "not_ready", "blocked", "not_required"], "configuration status");
  const supabase = await createClient();
  const { error } = await supabase.from("production_configuration_readiness" as any).update({
    readiness_status: readinessStatus,
    evidence_summary: optionalText(formData, "evidence_summary"),
    recommended_action: optionalText(formData, "recommended_action"),
    updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLaunchPaths();
}

export async function updateLaunchChecklistItem(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const status = requireAllowed(text(formData, "status"), ["pending", "in_progress", "completed", "verified", "blocked", "not_required"], "checklist status");
  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("launch_checklist" as any).update({
    status,
    evidence_url: optionalText(formData, "evidence_url"),
    notes: optionalText(formData, "notes"),
    completed_at: ["completed", "verified"].includes(status) ? now : null,
    verified_at: status === "verified" ? now : null,
    updated_at: now
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLaunchPaths();
}

export async function updateLaunchIssue(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const status = requireAllowed(text(formData, "status"), ["open", "investigating", "fixed", "verified", "accepted_risk"], "issue status");
  const severity = requireAllowed(text(formData, "severity"), ["critical", "high", "medium", "low"], "issue severity");
  const supabase = await createClient();
  const { error } = await supabase.from("launch_issues" as any).update({
    severity,
    status,
    impact: optionalText(formData, "impact"),
    resolution: optionalText(formData, "resolution"),
    verified_at: status === "verified" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLaunchPaths();
}

export async function updateLaunchBlocker(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const status = requireAllowed(text(formData, "status"), ["open", "investigating", "fixed", "verified", "accepted_risk"], "blocker status");
  const severity = requireAllowed(text(formData, "severity"), ["critical", "high", "medium", "low"], "blocker severity");
  const supabase = await createClient();
  const { error } = await supabase.from("launch_blockers" as any).update({
    severity,
    status,
    resolution: optionalText(formData, "resolution"),
    due_date: optionalText(formData, "due_date"),
    resolved_at: ["verified", "accepted_risk"].includes(status) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLaunchPaths();
}

export async function updatePerformanceReadinessCheck(formData: FormData) {
  await requireRole(["admin"]);
  const id = text(formData, "id");
  const status = requireAllowed(text(formData, "status"), ["healthy", "degraded", "offline", "unknown", "not_configured"], "performance status");
  const latestValue = optionalText(formData, "latest_value");
  const supabase = await createClient();
  const { error } = await supabase.from("performance_readiness_checks" as any).update({
    status,
    latest_value: latestValue === null ? null : Number(latestValue),
    checked_at: new Date().toISOString(),
    recommended_action: optionalText(formData, "recommended_action"),
    updated_at: new Date().toISOString()
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateLaunchPaths();
}
