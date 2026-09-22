import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { handleSafeRouteError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPasskeyContext, toAuthenticatorTransports, normalizeEmail } from "@/lib/passkeys";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";

export const runtime = "nodejs";

type AuthenticationOptionsBody = {
  email?: string;
};

export async function POST(request: Request) {
  try {
  assertTrustedMutationOrigin(request);
  await assertRateLimit(privateRateLimitIdentifier({ headers: request.headers }), "management:passkey-auth-options", 20, 60);
  const body = (await parseBoundedJson(request, 8 * 1024)) as AuthenticationOptionsBody;
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
    console.error("Passkey credential lookup failed", { errorCode: error.code });
    return NextResponse.json({ error: "לא ניתן לטעון Passkeys כרגע." }, { status: 500 });
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
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
