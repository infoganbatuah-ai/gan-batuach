import crypto from "node:crypto";

const apiUrl = String(process.env.API_URL || "");
const serviceKey = String(process.env.SERVICE_ROLE_KEY || "");
const anonKey = String(process.env.ANON_KEY || "");

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(apiUrl)) {
  throw new Error("Storage recovery proof is restricted to a loopback Supabase QA stack");
}
if (!serviceKey || !anonKey) throw new Error("Isolated QA Supabase keys are required");

const bucket = `qa-gb-m40-recovery-${Date.now()}`;
const objectPath = `synthetic/${crypto.randomUUID()}.txt`;
const payload = Buffer.from(`GB-M40 synthetic recovery proof ${crypto.randomUUID()}`, "utf8");
const expectedHash = crypto.createHash("sha256").update(payload).digest("hex");
const serviceHeaders = { authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

async function expectOk(response, label) {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`);
  return response;
}

let bucketCreated = false;
try {
  await expectOk(await fetch(`${apiUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...serviceHeaders, "content-type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 1024 * 1024 })
  }), "create private QA bucket");
  bucketCreated = true;

  await expectOk(await fetch(`${apiUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { ...serviceHeaders, "content-type": "text/plain", "x-upsert": "false" },
    body: payload
  }), "upload synthetic object");

  const backupResponse = await expectOk(await fetch(`${apiUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: serviceHeaders
  }), "export synthetic object");
  const backup = Buffer.from(await backupResponse.arrayBuffer());
  if (crypto.createHash("sha256").update(backup).digest("hex") !== expectedHash) {
    throw new Error("Exported object hash did not match source");
  }

  const rawAnon = await fetch(`${apiUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: { authorization: `Bearer ${anonKey}`, apikey: anonKey }
  });
  if (rawAnon.ok) throw new Error("Anonymous raw private-object retrieval unexpectedly succeeded");

  await expectOk(await fetch(`${apiUrl}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { ...serviceHeaders, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [objectPath] })
  }), "delete original object");

  await expectOk(await fetch(`${apiUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { ...serviceHeaders, "content-type": "text/plain", "x-upsert": "false" },
    body: backup
  }), "restore synthetic object");

  const signResponse = await expectOk(await fetch(`${apiUrl}/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: "POST",
    headers: { ...serviceHeaders, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 })
  }), "issue signed retrieval");
  const signed = await signResponse.json();
  const signedPath = signed.signedURL || signed.signedUrl;
  if (!signedPath) throw new Error("Storage API did not return a signed URL");
  const signedUrl = signedPath.startsWith("/object/")
    ? `${apiUrl}/storage/v1${signedPath}`
    : new URL(signedPath, apiUrl).toString();
  const restoredResponse = await expectOk(await fetch(signedUrl), "signed restored-object retrieval");
  const restored = Buffer.from(await restoredResponse.arrayBuffer());
  if (crypto.createHash("sha256").update(restored).digest("hex") !== expectedHash) {
    throw new Error("Restored object hash did not match backup");
  }

  console.log(JSON.stringify({
    result: "PASS",
    environment: "isolated_loopback_qa",
    private_raw_anonymous_access: "DENIED",
    backup_hash_match: true,
    restored_hash_match: true,
    authorized_signed_retrieval: "PASS",
    production_provider_restore: "NOT_TESTED"
  }));
} finally {
  if (bucketCreated) {
    await fetch(`${apiUrl}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { ...serviceHeaders, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [objectPath] })
    }).catch(() => undefined);
    await fetch(`${apiUrl}/storage/v1/bucket/${bucket}`, { method: "DELETE", headers: serviceHeaders }).catch(() => undefined);
  }
}
