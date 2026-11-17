import { privateRouteMetadata } from "@/lib/seo/private-metadata";

export const metadata = privateRouteMetadata;

export default function InvitePrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
