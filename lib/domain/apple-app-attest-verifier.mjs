// Offline App Attest verifier. No route, registration service, or sender imports it.
// https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
import { createHash, timingSafeEqual, X509Certificate } from "node:crypto";
import { decodeAttestationObject, getCertificateInfo, isoCBOR } from "@simplewebauthn/server/helpers";
import { encodePushRegistrationChallenge } from "./push-registration-challenge.ts";

// DER of https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem
const APPLE_ROOT_DER_BASE64 = "MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYwJAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwKQXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNaFw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlvbiBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9ybmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdhNbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9auYen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijVoyFraWVIyd/dganmrduC1bmTBGwD";
const APPLE_ROOT_SHA256 = "1cb9823ba28ba6ad2d33a006941de2ae4f513ef1d4e831b9f7e0fa7b6242c932";
const NONCE_OID = "1.2.840.113635.100.8.2";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest();
const equal = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const validAt = (cert, now) => Date.parse(cert.validFrom) <= now && now <= Date.parse(cert.validTo);

function nonceFromExtension(leafDer) {
  const extensions = getCertificateInfo(leafDer).parsedCertificate.tbsCertificate.extensions ?? [];
  const values = extensions.filter((entry) => entry.extnID === NONCE_OID);
  if (values.length !== 1) throw Error("nonce_extension_count");
  const der = Buffer.from(values[0].extnValue.buffer);
  // DER SEQUENCE { [1] EXPLICIT OCTET STRING(32) }.
  if (der.length !== 38 || der[0] !== 0x30 || der[1] !== 36 ||
      der[2] !== 0xa1 || der[3] !== 34 || der[4] !== 0x04 || der[5] !== 32)
    throw Error("nonce_extension_shape");
  return der.subarray(6);
}

function nextCbor(bytes, offset) {
  const value = isoCBOR.decodeFirst(bytes.subarray(offset));
  const encoded = Buffer.from(isoCBOR.encode(value));
  if (!encoded.length || !equal(bytes.subarray(offset, offset + encoded.length), encoded))
    throw Error("cbor_encoding");
  return [value, offset + encoded.length];
}

function certificatePoint(cert) {
  const jwk = cert.publicKey.export({ format: "jwk" });
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") throw Error("certificate_key");
  const x = Buffer.from(jwk.x ?? "", "base64url"), y = Buffer.from(jwk.y ?? "", "base64url");
  if (x.length !== 32 || y.length !== 32) throw Error("certificate_key");
  return Buffer.concat([Buffer.from([4]), x, y]);
}

/**
 * Caller must supply a server-owned, unpredictable challenge and an atomic,
 * durable consumeChallengeOnce(challengeHash, keyId) operation. This verifier
 * does not create an enrollment, verify Apple's receipt, or enable any route.
 * A null result is always denial; detailed rejection reasons are not exported.
 */
