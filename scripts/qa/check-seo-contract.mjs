import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const privateLayouts = [
  "app/app/layout.tsx",
  "app/auth/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/forgot-password/layout.tsx",
  "app/invite/layout.tsx",
  "app/login/layout.tsx",
  "app/onboarding/layout.tsx",
  "app/parent-onboarding/layout.tsx",
  "app/register/layout.tsx",
  "app/reset-password/layout.tsx",
];

for (const path of privateLayouts) {
  assert.match(read(path), /privateRouteMetadata/, `${path}: private route must publish noindex metadata`);
}

const privateMetadata = read("lib/seo/private-metadata.ts");
for (const directive of ["index: false", "follow: false", "noarchive: true", "nosnippet: true", "noimageindex: true"]) {
  assert.ok(privateMetadata.includes(directive), `Private metadata missing ${directive}`);
}

const robots = read("app/robots.ts");
assert.match(robots, /disallow:\s*\["\/api\/"\]/, "robots must exclude API routes");
assert.match(robots, /host:\s*SITE_URL/, "robots must declare the canonical host");
for (const route of ["/dashboard", "/app", "/login", "/register", "/onboarding"]) {
  assert.ok(!robots.includes(`\"${route}\"`), `${route}: crawl must remain allowed so bots can read noindex`);
}

const redirect = read("app/kindergarten-directory/page.tsx");
assert.match(redirect, /permanentRedirect\("\/gardens"\)/, "Legacy directory needs a permanent redirect");

const sitemap = read("app/sitemap.ts");
for (const route of ["/dashboard", "/app", "/login", "/register", "/onboarding", "/auth"]) {
  assert.ok(!sitemap.includes(`\"${route}\"`), `Private route leaked into sitemap: ${route}`);
}

const publicGardenFiles = ["app/page.tsx", "app/gardens/page.tsx", "app/join-parent/page.tsx"];
for (const path of publicGardenFiles) {
  assert.ok(!read(path).includes("garden.address"), `${path}: exact garden address must not be rendered publicly`);
}

const profile = read("app/gardens/[id]/page.tsx");
assert.match(profile, /privateRouteMetadata/, "Garden profiles need noindex pending explicit publication consent");
for (const sensitiveQuery of ["from(\"children\")", "from(\"parents\")", "from(\"staff\")", "from(\"inspections\")"]) {
  assert.ok(!profile.includes(sensitiveQuery), `Garden profile must not query ${sensitiveQuery}`);
}

for (const path of ["app/articles/[slug]/page.tsx", "app/digital-observer/guides/[slug]/page.tsx"]) {
  const source = read(path);
  for (const contract of ["datePublished", "dateModified", "author:", "editor:", "mainEntityOfPage", "isAccessibleForFree", "replace(/</g"]) {
    assert.ok(source.includes(contract), `${path}: missing structured editorial field ${contract}`);
  }
  assert.match(source, /<time dateTime=/, `${path}: visible dates need semantic time markup`);
  assert.match(source, /התשובה בקצרה/, `${path}: answer-first summary is missing`);
}

const ganLayout = read("app/layout.tsx");
const observerLayout = read("app/digital-observer/layout.tsx");
assert.match(ganLayout, /ganBatuachShareImage/, "Gan Batuach needs its own share image");
assert.match(observerLayout, /digitalObserverShareImage/, "Digital Observer needs a separate share image");

const globalStates = read("components/global-state-system.tsx");
assert.match(globalStates, /GlobalLoadingState[\s\S]*headingLevel=\{2\}/, "Streaming loading UI must not add a second H1");
assert.match(globalStates, /GlobalEmptyState[\s\S]*headingLevel=\{2\}/, "Embedded empty states must not add a second H1");

console.log(`SEO contract PASS: ${privateLayouts.length} private route groups, privacy-safe garden discovery, permanent canonical redirect, robots/sitemap and editorial schema checks.`);
