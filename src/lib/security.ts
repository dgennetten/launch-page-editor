const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** Only allow http(s) links — blocks javascript:, data:, file:, etc. */
export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}

export function isSafeUrl(url: string): boolean {
  return sanitizeUrl(url) !== null
}
