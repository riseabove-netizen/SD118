// Web Push helpers — service worker registration, subscription lifecycle, and
// iOS PWA detection. Public VAPID key is exposed at build time via
// VITE_VAPID_PUBLIC_KEY, otherwise we fetch it from /api/push-public-key.

const VAPID_PUBLIC_KEY_FALLBACK = 'BOuu2cUFTSCn2ImXCR9gGH42kDIZScEE0umzVw3s5srSNkoU0y2Be0CBgkupQ3AMA8W5i1iVN2Oc0UW2WnICpYY'

function b64UrlToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const clean = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(clean)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  return isIOS
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS uses navigator.standalone; modern browsers use display-mode: standalone.
  return (window.navigator as any).standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Service workers not supported')
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready
  return reg
}

export async function subscribeToPush(name: string): Promise<PushSubscription> {
  const reg = await registerServiceWorker()
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notification permission denied')

  const publicKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY_FALLBACK

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const keyBytes = b64UrlToUint8Array(publicKey)
    // Copy into a fresh ArrayBuffer to satisfy the BufferSource type when the
    // source may be backed by a SharedArrayBuffer.
    const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBuf,
    })
  }
  const json = sub.toJSON()
  const resp = await fetch('/api/anchor-notify?op=subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, subscription: json, action: 'subscribe' }),
  })
  if (!resp.ok) throw new Error(`Server rejected subscription: ${resp.status}`)
  return sub
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  try {
    await fetch('/api/anchor-notify?op=subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), action: 'unsubscribe' }),
    })
  } catch { /* best-effort */ }
  await sub.unsubscribe()
}

export async function getSubscriptionState(): Promise<{ subscribed: boolean; permission: NotificationPermission }> {
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default'
  if (!pushSupported()) return { subscribed: false, permission }
  const reg = await navigator.serviceWorker.getRegistration('/')
  if (!reg) return { subscribed: false, permission }
  const sub = await reg.pushManager.getSubscription()
  return { subscribed: !!sub, permission }
}
