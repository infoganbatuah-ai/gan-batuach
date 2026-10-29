import test from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync,
  symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";
import { initializeBundle, inspectBundle, renewBundle, sha256 } from "./pilot-loopback-tls.mjs";

test("HOME_QA stable issuer, bounded renewal, recovery and TLS isolation", async t => {
  const root = mkdtempSync("/private/tmp/observer-tls-unit-");
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const initial = initializeBundle(root);
  const ca = readFileSync(join(root, "issuer.crt"));
  const key = readFileSync(join(root, "server.key"));
  await t.test("validates only loopback and an issuer-pinned chain", () => {
    assert.equal(initial.caRenewalRequired, false);
    assert.ok(initial.leafRemainingMs > 29 * 86_400_000);
    assert.equal(initial.caSha256, sha256(ca));
  });
  await t.test("refuses overwrite of existing certificate material", () => {
    assert.throws(() => initializeBundle(root), /WOULD_OVERWRITE/);
  });
  await t.test("does not renew or signal before threshold", () => {
    let calls = 0;
    assert.equal(renewBundle(root, { reload: () => calls++ }).renewed, false);
    assert.equal(calls, 0);
  });
  await t.test("renewal keeps issuer and server key stable and requests reload", () => {
    let calls = 0;
    const renewed = renewBundle(root, { now: Date.now() + 24 * 86_400_000, reload: () => calls++ });
    assert.equal(renewed.renewed, true);
    assert.equal(calls, 1);
    assert.notEqual(renewed.leafSha256, initial.leafSha256);
    assert.deepEqual(readFileSync(join(root, "issuer.crt")), ca);
    assert.deepEqual(readFileSync(join(root, "server.key")), key);
  });
  await t.test("failed reload rolls back leaf bytes", () => {
    const before = readFileSync(join(root, "server.crt"));
    assert.throws(() => renewBundle(root, { now: Date.now() + 24 * 86_400_000,
      reload: () => { throw new Error("CONTROLLED_RELOAD_FAILURE"); } }), /CONTROLLED_RELOAD_FAILURE/);
    assert.deepEqual(readFileSync(join(root, "server.crt")), before);
  });
  await t.test("concurrent renewal lock fails without deleting another lock", () => {
    mkdirSync(join(root, ".renewal-lock"), { mode: 0o700 });
    assert.throws(() => renewBundle(root), /EEXIST/);
    rmSync(join(root, ".renewal-lock"), { recursive: true });
  });
  await t.test("unsafe permissions and symlinked files fail closed", () => {
    chmodSync(join(root, "server.key"), 0o644);
    assert.throws(() => inspectBundle(root), /TLS_FILE_UNSAFE/);
    chmodSync(join(root, "server.key"), 0o600);
    renameSync(join(root, "server.key"), join(root, "saved.key"));
    symlinkSync(join(root, "saved.key"), join(root, "server.key"));
    assert.throws(() => inspectBundle(root), /TLS_FILE_UNSAFE/);
    rmSync(join(root, "server.key"));
    renameSync(join(root, "saved.key"), join(root, "server.key"));
  });
  await t.test("pin tampering is rejected", () => {
    const file = join(root, "policy.json"), before = readFileSync(file);
    const policy = JSON.parse(before); policy.caSha256 = "0".repeat(64);
    writeFileSync(file, JSON.stringify(policy), { mode: 0o600 });
    assert.throws(() => inspectBundle(root), /TLS_BUNDLE_INVALID/);
    writeFileSync(file, before, { mode: 0o600 });
  });
  await t.test("wake after expired leaf can recover without changing issuer", () => {
    const run = args => execFileSync("/usr/bin/openssl", args, { stdio: "pipe", timeout: 30_000 });
    run(["req", "-new", "-key", join(root, "server.key"), "-out", join(root, "expired.csr"),
      "-subj", "/CN=observer-home-qa-loopback"]);
    writeFileSync(join(root, "index.txt"), "", { mode: 0o600 });
    writeFileSync(join(root, "serial"), "1234\n", { mode: 0o600 });
    writeFileSync(join(root, "expired.cnf"), `[ca]\ndefault_ca=local\n[local]\ndatabase=${root}/index.txt\nserial=${root}/serial\nnew_certs_dir=${root}\ncertificate=${root}/issuer.crt\nprivate_key=${root}/issuer.key\ndefault_md=sha256\npolicy=names\nx509_extensions=leaf\n[names]\ncommonName=supplied\n[leaf]\nbasicConstraints=critical,CA:FALSE\nsubjectAltName=IP:127.0.0.1\n`, { mode: 0o600 });
    run(["ca", "-batch", "-config", join(root, "expired.cnf"), "-in", join(root, "expired.csr"),
      "-startdate", "20200101000000Z", "-enddate", "20200102000000Z", "-notext",
      "-out", join(root, "server.crt")]);
    chmodSync(join(root, "server.crt"), 0o600);
    assert.throws(() => inspectBundle(root), /TLS_BUNDLE_INVALID/);
    assert.equal(renewBundle(root).renewed, true);
    assert.equal(inspectBundle(root).caSha256, initial.caSha256);
  });
  await t.test("real TLS accepts approved peer, rejects wrong issuer and wrong hostname", async () => {
    const server = https.createServer({ key, cert: readFileSync(join(root, "server.crt")) },
      (_request, response) => response.writeHead(401).end());
    await new Promise(done => server.listen(0, "127.0.0.1", done));
    const port = server.address().port;
    const request = options => new Promise((resolve, reject) => {
      const req = https.get({ host: "127.0.0.1", port, agent: false, timeout: 2000, ...options },
        response => { response.resume(); resolve(response.statusCode); });
      req.on("error", reject);
    });
    try {
      assert.equal(await request({ ca }), 401);
      const python = await promisify(execFile)("python3", ["-c",
        "import ssl,urllib.request,urllib.error,sys; c=ssl.create_default_context(cafile=sys.argv[1]);\ntry:\n urllib.request.urlopen(sys.argv[2],context=c,timeout=3)\nexcept urllib.error.HTTPError as e:\n print(e.code)\n",
        join(root, "issuer.crt"), `https://127.0.0.1:${port}/`], { timeout: 5000 });
      assert.equal(python.stdout.trim(), "401");
      await assert.rejects(request({}), /certificate|issuer|self-signed/i);
      await assert.rejects(request({ ca, servername: "wrong.invalid" }), /Hostname|altnames|IP/i);
    } finally { await new Promise(done => server.close(done)); }
  });
});
