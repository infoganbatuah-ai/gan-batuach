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

// No trusted staging reader has been qualified for the Preview. This dependency
// is server-owned, takes no HTTP input, and must retrieve only the single
// authorized window on each call. Never cache the ticket across requests.
type ReadPrivateWindow = () => Promise<unknown>;

export async function stagedQaWindow(read: ReadPrivateWindow | null = null): Promise<Window | null> {
  if (read === null || process.env.OBSERVER_QA_INSTALLATION_PROOF !== "1" ||
      process.env.VERCEL_ENV !== "preview" || process.env.NEXT_PUBLIC_SUPABASE_URL !== qaProject) return null;
  try {
    const parsed = windowSchema.safeParse(await read());
    if (!parsed.success) return null;
    const {issuedAt,expiresAt} = parsed.data.operator;
    const now = Date.now();
    return issuedAt <= now && now < expiresAt && expiresAt-issuedAt <= 300000 ? parsed.data : null;
  } catch { return null; }
}
