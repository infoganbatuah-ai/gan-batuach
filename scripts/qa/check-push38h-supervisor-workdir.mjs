import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
assert.match(runner, /const workdir = fileURLToPath\(new URL\("\.\.\/", import\.meta\.url\)\)/);
assert.match(runner, /cwd: workdir/);
console.log(JSON.stringify({ status: "PASS", regression: "packaged_supervisor_workdir_defined" }));
