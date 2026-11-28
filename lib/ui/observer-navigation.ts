export function isObserverNavActive(activeHref: string, itemHref: string, navHrefs: readonly string[] = [itemHref]) {
  const matches = (href: string) => activeHref === href || activeHref.startsWith(`${href}/`);
  return matches(itemHref) && !navHrefs.some(href => href.length > itemHref.length && matches(href));
}
