const observerAccessTokenKey = "digital_observer_session_access";

export function rememberObserverAccessToken(accessToken?: string | null) {
  if (typeof window === "undefined" || !accessToken) return;
  window.sessionStorage.setItem(observerAccessTokenKey, accessToken);
}

export function readObserverAccessToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(observerAccessTokenKey);
}

export function forgetObserverAccessToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(observerAccessTokenKey);
}
