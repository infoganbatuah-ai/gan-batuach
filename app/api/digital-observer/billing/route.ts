import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  package_id: z.string().uuid(),
  billing_cycle: z.enum(["monthly", "annual"]).default("monthly")
});

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { billing: true });
    if (!site) return fail("אין הרשאת חיוב לאתר הזה.", 403);
    const { data: requestedPackage } = await supabase.from("observer_monitoring_packages" as any)
      .select("id,name,package_key,package_type,monthly_price,annual_price,active")
      .eq("id", payload.package_id)
      .eq("active", true)
      .maybeSingle();
    if (!requestedPackage) return fail("החבילה אינה זמינה.", 404);
    const allowedPackageType = site.site_type === "home" ? "home" : "business";
    const allowedPackage = requestedPackage.package_type === allowedPackageType
      || (allowedPackageType === "business" && requestedPackage.package_type === "enterprise");
    if (!allowedPackage) {
      return fail("החבילה אינה מתאימה לסוג האתר הזה.", 422);
    }
    const { data: subscription } = await supabase.from("observer_site_subscriptions" as any)
      .select("id,package_id,status,subscription_status")
      .eq("observer_site_id", payload.observer_site_id)
      .maybeSingle();
    if (subscription?.package_id === requestedPackage.id) return fail("זו כבר החבילה הנוכחית של האתר.", 409);
    if (!isAdminClientConfigured()) return fail("שירות בקשות המנוי אינו זמין כרגע.", 503);

    const admin = createAdminClient();
    const { data: currentPackage } = subscription?.package_id
      ? await admin.from("observer_monitoring_packages" as any).select("id,monthly_price,annual_price").eq("id", subscription.package_id).maybeSingle()
      : { data: null };
    const requestedPrice = payload.billing_cycle === "annual" ? Number(requestedPackage.annual_price || 0) : Number(requestedPackage.monthly_price || 0);
    const currentPrice = currentPackage
      ? payload.billing_cycle === "annual" ? Number(currentPackage.annual_price || 0) : Number(currentPackage.monthly_price || 0)
      : 0;
    const changeType = subscription?.package_id && requestedPrice < currentPrice ? "downgrade" : "upgrade";

    const existingRequest = await admin.from("observer_subscription_change_requests" as any)
      .select("id,status,requested_package_id,created_at")
      .eq("observer_site_id", payload.observer_site_id)
      .eq("requested_package_id", requestedPackage.id)
      .in("status", ["requested", "approved", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRequest.data) {
      return ok({ request: existingRequest.data, package: requestedPackage, charged: false, duplicate: true, message: "הבקשה כבר ממתינה לטיפול. לא בוצע חיוב אמיתי." });
    }

    const { data, error } = await admin.from("observer_subscription_change_requests" as any).insert({
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
    if (error) {
      console.error("Digital Observer subscription request failed", { code: error.code ?? "unknown" });
      return fail("לא ניתן לשמור את בקשת שינוי החבילה.", 400);
    }
    return ok({ request: data, package: requestedPackage, charged: false, message: "הבקשה נשמרה בלבד. לא בוצע חיוב אמיתי." }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
