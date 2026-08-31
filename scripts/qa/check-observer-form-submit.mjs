import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.createSourceFile("forms.tsx", readFileSync("components/digital-observer/observer-action-forms.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

for (const name of ["ObserverKnownPersonForm", "ObserverRuleForm"]) {
  const component = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const handler = component?.body?.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "submit");
  assert.ok(handler, `${name} must have a submit handler`);
  for (const succeeds of [true, false]) {
    const states = [], requests = [];
    let resets = 0, refreshes = 0, finish;
    const form = { reset: () => { resets++; } };
    const event = { currentTarget: form, preventDefault() {} };
    const exports = {};
    const compiled = ts.transpileModule(`${handler.getText(source)}\nexports.submit = submit;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(compiled, { exports, Error, siteId: "synthetic-site", setState: (state) => states.push(state), router: { refresh: () => { refreshes++; } },
      FormData: class {
        constructor(element) { assert.equal(element, form); }
        get(key) { return key === "consent" ? "on" : key === "priority" ? "5" : "synthetic"; }
        getAll() { return ["synthetic-camera"]; }
      },
      postJson: (endpoint, body) => { requests.push({ endpoint, body }); return new Promise((resolve, reject) => {
        finish = () => succeeds ? resolve({ message: "saved" }) : reject(new Error("synthetic_request_failed"));
      }); }
    });
    const pending = exports.submit(event);
    // React clears currentTarget after event dispatch, before the request resolves.
    event.currentTarget = null;
    assert.equal(states.at(-1).busy, true);
    finish();
    await pending;
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body.observer_site_id, "synthetic-site");
    assert.equal(resets, Number(succeeds));
    assert.equal(refreshes, Number(succeeds));
    assert.equal(states.at(-1).busy, false);
    assert.equal(states.at(-1).message, succeeds ? "saved" : "");
    assert.equal(states.at(-1).error, succeeds ? "" : "synthetic_request_failed");
    if (name === "ObserverKnownPersonForm") {
      assert.equal(requests[0].body.consent_confirmed, true);
      assert.deepEqual(Array.from(requests[0].body.camera_source_ids), ["synthetic-camera"]);
    }
  }
}
console.log("Observer form submit QA PASS: successful async saves reset once; failures retain input; no real requests");
