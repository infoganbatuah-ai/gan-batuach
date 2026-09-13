import { ok, fail, handleSafeRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { getProviderActivationInventory } from "@/lib/domain/provider-configuration-validator";
import { getFinancialProviderCapabilities } from "@/lib/domain/financial-provider-capability";
import { notificationTemplateRegistry } from "@/lib/domain/notification-template-registry";

export async function GET() {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user) return fail("Authentication required.", 401);
    if (!profile || profile.role !== "admin" || profile.active !== true) return fail("Admin access required.", 403);
    const providers = getProviderActivationInventory();
    return ok({
      providers,
      financialCapabilities: getFinancialProviderCapabilities(),
      templates: notificationTemplateRegistry.map((template) => ({
        key: template.key,
        role: template.role,
        channels: template.channels,
        title: template.title,
        variables: template.variables,
        providerRequirements: template.providerRequirements,
        enabled: template.enabled,
        testModeSupport: template.testModeSupport
      }))
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
