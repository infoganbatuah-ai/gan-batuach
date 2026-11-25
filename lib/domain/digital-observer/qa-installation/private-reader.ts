import "server-only";
import { qaProject } from "./pending";

// A dedicated call site prevents forwarding client headers or choosing a
// destination from the request. Service credentials never enter the Product RPC.
export async function readPrivateWindow(): Promise<unknown> {
  if (process.env.OBSERVER_QA_INSTALLATION_PROOF !== "1" || process.env.VERCEL_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== qaProject) return null;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  const headers: Record<string,string> = {apikey:key,"content-type":"application/json"};
  if (!key.startsWith("sb_secret_")) {
    // Legacy hosted keys identify their project. Reject a mismatched key before transmission.
    // The API gateway still authenticates the credential.
    try {
      const parts = key.split(".");
      if (parts.length !== 3) return null;
      const claims = JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
      if (claims.role !== "service_role" || claims.ref !== "qrkodgtccyzmshitowdt" ||
          !Number.isSafeInteger(claims.exp) || claims.exp <= Date.now()/1000) return null;
      headers.authorization = "Bearer "+key;
    } catch { return null; }
  }
  try {
    const response = await fetch(qaProject+"/rest/v1/rpc/qa_observer_read_window",{
      method:"POST",body:"{}",headers,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(3000)
    });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}
