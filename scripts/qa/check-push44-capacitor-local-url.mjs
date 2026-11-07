import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../capacitor.config.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
function config(env = {}) {
  const exports = {};
  runInNewContext(compiled, {exports, process: {env}, URL});
  return exports.default;
}

test("default, precedence, and exact parsed local hosts", () => {
  assert.equal(config().server.url, "http://localhost:3000");
  assert.equal(config().server.cleartext, true);
  for (const url of ["http://localhost", "HTTP://LOCALHOST:3000/path?q=1", "http://127.0.0.1:80/a", "http://10.0.2.2:8080/?q=1", "http://127.1:3000", "http://2130706433"]) {
    assert.equal(config({CAPACITOR_SERVER_URL: url}).server.cleartext, true, url);
  }
  const selected = config({CAPACITOR_SERVER_URL: "https://remote.example", NEXT_PUBLIC_APP_URL: "http://localhost:3000"});
  assert.equal(selected.server.url, "https://remote.example");
  assert.equal(selected.server.cleartext, false);
  assert.equal(config({CAPACITOR_SERVER_URL: "", NEXT_PUBLIC_APP_URL: "http://10.0.2.2:3000"}).server.cleartext, true);
});

test("lookalikes, userinfo, invalid URLs and non-HTTP never enable cleartext", () => {
  for (const url of ["http://localhost.evil.test", "http://127.0.0.1.evil.test", "http://localhost@evil.test",
    "http://user@localhost", "http://@localhost", "http://localhost@localhost", "http://user:pw@localhost", "http://localhost:bad", "http://local\nhost:3000",
    "http://localhost:65536", "http://", "http:localhost", "http:///localhost", "http://evil.test",
    "https://localhost", "https://remote.example", "ftp://localhost", "javascript:alert(1)", "not a URL",
    "http://localhost./", "http://localhost%2eevil.test"]) {
    const actual = config({CAPACITOR_SERVER_URL: url});
    assert.equal(actual.server.url, url);
    assert.equal(actual.server.cleartext, false, url);
  }
});
