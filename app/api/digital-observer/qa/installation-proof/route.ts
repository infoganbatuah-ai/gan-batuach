import { readPrivateWindow } from "@/lib/domain/digital-observer/qa-installation/private-reader";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { stagedQaWindow } from "@/lib/domain/digital-observer/qa-installation/window";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { qaProject } from "@/lib/domain/digital-observer/qa-installation/pending";
import { preparePendingOnProductServer } from "@/lib/domain/digital-observer/qa-installation/server";
import { handle, rejectsControlOrigin, type Services } from "@/lib/domain/digital-observer/qa-installation/control";

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
  const closed = () => handle(request,null,services);
  if (process.env.OBSERVER_QA_INSTALLATION_PROOF !== "1" || process.env.VERCEL_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== qaProject || rejectsControlOrigin(request)) return closed();
  try {
    const token = await services.session();
    if (!token) return closed();
    const auth = await getDigitalObserverApiUser(new Request(request.url,{headers:{authorization:"Bearer "+token}}));
    if (!auth || auth.user.email_confirmed_at == null || auth.profile.active !== true) return closed();
    const window = await stagedQaWindow(readPrivateWindow);
    if (!window || window.operator.ownerSubject !== auth.user.id) return closed();
    return handle(request,window,{...services,session:async()=>token});
  } catch { return closed(); }
}
