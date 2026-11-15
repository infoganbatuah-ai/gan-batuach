import assert from "node:assert/strict";
import { test } from "node:test";
import { createQaAccessReturn } from "../../review-only/push44-ios-handoff-contract/qa-access-return.mjs";

const account = "qa-account-a";
const installation = "qa-installation-a";
const audience = "com.ganbatuach.app.qa";
const make = (clock = () => 1_000) => createQaAccessReturn({ enabled: true, now: clock,
  makeState: () => "a".repeat(64) });
const url = (state) => `https://qa-iphone-device-proof.ganbatuach.com/qa/device-proof/return?state=${state}`;

test("feature is off by default", () => {
  assert.equal(createQaAccessReturn().begin(account, installation), null);
});

test("exact return consumes local state once", () => {
  const flow = make();
  const pending = flow.begin(account, installation);
  assert.equal(flow.begin(account, installation), null);
  assert.equal(flow.consume(url(pending.state), account, installation, audience), true);
  assert.equal(flow.consume(url(pending.state), account, installation, audience), false);
});

for (const [name, transform] of [
  ["wrong origin", (value) => value.replace("ganbatuach.com", "attacker.invalid")],
  ["wrong scheme", (value) => value.replace("https:", "http:")],
  ["wrong path", (value) => value.replace("/return?", "/other?")],
  ["bearer in URL", (value) => `${value}&access_token=secret`],
  ["fragment", (value) => `${value}#token`],
  ["duplicate state", (value) => `${value}&state=${"a".repeat(64)}`],
  ["wrong state", (value) => value.replace("a".repeat(64), "b".repeat(64))]
]) test(`${name} is rejected and consumes pending state`, () => {
  const flow = make();
  const pending = flow.begin(account, installation);
  assert.equal(flow.consume(transform(url(pending.state)), account, installation, audience), false);
  assert.equal(flow.consume(url(pending.state), account, installation, audience), false);
});

test("expiry, account switch, and installation switch fail closed", () => {
  let time = 1_000;
  const expired = make(() => time);
  const pending = expired.begin(account, installation);
  time += 120_000;
  assert.equal(expired.consume(url(pending.state), account, installation, audience), false);
  for (const [otherAccount, otherInstallation, otherAudience] of [
    ["other", installation, audience], [account, "other", audience], [account, installation, "other"]
  ]) {
    const flow = make();
    const next = flow.begin(account, installation);
    assert.equal(flow.consume(url(next.state), otherAccount, otherInstallation, otherAudience), false);
  }
});
