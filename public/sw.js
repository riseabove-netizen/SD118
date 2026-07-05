// M/Y Rise Above — service worker
// Handles push notifications from /api/watch-cron and focuses the anchor watch tab on click.

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) {
    data = { title: 'Rise Above', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'M/Y Rise Above'
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'anchor-watch',
    renotify: true,
    requireInteraction: !!data.requireInteraction,
    data: {
      url: data.url || '/ism/anchor-watch',
    },
    vibrate: [200, 100, 200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/ism/anchor-watch'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          w.navigate(targetUrl).catch(() => {})
          return w.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
