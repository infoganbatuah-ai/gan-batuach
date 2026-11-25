import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import type { OperatorRequest, pendingProductKey } from "./pending";

export const origin = "https://observer-qa.ganbatuach.com";
export const path = "/api/digital-observer/qa/installation-proof";
const domain = "digital-observer.hosted-qa.pending-proof.v1";
export type Pending = NonNullable<Awaited<ReturnType<typeof pendingProductKey>>>;
type Action = "begin" | "read" | "consume";
export type Window = {
  operator: OperatorRequest;
  receiptSecret: string;
};
export type Services = {
  session(): Promise<string | null>;
  pending(request: Request, body: {spki: string}, op: OperatorRequest): Promise<Pending | null>;
  store(token: string, window: Window, pending: Pending, action: Action, nonce: string): Promise<string | null>;
};
export function signedMessage(nonce: string) {
  if (!/^[0-9a-f]{64}$/.test(nonce)) throw Error("invalid nonce");
  return Buffer.from(domain + "\n" + nonce, "ascii");
}
function reply(status: number, body: object = {}) {
  return Response.json(body, {status, headers: {"cache-control": "private, no-store", "referrer-policy": "no-referrer"}});
}
async function readBody(request: Request) {
  if (request.headers.get("content-type") !== "application/json" || request.headers.has("content-encoding") ||
      Number(request.headers.get("content-length")) > 1024 || !request.body) return null;
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024) { await reader.cancel(); return null; }
      parts.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(parts)));
  } finally { reader.releaseLock(); }
}
export function rejectsControlOrigin(request: Request) {
  return request.url !== origin+path || request.method !== "POST" ||
        request.headers.get("host") !== "observer-qa.ganbatuach.com" ||
        request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") !== "same-origin" ||
        request.headers.has("authorization");
}
export async function handle(request: Request, window: Window | null, services: Services) {
  if (!window) return reply(404);
  try {
    if (rejectsControlOrigin(request) || !/^[0-9a-f]{64}$/.test(window.receiptSecret) ||
        Date.now() < window.operator.issuedAt || Date.now() >= window.operator.expiresAt) return reply(403);
    const b = await readBody(request);
    const begin = b?.op === "begin";
    if ((!begin && b?.op !== "prove") || Object.keys(b).sort().join() !== (begin?"op,spki":"op,signature,spki") ||
        typeof b.spki !== "string" || b.spki.length !== 124) return reply(400);
    const token = await services.session();
    if (!token) return reply(403);
    const verified = await services.pending(new Request(request.url,{method:"POST",headers:{authorization:"Bearer "+token}}),
      {spki:b.spki},window.operator);
    if (!verified || verified.grantsAccess !== false || verified.status !== "PENDING" || verified.expiresAt <= Date.now()) return reply(403);
    const nonce = await services.store(token,window,verified,begin?"begin":"read",begin?randomBytes(32).toString("hex"):"");
    if (verified.expiresAt <= Date.now() || !nonce || !/^[0-9a-f]{64}$/.test(nonce)) return reply(403);
    if (begin) return reply(200,{status:"PENDING",nonce});
    if (typeof b.signature !== "string" || b.signature.length > 100) return reply(403);
    const sig=Buffer.from(b.signature,"base64"), der=Buffer.from(b.spki,"base64");
    if (sig.toString("base64") !== b.signature || createHash("sha256").update(der).digest("hex") !== verified.spkiSha256 ||
        !verify("sha256",signedMessage(nonce),createPublicKey({key:der,format:"der",type:"spki"}),sig)) return reply(403);
    return await services.store(token,window,verified,"consume",nonce) === nonce
      ? reply(200,{status:"PENDING",signatureAccepted:true}) : reply(403);
  } catch { return reply(403); }
}
