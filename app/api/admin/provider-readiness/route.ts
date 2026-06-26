import { ok, handleRouteError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getProviderActivationInventory } from "@/lib/domain/provider-configuration-validator";
import { notificationTemplateRegistry } from "@/lib/domain/notification-template-registry";

export async function GET() {
  try {
    await requireRole(["admin"]);
    const providers = getProviderActivationInventory();
    return ok({
      providers,
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
    return handleRouteError(error);
  }
}
