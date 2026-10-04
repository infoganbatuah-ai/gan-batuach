import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const braces = require("braces");
const compile = require("braces/lib/compile");
const expand = require("braces/lib/expand");
const stringify = require("braces/lib/stringify");

function nestedPattern(depth) {
  return `${"{".repeat(depth)}a,b${"}".repeat(depth)}`;
}

function nestedAst(depth) {
  let ast = { type: "text", value: "a" };
  for (let index = 0; index < depth; index += 1) {
    ast = { type: "brace", nodes: [ast] };
  }
  return { type: "root", nodes: [ast] };
}

assert.throws(() => braces(nestedPattern(101)), /exceeds max depth/,
  "deep string input must be rejected before recursive AST walking");
assert.doesNotThrow(() => braces(nestedPattern(100)),
  "the documented safe boundary must remain usable");
assert.throws(() => braces(nestedPattern(3), { maxDepth: 2 }), /exceeds max depth/,
  "callers may select a stricter boundary");
assert.throws(() => braces(nestedPattern(101), { maxDepth: 1_000 }), /exceeds max depth/,
  "callers cannot raise the boundary above the safe maximum");

for (const [name, operation] of [
  ["compile", compile],
  ["expand", expand],
  ["stringify", stringify]
]) {
  assert.throws(() => operation(nestedAst(101)), /exceeds max depth/,
    `${name} must reject a caller-supplied deep AST`);
}

assert.deepEqual(braces("a/{b,c}/d", { expand: true }), ["a/b/d", "a/c/d"],
  "ordinary expansion behavior must remain unchanged");
assert.deepEqual(braces(["{01..03}", "{a..c}"]), ["(0[1-3])", "([a-c])"],
  "ordinary optimized range behavior must remain unchanged");

console.log("braces CVE-2026-93687 depth backport QA: PASS");
