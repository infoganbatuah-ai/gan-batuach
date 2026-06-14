export type ProductContext = "gan_batuach" | "digital_observer";

export function isDigitalObserverRoute(pathname: string) {
  return pathname === "/digital-observer" || pathname.startsWith("/digital-observer/");
}

export function isGanBatuachRoute(pathname: string) {
  return !isDigitalObserverRoute(pathname);
}

export function getProductContext(pathname: string): ProductContext {
  return isDigitalObserverRoute(pathname) ? "digital_observer" : "gan_batuach";
}

export function assertDigitalObserverContext(pathname: string) {
  if (!isDigitalObserverRoute(pathname)) {
    throw new Error("Expected Digital Observer product context");
  }
}

export function assertGanBatuachContext(pathname: string) {
  if (!isGanBatuachRoute(pathname)) {
    throw new Error("Expected Gan Batuach product context");
  }
}
