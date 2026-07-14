const SESSION_KEY = 'launch-page-admin-session'
const PASSWORD_KEY = 'launch-page-admin-password'

function adminPassword(): string | undefined {
  const value = import.meta.env.VITE_ADMIN_PASSWORD
  return value && value.length > 0 ? value : undefined
}

function sessionToken(password: string): string {
  return btoa(`admin:${password}`)
}

/** Read a key from either persistent (remembered device) or session storage. */
function readStored(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key)
}

function clearStored(key: string): void {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

export function isAdminProtectionEnabled(): boolean {
  return adminPassword() !== undefined
}

export function isAdminAuthenticated(): boolean {
  const password = adminPassword()
  if (!password) return import.meta.env.DEV
  return readStored(SESSION_KEY) === sessionToken(password)
}

export function verifyAdminPassword(candidate: string, remember = false): boolean {
  const store = remember ? localStorage : sessionStorage

  const password = adminPassword()
  if (!password) {
    if (import.meta.env.DEV) {
      store.setItem(PASSWORD_KEY, candidate)
      return true
    }
    return false
  }

  const valid = candidate === password
  if (valid) {
    // Clear any prior credentials so we don't leave a stale copy in the other store.
    clearStored(SESSION_KEY)
    clearStored(PASSWORD_KEY)
    store.setItem(SESSION_KEY, sessionToken(password))
    store.setItem(PASSWORD_KEY, password)
  }
  return valid
}

/** Password from the current admin session, used for publish. */
export function getSessionPassword(): string | undefined {
  const stored = readStored(PASSWORD_KEY)
  if (stored) return stored
  return adminPassword()
}

export function clearAdminSession(): void {
  clearStored(SESSION_KEY)
  clearStored(PASSWORD_KEY)
}
