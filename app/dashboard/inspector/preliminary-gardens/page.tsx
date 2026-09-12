import { requireApprovedInspector } from "@/lib/management/operational-role";
import { InspectorPreliminaryGardens } from "@/components/inspector-preliminary-gardens";

export default async function PreliminaryGardensPage() {
  await requireApprovedInspector();
  return <InspectorPreliminaryGardens />;
}
