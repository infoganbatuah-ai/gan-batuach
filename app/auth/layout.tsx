import { privateRouteMetadata } from "@/lib/seo/private-metadata";

export const metadata = privateRouteMetadata;

export default function AuthPrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
