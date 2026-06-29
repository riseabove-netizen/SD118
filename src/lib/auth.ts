const TOKEN_KEY = 'authToken'
const CREW_NAME_KEY = 'crewName'

export type Role = 'admin' | 'viewer' | 'crew' | 'guest'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getCrewName(): string | null {
  return localStorage.getItem(CREW_NAME_KEY)
}

export function setCrewName(name: string): void {
  localStorage.setItem(CREW_NAME_KEY, name)
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

export function logout(): void {
  clearToken()
}

/**
 * Decode the role out of the auth token's base64 payload.
 * Token format: `${base64('auth:<role>:<timestamp>')}.${hmac}`
 * Falls back to 'crew' for legacy tokens that don't include a role.
 */
export function getRole(): Role {
  const token = getToken()
  if (!token) return 'guest'
  try {
    const [b64] = token.split('.')
    const payload = atob(b64)
    // Expected: auth:<role>:<ts>  (legacy: auth:<ts>)
    const parts = payload.split(':')
    if (parts.length >= 3 && parts[0] === 'auth') {
      const r = parts[1]
      if (r === 'admin' || r === 'viewer' || r === 'crew') return r
    }
    return 'crew' // legacy token
  } catch {
    return 'crew'
  }
}

export function isAdmin(): boolean {
  return getRole() === 'admin'
}

export function isViewer(): boolean {
  return getRole() === 'viewer'
}

export function isGuest(): boolean {
  return getRole() === 'guest'
}

/** Whether the current user is allowed to perform write/submit actions. */
export function canWrite(): boolean {
  const r = getRole()
  return r === 'admin' || r === 'crew'
}

/** Error thrown by the global fetch wrapper when a viewer attempts a write. */
export class ViewOnlyError extends Error {
  constructor() {
    super('View-only password — cannot submit')
    this.name = 'ViewOnlyError'
  }
}
