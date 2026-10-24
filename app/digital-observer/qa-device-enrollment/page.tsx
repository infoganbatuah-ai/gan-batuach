import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { qaDevicePageProxyBoundary } from "@/lib/domain/digital-observer/qa-device-control-boundary";
import { ObserverQaDeviceEnrollment } from "@/components/digital-observer/observer-qa-device-enrollment";

export default async function ObserverQaDeviceEnrollmentPage() {
  const headerList = await headers();
  if (!qaDevicePageProxyBoundary(headerList, {
    VERCEL: process.env.VERCEL,
    PUSH44_QA_CONTROL_ONLY: process.env.PUSH44_QA_CONTROL_ONLY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    PUSH44_QA_PROXY_KEY: process.env.PUSH44_QA_PROXY_KEY
  })) redirect("/digital-observer/login");
  const session = await getDigitalObserverApiUser();
  if (!session || session.profile.id !== "00000000-0000-4000-8000-000000000f44") {
    redirect("/digital-observer/login?next=/digital-observer/qa-device-enrollment");
  }
  return <ObserverQaDeviceEnrollment />;
}
