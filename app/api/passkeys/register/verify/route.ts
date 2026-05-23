import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPasskeyContext, toBase64Url } from "@/lib/passkeys";

export const runtime = "nodejs";

type RegisterVerifyBody = {
  label?: string;
  response?: RegistrationResponseJSON;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "יש להתחבר עם סיסמה לפני הפעלת Passkey." }, { status: 401 });
  }

  const body = (await request.json()) as RegisterVerifyBody;
  if (!body.response) {
    return NextResponse.json({ error: "חסרה תגובת Passkey מהדפדפן." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { origin, rpID } = getPasskeyContext(request);
  const { data: challengeRow } = await admin
    .from("passkey_challenges")
    .select("id, challenge")
    .eq("user_id", user.id)
    .eq("challenge_type", "registration")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow?.challenge) {
    return NextResponse.json({ error: "בקשת ההפעלה פגה. נסה שוב." }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: String(challengeRow.challenge),
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "אימות ה־Passkey נכשל." }, { status: 400 });
  }

  const info = verification.registrationInfo;
  const transports = body.response.response.transports ?? [];
  const { error } = await admin.from("passkey_credentials").insert({
    user_id: user.id,
    email: user.email.toLowerCase(),
    credential_id: info.credential.id,
    public_key: toBase64Url(info.credential.publicKey),
    counter: info.credential.counter,
    device_type: info.credentialDeviceType,
    backed_up: info.credentialBackedUp,
    transports,
    label: body.label || "המכשיר שלי"
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("passkey_challenges").delete().eq("id", String(challengeRow.id));
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "passkey_registered",
    target_table: "passkey_credentials",
    after_data: { credential_id: info.credential.id, device_type: info.credentialDeviceType }
  });

  return NextResponse.json({ ok: true });
}
