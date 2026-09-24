import { permanentRedirect } from "next/navigation";

/**
 * Compatibility route retained for bookmarks created before the canonical
 * inspection workspace was consolidated. Authorization is performed again by
 * the destination; no Garden or resource identifier is forwarded.
 */
export default function LegacyGardenInspectionStatusPage() {
  permanentRedirect("/dashboard/garden/inspections");
}
