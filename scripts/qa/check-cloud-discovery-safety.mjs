import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("lib/domain/video-gateway-discovery-safety.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const sandbox = { exports: {}, Set, Error, Object, Array, RegExp, String, Boolean };
vm.runInNewContext(compiled, sandbox, { filename: "video-gateway-discovery-safety.ts" });
const { assertNoForbiddenDiscoveryFields } = sandbox.exports;

function expectPass(name, payload) {
  try {
    assertNoForbiddenDiscoveryFields(payload);
  } catch (error) {
    throw new Error(`${name} should pass but failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function expectBlock(name, payload) {
  try {
    assertNoForbiddenDiscoveryFields(payload);
  } catch {
    return;
  }
  throw new Error(`${name} should be blocked`);
}

expectPass("safe discovery flags", {
  gateway_id: "test-local-gateway",
  observer_site_id: "00000000-0000-4000-8000-000000000000",
  read_only: true,
  controls_supported: false,
  no_secrets_returned: true,
  metadata: {
    no_credentials_received: true,
    ai_shadow_only: true,
    source: "local_gateway_cloud_discovery_web"
  },
  channels: [
    {
      channel: 1,
      status: "connected",
      health_status: "healthy",
      stream_id: "dvr_safe_1",
      reason: "video_stream_found"
    }
  ]
});

expectBlock("password key", { metadata: { password: "redacted" } });
expectBlock("credentialed url", { channels: [{ reason: "rtsp://user:pass@example.invalid/stream" }] });
expectBlock("private endpoint key", { metadata: { endpoint: "192.0.2.10" } });

console.log("Cloud discovery safety checks passed.");
