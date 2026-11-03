import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

function sameOriginUrl(href, baseUrl) {
  assert.ok(typeof href === "string" && href.length > 0, "Child link is missing");
  const base = new URL(baseUrl);
  const url = new URL(href, base);
  assert.equal(url.origin, base.origin, "Child link leaves the capture origin");
  assert.equal(url.hash, "", "Child link has an unexpected fragment");
  return url;
}

export function parentChildIdFromHref(href, baseUrl) {
  const url = sameOriginUrl(href, baseUrl);
  assert.equal(url.pathname, "/dashboard/parent", "Child selector leaves the Parent dashboard");
  assert.deepEqual([...url.searchParams.keys()], ["child"], "Child selector has unexpected or duplicate parameters");
  const id = url.searchParams.get("child");
  assert.ok(id && id.trim() === id, "Child selector has an empty or malformed child ID");
  return id;
}

export function isExpectedChildDashboardUrl(href, baseUrl, expectedId) {
  try {
    return parentChildIdFromHref(href, baseUrl) === expectedId;
  } catch {
    return false;
  }
}

function primaryChildIdFromHref(href, baseUrl) {
  const url = sameOriginUrl(href, baseUrl);
  assert.equal(url.search, "", "Primary Child profile link has unexpected parameters");
  const match = /^\/dashboard\/parent\/children\/([^/]+)$/.exec(url.pathname);
  assert.ok(match, "Primary Child profile link has the wrong route");
  const id = decodeURIComponent(match[1]);
  assert.ok(id && id.trim() === id && !id.includes("/"), "Primary Child profile link has a malformed child ID");
  return id;
}

function soleActiveId(cards, baseUrl) {
  assert.ok(Array.isArray(cards) && cards.length === 1, "Exactly one Child card must be active");
  assert.equal(cards[0].ariaCurrent, "page", "Active Child card must identify the current page");
  return parentChildIdFromHref(cards[0].href, baseUrl);
}

export function requireChildSwitchTarget({ baseUrl, previousId, previousActiveCards, targetHref }) {
  assert.ok(typeof previousId === "string" && previousId.length > 0, "Selected Child ID is missing before switching");
  assert.equal(soleActiveId(previousActiveCards, baseUrl), previousId, "Selected Child ID and active card disagree before switching");
  const expectedId = parentChildIdFromHref(targetHref, baseUrl);
  assert.notEqual(expectedId, previousId, "Child switch target is already selected");
  return expectedId;
}

export function assertChildSwitchCommitted({ baseUrl, expectedId, actualUrl, selectedId, activeCards, primaryHref }) {
  assert.ok(typeof expectedId === "string" && expectedId.length > 0, "Expected Child ID is missing");
  assert.equal(parentChildIdFromHref(actualUrl, baseUrl), expectedId, "Parent dashboard URL selected the wrong Child");
  assert.equal(selectedId, expectedId, "Parent dashboard hidden Child context is stale");
  assert.equal(soleActiveId(activeCards, baseUrl), expectedId, "Active Child card did not follow the selected context");
  assert.equal(primaryChildIdFromHref(primaryHref, baseUrl), expectedId, "Primary Child content points to another Child");
  return expectedId;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { test } = await import("node:test");
  const baseUrl = "http://127.0.0.1:3200";
  const card = (id) => ({ href: `/dashboard/parent?child=${id}`, ariaCurrent: "page" });
  const committed = (overrides = {}) => ({
    baseUrl,
    expectedId: "child-b",
    actualUrl: `${baseUrl}/dashboard/parent?child=child-b`,
    selectedId: "child-b",
    activeCards: [card("child-b")],
    primaryHref: "/dashboard/parent/children/child-b",
    ...overrides,
  });

  test("same display names do not affect an authorized ID switch", () => {
    const previousName = "נועם כהן";
    const nextName = "נועם כהן";
    assert.equal(previousName, nextName);
    assert.equal(requireChildSwitchTarget({ baseUrl, previousId: "child-a", previousActiveCards: [card("child-a")], targetHref: "/dashboard/parent?child=child-b" }), "child-b");
    assert.equal(assertChildSwitchCommitted(committed()), "child-b");
  });
  test("navigation matcher waits through the initial and previous Child URLs", () => {
    assert.equal(isExpectedChildDashboardUrl(`${baseUrl}/dashboard/parent`, baseUrl, "child-b"), false);
    assert.equal(isExpectedChildDashboardUrl(`${baseUrl}/dashboard/parent?child=child-a`, baseUrl, "child-b"), false);
    assert.equal(isExpectedChildDashboardUrl(`${baseUrl}/dashboard/parent?child=child-b`, baseUrl, "child-b"), true);
    assert.equal(isExpectedChildDashboardUrl("https://other.invalid/dashboard/parent?child=child-b", baseUrl, "child-b"), false);
  });
  test("stale selected ID is refused", () => assert.throws(() => assertChildSwitchCommitted(committed({ selectedId: "child-a" }))));
  test("wrong URL Child ID is refused", () => assert.throws(() => assertChildSwitchCommitted(committed({ actualUrl: `${baseUrl}/dashboard/parent?child=child-a` }))));
  test("wrong, duplicate, or non-current active cards are refused", () => {
    for (const activeCards of [[card("child-a")], [card("child-b"), card("child-a")], [{ ...card("child-b"), ariaCurrent: null }]]) {
      assert.throws(() => assertChildSwitchCommitted(committed({ activeCards })));
    }
  });
  test("primary content for another Child is refused", () => assert.throws(() => assertChildSwitchCommitted(committed({ primaryHref: "/dashboard/parent/children/child-a" }))));
  test("empty, duplicate, or missing child query is refused", () => {
    for (const href of ["/dashboard/parent?child=", "/dashboard/parent", "/dashboard/parent?child=child-b&child=child-a"]) {
      assert.throws(() => parentChildIdFromHref(href, baseUrl));
    }
  });
  test("foreign route, origin, and path-prefix escape are refused", () => {
    for (const href of ["/dashboard/parenting?child=child-b", "https://other.invalid/dashboard/parent?child=child-b", "/dashboard/parent/extra?child=child-b"]) {
      assert.throws(() => parentChildIdFromHref(href, baseUrl));
    }
  });
  test("stale pre-switch card and same-ID target are refused", () => {
    assert.throws(() => requireChildSwitchTarget({ baseUrl, previousId: "child-a", previousActiveCards: [card("child-b")], targetHref: "/dashboard/parent?child=child-b" }));
    assert.throws(() => requireChildSwitchTarget({ baseUrl, previousId: "child-a", previousActiveCards: [card("child-a")], targetHref: "/dashboard/parent?child=child-a" }));
  });
}
