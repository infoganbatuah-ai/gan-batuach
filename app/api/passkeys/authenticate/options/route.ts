import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPasskeyContext, toAuthenticatorTransports, normalizeEmail } from "@/lib/passkeys";

export const runtime = "nodejs";

type AuthenticationOptionsBody = {
  email?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as AuthenticationOptionsBody;
  const email = normalizeEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: "נא להזין אימייל כדי למצוא את ה־Passkey שלך." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { rpID } = getPasskeyContext(request);
  const { data: credentials, error } = await admin
    .from("passkey_credentials")
    .select("credential_id, transports")
    .eq("email", email);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!credentials?.length) {
    return NextResponse.json({ error: "לא נמצא Passkey למייל הזה. אפשר להיכנס בסיסמה ולהפעיל כניסה מהירה." }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: String(credential.credential_id),
      transports: toAuthenticatorTransports(credential.transports)
    }))
  });

  await admin.from("passkey_challenges").insert({
    email,
    challenge: options.challenge,
    challenge_type: "authentication"
  });

  return NextResponse.json({ options });
}
