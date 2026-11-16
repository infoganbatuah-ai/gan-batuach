function safeNotificationTarget(raw) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin || url.username || url.password ||
        url.hash || url.pathname.startsWith("/api/")) return null;
    const path = url.pathname;
    // This worker is registered by both legacy Gan and Observer web clients.
    return path === "/dashboard" || path.startsWith("/dashboard/") ||
      path === "/parent-onboarding" || path.startsWith("/parent-onboarding/") ||
      path === "/onboarding/kindergarten" || path === "/onboarding/staff" ||
      path === "/digital-observer" || path.startsWith("/digital-observer/")
      ? url.href : null;
  } catch { return null; }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { body: event.data.text() } };
  }
  const message = payload?.data?.FCM_MSG || payload;
  const notification = message.notification || {};
  const title = notification.title || "תצפיתן דיגיטלי";
  const options = {
    body: notification.body || message.data?.body || "התקבלה התראה חדשה.",
    icon: notification.icon || "/assets/digital-observer/app-icon.svg",
    badge: "/assets/digital-observer/app-icon.svg",
    data: {
      url: message.fcmOptions?.link || message.webpush?.fcmOptions?.link || message.data?.link || null
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeNotificationTarget(event.notification.data?.url);
  if (!target) return;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
