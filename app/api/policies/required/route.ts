import { handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function policyTypeForRole(role: string) {
  if (role === "manager" || role === "owner") return "kindergarten";
  if (role === "parent") return "parent";
  if (role === "inspector") return "inspector";
  if (role === "staff") return "staff";
  return null;
}

export async function GET() {
  try {
    const { profile } = await requireUser();
    const policyType = policyTypeForRole(profile.role);
    if (!policyType || profile.role === "admin") return ok({ required: false });
    const supabase = await createClient();
    const { data: policy, error } = await supabase.from("policies" as any).select("*").eq("policy_type", policyType).eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error || !policy) return ok({ required: false });
    const { data: acceptance } = await supabase.from("policy_acceptances" as any).select("id").eq("policy_id", policy.id).eq("user_id", profile.id).maybeSingle();
    return ok({ required: !acceptance, policy });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST() {
  try {
    const { profile } = await requireUser();
    const policyType = policyTypeForRole(profile.role);
    if (!policyType || profile.role === "admin") return ok({ accepted: true });
    const supabase = await createClient();
    const { data: policy, error } = await supabase.from("policies" as any).select("*").eq("policy_type", policyType).eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
    if (error || !policy) return ok({ accepted: true });
    const { data, error: insertError } = await supabase.from("policy_acceptances" as any).upsert({
      policy_id: policy.id,
      user_id: profile.id,
      policy_type: policy.policy_type,
      version: policy.version
    }, { onConflict: "policy_id,user_id" }).select("*").single();
    if (insertError) throw new Error(insertError.message);
    return ok({ accepted: true, acceptance: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
