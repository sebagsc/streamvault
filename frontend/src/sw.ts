/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: {
    title?: string;
    body?: string;
    url?: string;
    eventId?: string;
    channelName?: string;
  };

  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'StreamVault', body: event.data.text() };
  }

  const title = payload.title ?? 'StreamVault';
  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: payload.eventId ?? 'iptv-notification',
    data: { url: payload.url ?? '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(url);
            }
            return;
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

export {};
