import { GardenContextSwitcher } from "@/components/garden-context-switcher";
import { getSessionProfile } from "@/lib/auth";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";

export async function ManagementGardenContextSlot() {
  const session = await getSessionProfile();
  if (!session.profile || !["manager", "owner"].includes(String(session.profile.role))) return null;
  const context = await resolveManagementGardenContext(session.profile);
  if (!context.available || !context.activeGarden) return null;

  return (
    <GardenContextSwitcher
      gardens={context.gardens}
      initialActiveId={context.activeGarden.id}
      compact
    />
  );
}
