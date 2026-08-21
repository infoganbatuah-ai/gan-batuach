import { cookies } from "next/headers";
import { AuthCallbackClient } from "@/components/auth/auth-callback-client";

export const dynamic = "force-dynamic";

export default async function AuthCallbackPage() {
  const cookieStore = await cookies();
  const productHint = cookieStore.get("auth_callback_product")?.value === "digital_observer"
    ? "digital_observer"
    : cookieStore.get("auth_callback_product")?.value === "gan_batuach"
      ? "gan_batuach"
      : undefined;
  const flowHint = cookieStore.get("auth_callback_flow")?.value === "recovery" ? "recovery" : undefined;
  return <AuthCallbackClient productHint={productHint} flowHint={flowHint} />;
}