export async function verifyAppleAppAttestObject(input) {
  try {
    const { attestationObject, serverChallenge, keyIdBase64, teamId, bundleId,
      environment, nowMs, consumeChallengeOnce } = input ?? {};
    if (!(attestationObject instanceof Uint8Array) || !attestationObject.length ||
        attestationObject.length > 32768 || !(serverChallenge instanceof Uint8Array) ||
        serverChallenge.length < 16 || serverChallenge.length > 4096 ||
        typeof teamId !== "string" || !/^[A-Z0-9]{10}$/.test(teamId) ||
        typeof bundleId !== "string" || !/^[A-Za-z0-9.-]{3,160}$/.test(bundleId) ||
        !["development", "production"].includes(environment) ||
        typeof keyIdBase64 !== "string" || !Number.isFinite(nowMs) ||
        typeof consumeChallengeOnce !== "function") return null;
    const keyId = Buffer.from(keyIdBase64, "base64");
    if (keyId.length !== 32 || keyId.toString("base64") !== keyIdBase64) return null;

    const raw = Buffer.from(attestationObject);
    const object = decodeAttestationObject(raw);
    if (!(object instanceof Map) || !equal(Buffer.from(isoCBOR.encode(object)), raw) ||
        object.get("fmt") !== "apple-appattest") return null;
    const stmt = object.get("attStmt"), authValue = object.get("authData");
    if (!(stmt instanceof Map) || !(authValue instanceof Uint8Array)) return null;
    const chain = stmt.get("x5c"), receipt = stmt.get("receipt");
    if (!Array.isArray(chain) || chain.length !== 2 ||
        !chain.every((part) => part instanceof Uint8Array) ||
        !(receipt instanceof Uint8Array) || !receipt.length) return null;

    const root = new X509Certificate(Buffer.from(APPLE_ROOT_DER_BASE64, "base64"));
    if (sha256(root.raw).toString("hex") !== APPLE_ROOT_SHA256) return null;
    const leaf = new X509Certificate(Buffer.from(chain[0]));
    const intermediate = new X509Certificate(Buffer.from(chain[1]));
    if (![root, intermediate, leaf].every((cert) => validAt(cert, nowMs)) ||
        leaf.ca || !intermediate.ca || !root.ca || !root.verify(root.publicKey) ||
        !intermediate.checkIssued(root) || !intermediate.verify(root.publicKey) ||
        !leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) return null;

    const auth = Buffer.from(authValue);
    if (auth.length < 88 || auth[32] !== 0x40 || auth.readUInt32BE(33) !== 0 ||
        !equal(auth.subarray(0, 32), sha256(Buffer.from(teamId + "." + bundleId)))) return null;
    const aaguid = environment === "development" ? Buffer.from("appattestdevelop", "ascii")
      : Buffer.concat([Buffer.from("appattest", "ascii"), Buffer.alloc(7)]);
    if (!equal(auth.subarray(37, 53), aaguid) || auth.readUInt16BE(53) !== 32 ||
        !equal(auth.subarray(55, 87), keyId)) return null;
    const [cose, coseEnd] = nextCbor(auth, 87);
    // Newer Apple objects may append the documented bundle-version and
    // validation-category fields after the credential public key.
    let end = coseEnd;
    if (end < auth.length) {
      const [extensions, extensionEnd] = nextCbor(auth, end);
      if (!(extensions instanceof Map) ||
          [...extensions.keys()].some((key) => !["apple_bundle_version_01", "apple_validation_category_01"].includes(key)) ||
          (extensions.has("apple_bundle_version_01") &&
            (typeof extensions.get("apple_bundle_version_01") !== "string" ||
             extensions.get("apple_bundle_version_01").length > 64)) ||
          (extensions.has("apple_validation_category_01") &&
            (!(extensions.get("apple_validation_category_01") instanceof Uint8Array) ||
             extensions.get("apple_validation_category_01").length !== 4))) return null;
      end = extensionEnd;
    }
    if (end !== auth.length || !(cose instanceof Map) ||
        cose.get(1) !== 2 || cose.get(3) !== -7 || cose.get(-1) !== 1 ||
        !(cose.get(-2) instanceof Uint8Array) || !(cose.get(-3) instanceof Uint8Array)) return null;
    const point = certificatePoint(leaf);
    if (!equal(point, Buffer.concat([Buffer.from([4]), cose.get(-2), cose.get(-3)])) ||
        !equal(sha256(point), keyId)) return null;

    // Apple specifies clientDataHash = SHA256(server challenge), not raw challenge.
    const expectedNonce = sha256(Buffer.concat([auth, sha256(serverChallenge)]));
    if (!equal(nonceFromExtension(leaf.raw), expectedNonce)) return null;
    const challengeHash = sha256(serverChallenge).toString("hex");
    if (!await consumeChallengeOnce(challengeHash, keyIdBase64)) return null;
    return { keyIdBase64,
      publicKeySpkiDer: Buffer.from(leaf.publicKey.export({ type: "spki", format: "der" })),
      environment, counter: 0, challengeSha256: challengeHash,
      receipt: Buffer.from(receipt), receiptVerified: false };
  } catch { return null; }
}

// Offline adapter to the existing canonical, length-prefixed registration
// challenge. No live registration path calls this adapter.
export async function verifyPushRegistrationAppAttest(input) {
  try {
    return await verifyAppleAppAttestObject({
      ...input,
      serverChallenge: encodePushRegistrationChallenge(input.challenge)
    });
  } catch { return null; }
}
