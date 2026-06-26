import { handleProviderWebhook } from "@/lib/domain/provider-webhooks";

export async function POST(request: Request) {
  return handleProviderWebhook(request, "payment");
}
