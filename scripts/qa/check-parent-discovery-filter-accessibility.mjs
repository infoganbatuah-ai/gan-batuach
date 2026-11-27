import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../app/dashboard/parent/discover-kindergartens/page.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("parent-discovery.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function attribute(node, name) {
  return node.attributes?.properties.find((item) => ts.isJsxAttribute(item) && item.name.text === name);
}

function literal(attributeNode) {
  return attributeNode?.initializer && ts.isStringLiteral(attributeNode.initializer)
    ? attributeNode.initializer.text.trim() : "";
}

test("every visible Parent garden-discovery filter has an explicit accessible name", () => {
  let filterForm;
  function findForm(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === "form" &&
        literal(attribute(node.openingElement, "className")) === "parent-discovery-search") filterForm = node;
    ts.forEachChild(node, findForm);
  }
  findForm(file);
  assert.ok(filterForm, "the canonical Parent discovery filter form must exist");

  const controls = [];
  function inspect(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(file);
      if ((tag === "input" || tag === "select") && literal(attribute(node, "type")) !== "hidden") {
        controls.push({ name: literal(attribute(node, "name")), label: literal(attribute(node, "aria-label")) });
      }
    }
    ts.forEachChild(node, inspect);
  }
  inspect(filterForm);
  assert.ok(controls.length >= 4, "search, city, age and Child context controls must remain available");
  for (const control of controls) assert.ok(control.label, `${control.name || "filter"} lacks an accessible name`);
});
