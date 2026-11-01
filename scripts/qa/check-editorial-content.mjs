import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = process.cwd();

function loadModule(path, dependencies = {}) {
  const source = readFileSync(join(root, path), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)((id) => dependencies[id] ?? require(id), module, module.exports);
  return module.exports;
}

const enhancements = loadModule("lib/editorial/enhancements.ts");
const gan = loadModule("lib/editorial/articles.ts", { "./enhancements": enhancements }).initialArticles;
const observer = loadModule("lib/editorial/observer-articles.ts").observerArticles;
const articles = [...gan, ...observer];
assert.equal(gan.length, 12, "All 12 Gan guides should be present");
assert.ok(observer.length >= 3, "Observer needs a separate body of guides");
assert.equal(new Set(articles.map((article) => article.slug)).size, articles.length, "Duplicate article slug");
assert.equal(new Set(articles.map((article) => article.image_url)).size, articles.length, "Every hero image must differ");
assert.equal(new Set(articles.map((article) => article.meta_title)).size, articles.length, "Every title must differ");
const allImages = new Set();

for (const article of articles) {
  const images = [...article.body.matchAll(/^!\[([^\]]+)\]\((\/[^\s)]+)\s+"([^"]+)"\)$/gm)];
  assert.ok(images.length >= 1, `${article.slug}: missing supporting image`);
  assert.ok(article.body.split(/^## /m).length >= 4, `${article.slug}: needs at least three practical sections`);
  assert.ok(article.body.replace(/!\[[^\]]+\]\([^)]*\)/g, "").split(/\s+/).length >= 280, `${article.slug}: too short`);
  assert.ok(article.sources.length >= 2 && article.sources.every((source) => source.label && source.url.startsWith("https://")), `${article.slug}: missing official references`);
  assert.ok(article.faqs.length >= 2 && article.image_alt.length > 12, `${article.slug}: missing FAQ or alt text`);
  assert.ok(article.meta_description.length >= 65 && article.meta_description.length <= 180, `${article.slug}: meta description length`);
  for (const image of [article.image_url, ...images.map((match) => match[2])]) {
    assert.ok(!allImages.has(image), `${article.slug}: image reused across articles: ${image}`);
    allImages.add(image);
    const file = join(root, "public", image.slice(1));
    assert.ok(existsSync(file), `${article.slug}: missing ${image}`);
    assert.ok(statSync(file).size < 200_000, `${article.slug}: oversized image ${image}`);
  }
}

console.log(`Editorial QA PASS: ${gan.length} Gan guides, ${observer.length} Observer guides, ${allImages.size} distinct optimized images.`);
