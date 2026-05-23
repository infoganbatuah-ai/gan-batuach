import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { dashboardPathForRole } from "@/lib/auth";
import { credentialFromRow, getPasskeyContext, normalizeEmail } from "@/lib/passkeys";
import { isRole } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AuthenticationVerifyBody = {
  email?: string;
  response?: AuthenticationResponseJSON;
};

export async function POST(request: Request) {
  const body = (await request.json()) as AuthenticationVerifyBody;
  const email = normalizeEmail(body.email);

  if (!body.response?.id) {
    return NextResponse.json({ error: "חסרה תגובת Passkey מהדפדפן." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { origin, rpID } = getPasskeyContext(request);

  const { data: credential } = await admin
    .from("passkey_credentials")
    .select("*")
    .eq("credential_id", body.response.id)
    .maybeSingle();

  if (!credential?.email || !credential.user_id) {
    return NextResponse.json({ error: "ה־Passkey לא מוכר במערכת." }, { status: 401 });
  }

  if (email && String(credential.email).toLowerCase() !== email) {
    return NextResponse.json({ error: "ה־Passkey לא מתאים לאימייל שהוזן." }, { status: 401 });
  }

  const credentialEmail = String(credential.email).toLowerCase();
  const { data: challengeRow } = await admin
    .from("passkey_challenges")
    .select("id, challenge")
    .eq("email", credentialEmail)
    .eq("challenge_type", "authentication")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow?.challenge) {
    return NextResponse.json({ error: "בקשת הכניסה פגה. נסה שוב." }, { status: 400 });
  }

  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge: String(challengeRow.challenge),
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: credentialFromRow({
      credential_id: String(credential.credential_id),
      public_key: String(credential.public_key),
      counter: Number(credential.counter ?? 0),
      transports: credential.transports
    }),
    requireUserVerification: true
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "אימות ה־Passkey נכשל." }, { status: 401 });
  }

  await admin.from("passkey_credentials").update({
    counter: verification.authenticationInfo.newCounter,
    device_type: verification.authenticationInfo.credentialDeviceType,
    backed_up: verification.authenticationInfo.credentialBackedUp,
    last_used_at: new Date().toISOString()
  }).eq("id", String(credential.id));

  await admin.from("passkey_challenges").delete().eq("id", String(challengeRow.id));

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: credentialEmail });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) {
    return NextResponse.json({ error: link.error?.message || "לא ניתן לפתוח session מאובטח." }, { status: 500 });
  }

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (otpError) {
    return NextResponse.json({ error: otpError.message }, { status: 500 });
  }

  const { data: profile } = await admin.from("profiles").select("role").eq("id", String(credential.user_id)).single();
  const role = profile?.role;
  const redirectTo = isRole(role) ? dashboardPathForRole(role) : "/dashboard";

  await admin.from("audit_logs").insert({
    actor_id: credential.user_id,
    action: "passkey_login",
    target_table: "passkey_credentials",
    after_data: { credential_id: credential.credential_id }
  });

  return NextResponse.json({ ok: true, redirectTo });
}
