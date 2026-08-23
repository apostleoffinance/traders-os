self.addEventListener("push", (event) => {
  let data = {
    title: "Trader OS",
    body: "You haven't journaled today.",
    url: "/trades/new",
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Trader OS", {
      body: data.body,
      data: { url: data.url || "/trades/new" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/trades/new", self.location.origin).href;
  event.waitUntil(self.clients.openWindow(target));
});
