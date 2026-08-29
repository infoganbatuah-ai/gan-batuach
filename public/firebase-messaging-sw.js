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
      url: message.fcmOptions?.link || message.webpush?.fcmOptions?.link || message.data?.link || "/digital-observer/alerts"
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/digital-observer/alerts", self.location.origin).toString();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
