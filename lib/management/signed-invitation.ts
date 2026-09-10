import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InvitationType = "parent_guardian" | "staff" | "inspector" | "garden_management";
export type InvitationRole = "parent" | "staff" | "inspector" | "kindergarten_manager" | "kindergarten_owner";

type AdminClient = SupabaseClient;

function secret() {
  const value = process.env.MANAGEMENT_INVITATION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("MANAGEMENT_INVITATION_SECRET must contain at least 32 characters.");
  return value;
}

export function normalizeInvitationEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

export function normalizeInvitationPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  if (!digits) return null;
  if (digits.startsWith("9720")) return `+972${digits.slice(4)}`;
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function recipientFingerprint(email?: string | null, phone?: string | null) {
  const normalizedEmail = normalizeInvitationEmail(email);
  const normalizedPhone = normalizeInvitationPhone(phone);
  if (!normalizedEmail && !normalizedPhone) throw new Error("Invitation recipient is required.");
  return digest(`${normalizedEmail ?? ""}|${normalizedPhone ?? ""}`);
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

export function issueSignedToken(id = randomUUID(), nonce = randomBytes(24).toString("base64url")) {
  const body = encode(JSON.stringify({ v: 1, id, nonce }));
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return { id, token: `${body}.${signature}` };
}

export function verifySignedToken(token: string) {
  const [body, suppliedSignature, extra] = token.split(".");
  if (!body || !suppliedSignature || extra) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(suppliedSignature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return parsed?.v === 1 && typeof parsed.id === "string" && typeof parsed.nonce === "string" ? parsed as { v: 1; id: string; nonce: string } : null;
  } catch { return null; }
}

export function hashInvitationToken(token: string) {
  return digest(token);
}

export function invitationUrl(token: string) {
  const origin = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${origin}/invite/accept?token=${encodeURIComponent(token)}`;
}

export async function createSignedInvitation(admin: AdminClient, input: {
  invitationType: InvitationType;
  intendedRole: InvitationRole;
  gardenId?: string | null;
  targetProfileId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  createdBy: string;
  legacyAffiliationRequestId?: string | null;
  payload?: Record<string, unknown>;
  expiresInHours?: number;
}) {
  const email = normalizeInvitationEmail(input.recipientEmail);
  const phone = normalizeInvitationPhone(input.recipientPhone);
  const fingerprint = recipientFingerprint(email, phone);
  const now = new Date();
  const hours = Math.min(Math.max(input.expiresInHours ?? 168, 1), 720);
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  let prior = admin.from("management_invitations").update({ status: "superseded", updated_at: now.toISOString() })
    .eq("invitation_type", input.invitationType).eq("recipient_fingerprint", fingerprint)
    .in("status", ["pending", "delivered"]);
  prior = input.gardenId ? prior.eq("garden_id", input.gardenId) : prior.is("garden_id", null);
  const superseded = await prior;
  if (superseded.error) throw new Error(superseded.error.message);
  const signed = issueSignedToken();
  const inserted = await admin.from("management_invitations").insert({
    id: signed.id,
    invitation_type: input.invitationType,
    intended_role: input.intendedRole,
    garden_id: input.gardenId ?? null,
    target_profile_id: input.targetProfileId ?? null,
    recipient_email: email,
    recipient_phone: phone,
    recipient_fingerprint: fingerprint,
    token_hash: hashInvitationToken(signed.token),
    status: "pending",
    expires_at: expiresAt,
    created_by: input.createdBy,
    legacy_affiliation_request_id: input.legacyAffiliationRequestId ?? null,
    payload: input.payload ?? {}
  }).select("id,status,expires_at").single();
  if (inserted.error) throw new Error(inserted.error.message);
  return { invitation: inserted.data, token: signed.token, url: invitationUrl(signed.token) };
}

export async function resolveSignedInvitation(admin: AdminClient, token: string) {
  const parsed = verifySignedToken(token);
  if (!parsed) return { ok: false as const, reason: "invalid" as const };
  const result = await admin.from("management_invitations")
    .select("id,invitation_type,intended_role,garden_id,target_profile_id,recipient_email,recipient_phone,status,expires_at,legacy_affiliation_request_id,payload,gardens(name)")
    .eq("id", parsed.id).eq("token_hash", hashInvitationToken(token)).maybeSingle();
  if (result.error || !result.data) return { ok: false as const, reason: "invalid" as const };
  if (!["pending", "delivered"].includes(result.data.status)) return { ok: false as const, reason: result.data.status as string };
  if (new Date(result.data.expires_at).getTime() <= Date.now()) {
    await admin.from("management_invitations").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", parsed.id).in("status", ["pending", "delivered"]);
    return { ok: false as const, reason: "expired" as const };
  }
  return { ok: true as const, invitation: result.data };
}
