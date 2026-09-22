import { permanentRedirect } from "next/navigation";

/**
 * The parent Trust Center is the canonical parent-safe inspection and
 * transparency surface. Keep this old URL as a navigation-only compatibility
 * route and let the destination repeat parent/Child/Garden authorization.
 */
export default function LegacyParentTrustPage() {
  permanentRedirect("/dashboard/parent/trust-center");
}
