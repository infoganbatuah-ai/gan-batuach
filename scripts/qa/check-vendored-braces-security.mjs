import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const project = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const vendorPackage = JSON.parse(readFileSync("vendor/braces/package.json", "utf8"));
const parser = readFileSync("vendor/braces/lib/parse.js", "utf8");
const compiler = readFileSync("vendor/braces/lib/compile.js", "utf8");

assert.equal(project.devDependencies.braces, "file:vendor/braces");
assert.equal(project.overrides.braces, "$braces");
assert.equal(lock.packages["node_modules/braces"].resolved, "vendor/braces");
assert.equal(lock.packages["vendor/braces"].version, "3.0.4-gan-batuach.0");
assert.equal(vendorPackage.version, "3.0.4-gan-batuach.0");
assert.match(parser, /Brace nesting depth exceeds maximum/);
assert.doesNotMatch(compiler, /console\.log/);

const braces = require("braces");
assert.equal(require("braces/package.json").version, "3.0.4-gan-batuach.0");
assert.deepEqual(braces("{a,b}"), ["(a|b)"]);

const nested = (depth) => "{".repeat(depth) + "x" + "}".repeat(depth);
assert.throws(() => braces(nested(101)), {
  name: "RangeError",
  message: "Brace nesting depth exceeds maximum of 100",
});
assert.throws(() => braces.expand(nested(101)), {
  name: "RangeError",
  message: "Brace nesting depth exceeds maximum of 100",
});
assert.throws(() => braces(nested(1001), { maxDepth: 100000 }), {
  name: "RangeError",
  message: "Brace nesting depth exceeds maximum of 1000",
});

console.log("Vendored braces depth guard PASS");
