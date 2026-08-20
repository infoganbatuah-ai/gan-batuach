import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  package_id: z.string().uuid(),
  billing_cycle: z.enum(["monthly", "annual"]).default("monthly")
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { billing: true });
    if (!site) return fail("אין הרשאת חיוב לאתר הזה.", 403);
    const { data: requestedPackage } = await supabase.from("observer_monitoring_packages" as any)
      .select("id,name,package_key,monthly_price,annual_price,active")
      .eq("id", payload.package_id)
      .eq("active", true)
      .maybeSingle();
    if (!requestedPackage) return fail("החבילה אינה זמינה.", 404);
    const { data: subscription } = await supabase.from("observer_site_subscriptions" as any)
      .select("id,package_id,status,subscription_status")
      .eq("observer_site_id", payload.observer_site_id)
      .maybeSingle();
    const changeType = subscription?.package_id ? "upgrade" : "upgrade";
    const { data, error } = await supabase.from("observer_subscription_change_requests" as any).insert({
      observer_site_id: payload.observer_site_id,
      subscription_id: subscription?.id ?? null,
      current_package_id: subscription?.package_id ?? null,
      requested_package_id: requestedPackage.id,
      change_type: changeType,
      status: "requested",
      prorated_billing_ready: false,
      reason: `בקשת ${payload.billing_cycle === "annual" ? "חיוב שנתי" : "חיוב חודשי"} בסביבת הכנה`,
      metadata: {
        requested_by: profile.id,
        billing_cycle: payload.billing_cycle,
        provider_mode: "mock",
        no_charge_performed: true,
        server_is_source_of_truth: true
      }
    }).select("id,status,requested_package_id,created_at").single();
    if (error) return fail("לא ניתן לשמור את בקשת שינוי החבילה.", 400);
    return ok({ request: data, package: requestedPackage, charged: false, message: "הבקשה נשמרה בלבד. לא בוצע חיוב אמיתי." }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
