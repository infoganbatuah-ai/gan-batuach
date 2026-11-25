import "server-only";
import { z } from "zod";
import { qaProject } from "./pending";
import type { Window } from "./control";

const digest = z.string().regex(/^[0-9a-f]{64}$/);
const windowSchema = z.object({
  receiptSecret: digest,
  operator: z.object({
    requestId: z.string().uuid(), ownerSubject: z.string().uuid(), publicKeyDigest: digest,
    siteId: z.string().uuid(), sourceId: z.string().uuid(),
    issuedAt: z.number().int().safe(), expiresAt: z.number().int().safe()
  }).strict()
}).strict();

// Private process configuration only. No request, cookie or user metadata can
// supply the operator record. Invalid configuration never starts a session read.
export function stagedQaWindow(): Window | null {
  if (process.env.OBSERVER_QA_INSTALLATION_PROOF !== "1" || process.env.VERCEL_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== qaProject) return null;
  const raw = process.env.OBSERVER_QA_INSTALLATION_WINDOW;
  if (!raw || raw.length > 1024) return null;
  try {
    const parsed = windowSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const {issuedAt,expiresAt} = parsed.data.operator;
    const now = Date.now();
    return issuedAt <= now && now < expiresAt && expiresAt-issuedAt <= 300000 ? parsed.data : null;
  } catch { return null; }
}
