import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join, dirname, isAbsolute } from "node:path";

// Copy only the source inventory verified against the deployed Vercel version.
// Never copy a checkout's .git, caches, environment files or local camera state.
const root="/Users/danielderi/Desktop/text-web-ai-1-rtl-2";
const baseline="/private/tmp/observer-ui-stability-production-baseline";
const stage="/private/tmp/journal-release.T2YtU4";
const target=resolve(process.argv[2] || "");
if(!target.startsWith("/private/tmp/journal-code-release.") || !existsSync(target) || readdirSync(target).length) throw Error("Expected a new, empty journal source directory");
const inventory=JSON.parse(readFileSync(baseline+".inventory.json","utf8"));
if(inventory.deployment!=="dpl_FiUoV2JbyzMCH2KwpXEvX2e5fSuG")throw Error("Unexpected production baseline");
const overlays=new Set([
  "lib/domain/event-engine/event-journal-service.ts", "lib/domain/event-engine/event-validation-pipeline.ts",
  "lib/domain/digital-observer/runtime.ts", "app/digital-observer/alerts/page.tsx", "scripts/qa/check-event-journal.mjs"
]);
function copy(base,path){mkdirSync(dirname(join(target,path)),{recursive:true});copyFileSync(join(base,path),join(target,path));}
for(const file of inventory.files){
  if(isAbsolute(file.path)||file.path.split("/").includes("..")||file.path.split("/").some(part=>part.startsWith(".env")||part===".git"))throw Error("Unsafe source inventory path");
  const digest=createHash("sha1").update(readFileSync(join(baseline,file.path))).digest("hex");
  if(digest!==file.digest)throw Error(`Production source hash mismatch: ${file.path}`);
  copy(overlays.has(file.path)?stage:baseline,file.path);
}
const additions=[
  "lib/domain/digital-observer/guard-event-types.ts", "lib/domain/digital-observer/guard-chat-query.ts", "lib/domain/event-engine/guard-journal-search.ts",
  "scripts/qa/check-guard-journal-search.mjs", "scripts/qa/digital-guard-chat-query.test.mjs", "scripts/qa/digital-guard-test-loader.mjs",
  // Isolated test fixtures only; services/video-gateway remains excluded from upload.
  "services/video-gateway/journal-loop.mjs", "services/video-gateway/journal-tracker.mjs", "services/video-gateway/object-inference-client.mjs"
];
for(const path of additions)copy(root,path);
const project=JSON.parse(readFileSync(join(root,".vercel/project.json"),"utf8"));
if(project.projectId!=="prj_3OyzcFVSdsuxk1D7ivObKhCh2psT")throw Error("Unexpected deployment project");
copy(root,".vercel/project.json");
symlinkSync(join(root,"node_modules"),join(target,"node_modules"));
console.log(JSON.stringify({target,baseline:inventory.deployment,verifiedSourceFiles:inventory.files.length,overlays:[...overlays],additions}));
