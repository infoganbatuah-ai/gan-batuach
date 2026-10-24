import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { ObserverQaDeviceEnrollment } from "@/components/digital-observer/observer-qa-device-enrollment";

export default async function ObserverQaDeviceEnrollmentPage() {
  const headerList = await headers();
  const host = headerList.get("host");
  const backend = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.VERCEL || process.env.PUSH44_QA_CONTROL_ONLY !== "1" ||
    host !== "qa-iphone-device-proof.ganbatuach.com" ||
    !backend?.startsWith("http://127.0.0.1:")) redirect("/digital-observer/login");
  const session = await getDigitalObserverApiUser();
  if (!session || session.profile.id !== "00000000-0000-4000-8000-000000000f44") {
    redirect("/digital-observer/login?next=/digital-observer/qa-device-enrollment");
  }
  return <ObserverQaDeviceEnrollment />;
}
