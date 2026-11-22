export function isObserverNavActive(activeHref: string, itemHref: string) {
  return activeHref === itemHref || activeHref.startsWith(`${itemHref}/`);
}
