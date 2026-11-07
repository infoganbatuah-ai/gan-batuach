import { privateRouteMetadata } from "@/lib/seo/private-metadata";

export const metadata = privateRouteMetadata;

export default function ResetPasswordPrivateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
