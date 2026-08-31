import assert from "node:assert/strict";
import { observerSourceCoverage } from "../../lib/domain/digital-observer/source-coverage.ts";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";
const now = Date.now(), site = "synthetic-site";
const cameras = Array.from({length:20},(_,index)=>({id:`camera-${index}`,observer_site_id:site,display_name:`Name ${index}`,location_label:`Zone ${index}`,status:index<15?"connected":"offline",metadata:{edge_ai_active:true}}));
const events = [
  {observer_site_id:site,metadata:{camera_source_id:"camera-8"},created_at:new Date(now-1000).toISOString()},
  {observer_site_id:site,camera_id:"camera-0",metadata:{camera_source_id:"camera-8"},created_at:new Date(now-2000).toISOString()},
  {observer_site_id:"other",metadata:{camera_source_id:"camera-0"},created_at:new Date(now-1000).toISOString()},
  {observer_site_id:site,metadata:{camera_source_id:"camera-0"},created_at:new Date(now-49*3600000).toISOString()},
  {observer_site_id:site,metadata:{camera_source_id:"camera-0"},created_at:new Date(now+1000).toISOString()},
  {observer_site_id:site,metadata:{event_type:"home_learning_started"},created_at:new Date(now-1000).toISOString()}
];
const rows=observerSourceCoverage(site,[...cameras,{id:"foreign",observer_site_id:"other"}],events,now);
assert.equal(rows.length,20);
assert.equal(rows.filter(r=>r.connection==="offline").length,5);
assert.equal(rows[0].savedRecords,0,"no first-camera attribution of site-wide learning");
assert.equal(rows[8].savedRecords,2);
assert.equal(rows[8].name,"Name 8"); assert.equal(rows[8].zone,"Zone 8");
assert.ok(rows.every(r=>r.analysisState==="not_reported"&&r.lastAnalyzedAt===null));
assert.equal(observerSourceCoverage("other",cameras,events,now).length,0);
const legacyEvent = { observer_site_id:site, camera_id:"legacy-stream", created_at:new Date(now-1000).toISOString() };
const legacySources = [{...cameras[0],camera_stream_id:"legacy-stream"},cameras[8]];
assert.equal(observerSourceCoverage(site,legacySources,[legacyEvent],now)[0].savedRecords,1);
const conflicting = {...legacyEvent,metadata:{camera_source_id:"camera-8"}};
const conflictRows = observerSourceCoverage(site,legacySources,[conflicting],now);
assert.equal(conflictRows[0].savedRecords,0);
assert.equal(conflictRows[1].savedRecords,1);
assert.equal(observerSourceCoverage(site,legacySources,[{...legacyEvent,metadata:{camera_source_id:"unknown"}}],now)[0].savedRecords,0);
const modules={"react/jsx-runtime":jsxRuntime,"next/link":{__esModule:true,default:({children,...props})=>React.createElement("a",props,children)},"lucide-react":icons,
  "@/lib/domain/digital-observer/source-coverage":{observerSourceCoverage},"@/lib/domain/digital-observer/runtime":{formatObserverDate:value=>value}};
const exports={};
runInNewContext(ts.transpileModule(readFileSync("components/digital-observer/observer-source-coverage.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];}});
const render=props=>renderToStaticMarkup(React.createElement(exports.ObserverSourceCoverage,{siteId:site,cameras,signals:events,available:true,limited:false,...props}));
const html=render({limited:true});
assert.equal((html.match(/<article/g)||[]).length,20);
assert.match(html,/רשימת הדיווחים שנטענה חלקית/);
assert.match(html,/Name 8/); assert.match(html,/Zone 8/);
assert.match(html,/site=synthetic-site&amp;camera=camera-8/);
assert.match(html,/ניתוח אחרון: לא דווח/);
assert.equal(render({siteId:"other"}),"");
assert.match(render({available:false}),/דיווחי האירועים לא נטענו/);
assert.doesNotMatch(render({available:false}),/2 דיווחים שנטענו/);
console.log("PASS: all-source event coverage, offline inclusion, names/zones, tenant and time boundaries; no invented analysis or identity");

if (process.argv.includes("--serve")) {
  const { createServer } = await import("node:http");
  const css=readFileSync("app/styles/digital-observer-product.css","utf8");
  const document=`<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Coverage QA</title><style>${css} body{margin:16px;font-family:Arial,sans-serif;color:#253442;background:#fff;--do-border:#dfe5e9;--do-muted:#536371;--do-teal-dark:#176659}*{box-sizing:border-box}</style><h1>בדיקת כיסוי: נתונים סינתטיים</h1>${html}</html>`;
  const server=createServer((request,response)=>{
    if(request.url!=="/"){response.writeHead(404);response.end();return;}
    response.writeHead(200,{"content-type":"text/html;charset=utf-8","cache-control":"no-store"});response.end(document);
  });
  server.listen(0,"127.0.0.1",()=>console.log(`Coverage fixture: http://127.0.0.1:${server.address().port}/`));
  for(const signal of ["SIGTERM","SIGINT"])process.on(signal,()=>server.close(()=>process.exit(0)));
}
