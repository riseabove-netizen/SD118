// Global fetch guard: blocks writes from view-only users.
// Installed at app startup so EVERY write through fetch goes through the gate,
// with zero per-page changes.

import { isViewer } from './auth'

let installed = false

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Specific endpoints viewers are allowed to call even though they're POSTs
// (login + read-only RPCs). Anything not in here that mutates is blocked.
const VIEWER_ALLOW = [
  /\/api\/auth(\?|$)/,                            // login itself
  /\/api\/extract(\?|$)/,                         // image extraction — read-only AI call, no DB write
  /\/api\/trips\?action=notes-add(\?|&|$)/,       // trip notes — anyone can add
  /\/api\/trips\?action=notes-update(\?|&|$)/,    // trip notes — author can edit own (server-enforced)
]

function isAllowed(url: string): boolean {
  return VIEWER_ALLOW.some(re => re.test(url))
}

export function installViewerGuard(): void {
  if (installed) return
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const method = (init?.method || (typeof input !== 'string' && 'method' in (input as Request) ? (input as Request).method : 'GET') || 'GET').toUpperCase()
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url

      // Only gate same-origin /api/* writes for viewers
      if (
        WRITE_METHODS.has(method) &&
        isViewer() &&
        url.includes('/api/') &&
        !isAllowed(url)
      ) {
        // Return a Response so callers' standard error path triggers
        // with the friendly message.
        const body = JSON.stringify({
          error: 'View-only password — cannot submit',
          detail: 'You are signed in with the view-only access code. Sign out and sign back in with the crew or admin code to make changes.',
        })
        return Promise.resolve(
          new Response(body, {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      }
    } catch {
      // If anything in the guard breaks, fall through to real fetch.
    }
    return originalFetch(input as any, init)
  }
}
