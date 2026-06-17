const TOKEN_KEY = 'authToken'
const CREW_NAME_KEY = 'crewName'

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