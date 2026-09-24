import assert from "node:assert/strict";
import test from "node:test";
import { singleUseAuthCodeExchange } from "../../lib/domain/single-use-auth-code.ts";

test("a replayed confirmation code has one exchange even while the first attempt is pending", async () => {
  let calls = 0;
  let resolve;
  const exchange = singleUseAuthCodeExchange(() => {
    calls += 1;
    return new Promise((done) => { resolve = done; });
  });

  const attempts = Array.from({ length: 10 }, () => exchange("synthetic-single-use-code"));
  assert.equal(calls, 1);
  resolve({ user: "qa-user" });
  assert.deepEqual(await Promise.all(attempts), Array(10).fill({ user: "qa-user" }));
  assert.deepEqual(await exchange("synthetic-single-use-code"), { user: "qa-user" });
  assert.equal(calls, 1);
});

test("a different confirmation code gets its own exchange", async () => {
  let calls = 0;
  const exchange = singleUseAuthCodeExchange(async (code) => {
    calls += 1;
    return code;
  });

  assert.equal(await exchange("qa-code-a"), "qa-code-a");
  assert.equal(await exchange("qa-code-b"), "qa-code-b");
  assert.equal(calls, 2);
});
