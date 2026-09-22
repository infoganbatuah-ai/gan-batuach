import { permanentRedirect } from "next/navigation";

/**
 * Face-match review is not release authority. Retain the historical URL only
 * as a safe route into the canonical pickup workspace, where current pickup
 * authorization and Staff confirmation are enforced.
 */
export default function LegacyPickupFacePage() {
  permanentRedirect("/dashboard/garden/pickup");
}
