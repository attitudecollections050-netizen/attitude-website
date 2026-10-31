/* Attitude Collections service worker: shows Web Push notifications (new staff work,
   ratings, bonuses) on phones and laptops, even when the site is closed. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Attitude Collections";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    silent: false, // let the phone/laptop play its notification sound
    vibrate: [120, 60, 120],
    data: { url: data.url || "/admin/notifications" },
  };
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Open tabs play the shop's own ding.
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      tabs.forEach((c) => c.postMessage({ type: "push", title, body: options.body, tag: options.tag }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin/notifications", self.location.origin);
  if (url.origin !== self.location.origin) return; // only ever open this site
  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of tabs) {
        if (new URL(c.url).origin === url.origin && "focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(url.href).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
