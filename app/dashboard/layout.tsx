import { privateRouteMetadata } from "@/lib/seo/private-metadata";
import { DashboardSkipLink } from "@/components/dashboard-skip-link";
import "../styles/dashboard-skip-link.css";

export const metadata = privateRouteMetadata;

export default function DashboardPrivateLayout({ children }: { children: React.ReactNode }) {
  return <><DashboardSkipLink />{children}</>;
}
