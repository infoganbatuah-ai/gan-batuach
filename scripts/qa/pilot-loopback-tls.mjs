// Local HOME_QA only. The issuer never enters the OS trust store or Product.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, renameSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const day = 86_400_000;
const run = args => execFileSync("/usr/bin/openssl", args,
  { timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });
export const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

export function privateDirectory(root, { create = false } = {}) {
  const path = resolve(root);
  if (!existsSync(path) && create) mkdirSync(path, { mode: 0o700 });
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
    (info.mode & 0o077) || realpathSync(path) !== path) throw new Error("TLS_DIRECTORY_UNSAFE");
  return path;
}

export function privateFile(path) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() ||
    (info.mode & 0o077) || info.size > 32_768) throw new Error("TLS_FILE_UNSAFE");
  return readFileSync(path);
}

function matchingKey(certificate, key) {
  return certificate.publicKey.export({ format: "der", type: "spki" }).equals(
    createPublicKey(createPrivateKey(key)).export({ format: "der", type: "spki" }));
}

export function inspectBundle(root, { now = Date.now(), allowExpiredLeaf = false } = {}) {
  privateDirectory(root);
  const caBytes = privateFile(join(root, "issuer.crt"));
  const ca = new X509Certificate(caBytes);
  const leafBytes = privateFile(join(root, "server.crt"));
  const leaf = new X509Certificate(leafBytes);
  const key = privateFile(join(root, "server.key"));
  const policy = JSON.parse(privateFile(join(root, "policy.json")));
  if (policy.contract !== "observer-loopback-tls-v1" || policy.caSha256 !== sha256(caBytes) ||
    !ca.ca || ca.subjectAltName !== "IP Address:127.0.0.1" || !ca.verify(ca.publicKey) || leaf.ca || !leaf.verify(ca.publicKey) ||
    leaf.checkIP("127.0.0.1") !== "127.0.0.1" || leaf.checkIP("127.0.0.2") ||
    leaf.subjectAltName !== "IP Address:127.0.0.1" || !matchingKey(leaf, key) ||
    Date.parse(ca.validFrom) > now || Date.parse(leaf.validFrom) > now ||
    Date.parse(ca.validTo) <= now || (!allowExpiredLeaf && Date.parse(leaf.validTo) <= now) ||
    Date.parse(leaf.validTo) > Date.parse(ca.validTo)) throw new Error("TLS_BUNDLE_INVALID");
  return { caSha256: sha256(caBytes), leafSha256: sha256(leafBytes),
    caExpiresAt: new Date(ca.validTo).toISOString(), leafExpiresAt: new Date(leaf.validTo).toISOString(),
    leafRemainingMs: Date.parse(leaf.validTo) - now,
    caRenewalRequired: Date.parse(ca.validTo) - now < 90 * day };
}

function issue(root, directory) {
  const extensions = join(directory, "extensions.cnf");
  writeFileSync(extensions, "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n", { mode: 0o600, flag: "wx" });
  run(["req", "-new", "-key", join(root, "server.key"), "-out", join(directory, "server.csr"),
    "-subj", "/CN=observer-home-qa-loopback"]);
  run(["x509", "-req", "-in", join(directory, "server.csr"), "-CA", join(root, "issuer.crt"),
    "-CAkey", join(root, "issuer.key"), "-set_serial", `0x${sha256(Buffer.from(directory)).slice(0, 32)}`,
    "-days", "30", "-sha256", "-extfile", extensions, "-out", join(directory, "server.crt")]);
  chmodSync(join(directory, "server.crt"), 0o600);
}

export function initializeBundle(root) {
  privateDirectory(root, { create: true });
  if (["issuer.key", "issuer.crt", "server.key", "server.crt", "policy.json"].some(name => existsSync(join(root, name))))
    throw new Error("TLS_INITIALIZATION_WOULD_OVERWRITE");
  run(["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "1095", "-sha256",
    "-keyout", join(root, "issuer.key"), "-out", join(root, "issuer.crt"),
    "-subj", "/CN=observer-home-qa-loopback-local-issuer",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-addext", "subjectKeyIdentifier=hash",
    "-addext", "subjectAltName=IP:127.0.0.1",
    "-addext", "nameConstraints=critical,permitted;IP:127.0.0.1/255.255.255.255"]);
  run(["genrsa", "-out", join(root, "server.key"), "2048"]);
  for (const name of ["issuer.key", "issuer.crt", "server.key"]) chmodSync(join(root, name), 0o600);
  writeFileSync(join(root, "policy.json"), JSON.stringify({ contract: "observer-loopback-tls-v1",
    caSha256: sha256(privateFile(join(root, "issuer.crt"))), host: "127.0.0.1", leafDays: 30,
    renewalThresholdDays: 7, osTrustModified: false }) + "\n", { mode: 0o600, flag: "wx" });
  const staging = mkdtempSync(join(root, ".issue-"));
  try { issue(root, staging); renameSync(join(staging, "server.crt"), join(root, "server.crt")); }
  finally { rmSync(staging, { recursive: true, force: true }); }
  return inspectBundle(root);
}

export function renewBundle(root, { now = Date.now(), reload = () => {} } = {}) {
  privateDirectory(root);
  const lock = join(root, ".renewal-lock");
  mkdirSync(lock, { mode: 0o700 }); // No stale-lock deletion or concurrent issuance.
  let staging;
  try {
    const before = inspectBundle(root, { now, allowExpiredLeaf: true });
    if (before.caRenewalRequired) throw new Error("TLS_ISSUER_REQUIRES_CONTROLLED_RENEWAL");
    if (before.leafRemainingMs > 7 * day) return { renewed: false, ...before };
    // The signing key is only opened by this bounded local renewal operation.
    const ca = new X509Certificate(privateFile(join(root, "issuer.crt")));
    if (!matchingKey(ca, privateFile(join(root, "issuer.key")))) throw new Error("TLS_ISSUER_KEY_MISMATCH");
    staging = mkdtempSync(join(root, ".issue-"));
    issue(root, staging);
    const next = new X509Certificate(privateFile(join(staging, "server.crt")));
    if (!next.verify(ca.publicKey) || next.subjectAltName !== "IP Address:127.0.0.1" ||
      !matchingKey(next, privateFile(join(root, "server.key"))) || Date.parse(next.validTo) <= now + day)
      throw new Error("TLS_NEW_LEAF_INVALID");
    writeFileSync(join(staging, "previous.crt"), privateFile(join(root, "server.crt")), { mode: 0o600, flag: "wx" });
    renameSync(join(staging, "server.crt"), join(root, "server.crt"));
    try { inspectBundle(root, { now }); reload(); }
    catch (error) { renameSync(join(staging, "previous.crt"), join(root, "server.crt")); throw error; }
    return { renewed: true, ...inspectBundle(root, { now }) };
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true });
    rmdirSync(lock);
  }
}
