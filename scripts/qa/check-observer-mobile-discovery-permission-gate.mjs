import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../components/digital-observer/universal-camera-onboarding.tsx", import.meta.url), "utf8");
const script = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const siteId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

function mount(startData) {
  const slots = [];
  const actions = [];
  const bridgeCalls = [];
  const receipt = { permission: "DENIED", candidates: [] };
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (value) => { slots[index] = value; }];
      },
      useRef: (current) => ({ current }),
      useCallback: (callback) => callback
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { Camera: "camera-icon", LoaderCircle: "loader-icon" },
    "@/lib/domain/digital-observer/client-session": { readObserverAccessToken: () => null },
    "@/lib/domain/digital-observer/connectivity-registry": { connectivityRegistry: [] },
    "./software-connector-onboarding": { SoftwareConnectorOnboarding: "connector" },
    "./connector-install-handoff": { ConnectorInstallHandoff: "handoff" }
  };
  const exports = {};
  runInNewContext(script, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), name);
      return modules[name];
    },
    window: { DigitalObserverCameraDiscovery: {
      async discoverLocalCameras(input) {
        bridgeCalls.push(JSON.parse(JSON.stringify(input)));
        return receipt;
      }
    } },
    async fetch(url, options) {
      assert.equal(url, "/api/digital-observer/mobile-camera-setup");
      const body = JSON.parse(options.body);
      assert.equal(body.observer_site_id, siteId);
      actions.push(body.action);
      if (body.action === "submit") {
        assert.equal(body.session_id, sessionId);
        assert.deepEqual(body.receipt, receipt);
      } else {
        assert.equal(body.action, "start");
      }
      return { ok: true, json: async () => ({ data: body.action === "start" ? startData : {
        plan: { nextAction: "IDENTIFY", reason: "SYNTHETIC_FALLBACK" }
      } }) };
    }
  }, { timeout: 1000 });
  function render() {
    cursor = 0;
    return exports.UniversalCameraOnboarding({ sites: [{ id: siteId, name: "Synthetic" }] });
  }
  return { actions, bridgeCalls, render };
}

function findNodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => findNodes(child, predicate));
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...findNodes(node.props.children, predicate)];
}

async function clickDiscovery(harness) {
  const [button] = findNodes(harness.render(), (node) => node.type === "button" && node.props.children === "חיפוש זמני ברשת הביתית");
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  for (let i = 0; i < 24; i++) await Promise.resolve();
}

for (const [name, startData] of [
  ["disabled", { state: "NATIVE_DISCOVERY_UNAVAILABLE", session_id: sessionId }],
  ["missing readiness", { session_id: sessionId }],
  ["missing session", { state: "WAITING_FOR_PERMISSION" }]
]) {
  test(`mobile camera discovery does not request native permission when startup is ${name}`, async () => {
    const h = mount(startData);
    await clickDiscovery(h);
    assert.deepEqual(h.bridgeCalls, []);
    assert.deepEqual(h.actions, ["start"]);
    assert.equal(findNodes(h.render(), (node) => node.type === "p" && node.props.className === "do-help-copy").length, 1);
  });
}

test("an enabled and scoped start preserves the native permission receipt and fallback", async () => {
  const h = mount({ state: "WAITING_FOR_PERMISSION", session_id: sessionId });
  await clickDiscovery(h);
  assert.deepEqual(h.bridgeCalls, [{ sessionId, siteId }]);
  assert.deepEqual(h.actions, ["start", "submit"]);
  assert.equal(findNodes(h.render(), (node) => node.type === "p" && node.props.children === "SYNTHETIC_FALLBACK").length, 1);
});
