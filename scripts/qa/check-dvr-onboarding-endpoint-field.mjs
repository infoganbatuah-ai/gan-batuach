import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("scripts/cloud-dvr-discovery-web.mjs", "utf8");

assert.match(source, /<input id="endpoint" name="endpoint"/, "endpoint field must be addressable and stable");
assert.match(source, /placeholder="[^"]*192\.168\.1\.10/, "endpoint field should clearly accept IPv4 addresses");
assert.match(source, /const formState = \{ endpoint: "" \};/, "endpoint value must be held in page memory");
assert.match(source, /endpoint\.addEventListener\("input", rememberEndpoint\)/, "typed endpoint changes must update memory state");
assert.match(source, /endpoint\.addEventListener\("blur",[\s\S]*rememberEndpoint\(\);[\s\S]*keepEndpointVisible\(\)/, "endpoint blur must preserve the visible value");
assert.match(source, /body\.endpoint = formState\.endpoint;/, "CONNECT payload must use the preserved endpoint value");
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/, "DVR onboarding must not persist entered values in browser storage");

console.log("DVR onboarding endpoint field regression check passed.");
