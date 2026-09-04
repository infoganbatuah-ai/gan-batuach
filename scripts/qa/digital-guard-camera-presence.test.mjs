import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { ObserverCameraPresence } = loadTs("components/digital-observer/observer-camera-presence.tsx", {
  "next/image": () => null
});

for (const [name, props, label] of [
  ["unspecified", {}, "חיבור לא מאומת"],
  ["reported video connection", { active: true }, "חיבור וידאו מדווח"],
  ["unverified video connection", { active: false }, "חיבור לא מאומת"]
]) test(`${name} never claims active AI protection or infers the analysis engine is disabled`, () => {
  const markup = renderToStaticMarkup(createElement(ObserverCameraPresence, props));
  assert.ok(markup.includes(label));
  assert.doesNotMatch(markup, /תצפיתן פעיל|תצפיתן כבוי|התצפיתן הדיגיטלי פעיל|התצפיתן הדיגיטלי כבוי/);
  if (props.active !== true) assert.ok(!markup.includes('presence active'));
});
