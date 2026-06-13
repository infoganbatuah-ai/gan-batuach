import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { buildIsoReadinessSummary } from "@/lib/domain/iso-readiness";

export async function GET() {
  try {
    await requireRole(["admin"]);
    const supabase = await createClient();
    const [controls, assets, risks, audits, permitAlerts] = await Promise.all([
      supabase.from("iso_controls" as any).select("*").order("standard").order("control_id"),
      supabase.from("asset_inventory" as any).select("*").order("asset_type"),
      supabase.from("risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }),
      supabase.from("internal_audits" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("permit_expiry_alerts" as any).select("*").neq("status", "resolved").order("expires_at")
    ]);
    const errors = [controls.error, assets.error, risks.error, audits.error, permitAlerts.error].filter(Boolean);
    if (errors.length) return fail(errors.map((error) => error?.message).join("; "), 400);
    const summary = buildIsoReadinessSummary({
      controls: controls.data ?? [],
      assets: assets.data ?? [],
      risks: risks.data ?? [],
      audits: audits.data ?? [],
      permitAlerts: permitAlerts.data ?? []
    });
    return ok({
      summary,
      controls: controls.data ?? [],
      assets: assets.data ?? [],
      risks: risks.data ?? [],
      audits: audits.data ?? [],
      permitAlerts: permitAlerts.data ?? []
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
