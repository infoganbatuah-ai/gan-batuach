import { privateRouteMetadata } from "@/lib/seo/private-metadata";

export const metadata = privateRouteMetadata;

export default function ParentOnboardingPrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
