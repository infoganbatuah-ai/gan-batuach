import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const poll = server.slice(server.indexOf("async function pollCloudCameraActions()"), server.indexOf("\nfunction safeEqual("));
assert.ok(poll.includes("setInterval"));
for (const failure of ["keychain", "unexpected"]) {
  const script = `
    import assert from 'node:assert/strict';
    let cameraActionPollPromise = null, attempts = 0, tick;
    const GATEWAY_KEYCHAIN_SERVICE = 'synthetic';
    const keychainSecret = async () => { attempts++; throw new Error('synthetic keychain timeout'); };
    const setInterval = callback => { tick = callback; return { unref() {} }; };
    ${poll}
    ${failure === "unexpected" ? "pollCloudCameraActions = async () => { attempts++; throw new Error('unexpected polling failure'); };" : ""}
    for (let i = 0; i < 3; i++) {
      tick();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(cameraActionPollPromise, null, 'Rejected work must release the single-flight lock');
    }
    assert.equal(attempts, 3, 'The next scheduled poll must recover after a failed Keychain operation');
    console.log('background-poll-survived');
  `;
  const result = spawnSync(process.execPath, ["--unhandled-rejections=strict", "--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 0, `${failure} must not crash the Gateway: ${result.stderr}`);
  assert.match(result.stdout, /background-poll-survived/);
}
console.log("PASS: real strict Node process survives Keychain and unexpected background poll rejections; retries remain unlocked");
