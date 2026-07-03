const SESSION_KEY = 'launch-page-admin-session'
const PASSWORD_KEY = 'launch-page-admin-password'

function adminPassword(): string | undefined {
  const value = import.meta.env.VITE_ADMIN_PASSWORD
  return value && value.length > 0 ? value : undefined
}

function sessionToken(password: string): string {
  return btoa(`admin:${password}`)
}

export function isAdminProtectionEnabled(): boolean {
  return adminPassword() !== undefined
}

export function isAdminAuthenticated(): boolean {
  const password = adminPassword()
  if (!password) return import.meta.env.DEV
  return sessionStorage.getItem(SESSION_KEY) === sessionToken(password)
}

export function verifyAdminPassword(candidate: string): boolean {
  const password = adminPassword()
  if (!password) {
    if (import.meta.env.DEV) {
      sessionStorage.setItem(PASSWORD_KEY, candidate)
      return true
    }
    return false
  }

  const valid = candidate === password
  if (valid) {
    sessionStorage.setItem(SESSION_KEY, sessionToken(password))
    sessionStorage.setItem(PASSWORD_KEY, password)
  }
  return valid
}

/** Password from the current admin session, used for publish. */
export function getSessionPassword(): string | undefined {
  const stored = sessionStorage.getItem(PASSWORD_KEY)
  if (stored) return stored
  return adminPassword()
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(PASSWORD_KEY)
}
