import { stagedQaWindow } from "@/lib/domain/digital-observer/qa-installation/window";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { qaProject } from "@/lib/domain/digital-observer/qa-installation/pending";
import { preparePendingOnProductServer } from "@/lib/domain/digital-observer/qa-installation/server";
import { handle, type Services } from "@/lib/domain/digital-observer/qa-installation/control";

export const runtime = "nodejs";
const services: Services = {
  async session() {
    // This only retrieves the candidate bearer; the Product verifier authenticates
    // the exact bytes and checks auth.sessions before any persistence.
    const result = await (await createClient()).auth.getSession();
    return result.error ? null : result.data.session?.access_token ?? null;
  },
  pending: preparePendingOnProductServer,
  async store(token, window, row, action, nonce) {
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!key || process.env.NEXT_PUBLIC_SUPABASE_URL !== qaProject) return null;
    const response = await fetch(qaProject+"/rest/v1/rpc/qa_observer_pending_proof",{
      method:"POST",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000),
      headers:{authorization:"Bearer "+token,apikey:key,"content-type":"application/json"},
      body:JSON.stringify({operation:action,ticket:window.receiptSecret,request_key:row.requestId,
        target_site:row.siteId,target_source:row.sourceId,key_digest:row.spkiSha256,nonce_hex:nonce})
    });
    if (!response.ok) return null;
    const result: unknown = await response.json();
    return typeof result === "string" && /^[0-9a-f]{64}$/.test(result) ? result : null;
  }
};
export async function POST(request: Request) {
  return handle(request, await stagedQaWindow(), services);
}
