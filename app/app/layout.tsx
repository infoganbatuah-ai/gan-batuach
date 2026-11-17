import { privateRouteMetadata } from "@/lib/seo/private-metadata";

export const metadata = privateRouteMetadata;

export default function ApplicationPrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
