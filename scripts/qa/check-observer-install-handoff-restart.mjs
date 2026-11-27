import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../components/digital-observer/connector-install-handoff.tsx", import.meta.url), "utf8");
const script = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const installerPath = "/api/digital-observer/connector-installation";

function mount(stage, { installerAvailable = true, lateStatus } = {}) {
  const slots = [];
  const actions = [];
  const timers = [];
  let poll;
  let statusCount = 0;
  const shared = [];
  const redirects = [];
  let online = 0;
  let index = 0;
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      useState(initial) {
        const slot = index++;
        if (!(slot in slots)) slots[slot] = initial;
        return [slots[slot], (value) => { slots[slot] = value; }];
      },
      useCallback: (callback) => callback,
      useRef: (current) => slots[index++] ??= { current },
      useEffect: (effect) => effect()
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/lib/domain/digital-observer/client-session": { readObserverAccessToken: () => null },
    "@/lib/domain/digital-observer/connector-installation": { installerPlatform: () => "MOBILE" }
  };
  const exports = {};
  runInNewContext(script, {
    exports, URL, File,
    window: { location: { href: "https://qa.invalid/digital-observer/cameras/add?install_intent=old" }, open: () => {} },
    history: { replaceState: (_state, _title, url) => redirects.push(url.searchParams.get("install_intent")) },
    navigator: { userAgent: "Synthetic Mobile", canShare: () => true, share: async ({ files }) => { shared.push(files[0].name); } },
    document: { hidden: false },
    setTimeout: (callback) => timers.push(callback), setInterval: (callback) => { poll = callback; },
    clearTimeout: () => {}, clearInterval: () => {},
    require(name) {
      assert.ok(Object.hasOwn(modules, name), name);
      return modules[name];
    },
    async fetch(url, options) {
      if (url.startsWith(`${installerPath}?action=manifest`)) {
        actions.push("manifest");
        return { ok: true, json: async () => ({ data: { available: installerAvailable, download_path: "/synthetic-installer" } }) };
      }
      assert.equal(url, installerPath);
      const body = JSON.parse(options.body);
      assert.equal(body.observer_site_id, "site-a");
      actions.push(body.action);
      if (body.action === "create") {
        return { ok: true, json: async () => ({ data: { document: { intent_id: "new" } } }) };
      }
      assert.equal(body.action, "status");
      assert.equal(body.intent_id, "old");
      statusCount++;
      return { ok: true, json: async () => ({ data: {
        stage: statusCount > 1 && lateStatus ? await lateStatus : stage,
        enrollment_id: null
      } }) };
    }
  }, { timeout: 1000 });
  return {
    render() {
      index = 0;
      return exports.ConnectorInstallHandoff({ siteId: "site-a", family: "unknown", initialIntent: "old", onOnline: () => online++ });
    },
    runFirstPoll: () => timers.shift()(),
    runInterval: () => poll(),
    actions, shared, redirects, get online() { return online; }
  };
}

function findNodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => findNodes(child, predicate));
  if (!node || typeof node !== "object") return [];
  return [...(predicate(node) ? [node] : []), ...findNodes(node.props.children, predicate)];
}

const buttons = (tree, label) => findNodes(tree, (node) => node.type === "button" && node.props.children === label);
const drain = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };

for (const stage of ["REVOKED", "EXPIRED"]) {
  test(`mobile handoff can replace a request in ${stage} with a fresh one`, async () => {
    const h = mount(stage);
    h.render();
    h.runFirstPoll();
    await drain();
    const [send] = buttons(h.render(), "שליחה ל‑Mac");
    assert.ok(send && !send.props.disabled, "terminal request must offer a fresh handoff");
    send.props.onClick();
    await drain();
    assert.deepEqual(h.actions, ["status", "manifest", "create"]);
    assert.deepEqual(h.shared, ["Digital Observer.observer-connect"]);
    assert.deepEqual(h.redirects, ["new"]);
    assert.equal(h.online, 0);
    const current = h.render();
    assert.equal(buttons(current, "שליחה ל‑Mac").length, 0, "old terminal status must not outlive replacement");
    assert.equal(findNodes(current, (node) => node.type === "p" && node.props.children === "מחכים לרכיב החיבור…").length, 1);
  });
}

test("an unavailable installer leaves the revoked handoff eligible for retry", async () => {
  const h = mount("REVOKED", { installerAvailable: false });
  h.render();
  h.runFirstPoll();
  await drain();
  buttons(h.render(), "שליחה ל‑Mac")[0].props.onClick();
  await drain();
  assert.deepEqual(h.actions, ["status", "manifest"]);
  assert.deepEqual(h.shared, []);
  assert.equal(buttons(h.render(), "שליחה ל‑Mac")[0].props.disabled, false);
});

test("late status from the replaced handoff cannot mark the old computer connected", async () => {
  const late = Promise.withResolvers();
  const h = mount("EXPIRED", { lateStatus: late.promise });
  h.render();
  h.runFirstPoll();
  await drain();
  const [send] = buttons(h.render(), "שליחה ל‑Mac");
  h.runInterval();
  await drain();
  send.props.onClick();
  await drain();
  assert.deepEqual(h.actions, ["status", "status", "manifest", "create"]);
  late.resolve("CONNECTOR_FOUND");
  await drain();
  assert.equal(h.online, 0);
  assert.equal(findNodes(h.render(), (node) => node.type === "p" && node.props.children === "מחכים לרכיב החיבור…").length, 1);
});
