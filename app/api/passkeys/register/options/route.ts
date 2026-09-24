import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { handleSafeRouteError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPasskeyContext, toAuthenticatorTransports } from "@/lib/passkeys";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, privateRateLimitIdentifier } from "@/lib/security/request-guards";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
  assertTrustedMutationOrigin(request);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "יש להתחבר עם סיסמה לפני הפעלת Passkey." }, { status: 401 });
  }
  await assertRateLimit(privateRateLimitIdentifier({ headers: request.headers, userId: user.id }), "management:passkey-register-options", 10, 10 * 60);

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  const admin = createAdminClient();
  const { rpName, rpID } = getPasskeyContext(request);

  const { data: existingCredentials } = await admin
    .from("passkey_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userID: new TextEncoder().encode(user.id),
    userDisplayName: String(profile?.full_name || user.email),
    attestationType: "none",
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required"
    },
    excludeCredentials: (existingCredentials ?? []).map((credential) => ({
      id: String(credential.credential_id),
      transports: toAuthenticatorTransports(credential.transports)
    }))
  });

  await admin.from("passkey_challenges").insert({
    user_id: user.id,
    email: user.email.toLowerCase(),
    challenge: options.challenge,
    challenge_type: "registration"
  });

  return NextResponse.json({ options });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
