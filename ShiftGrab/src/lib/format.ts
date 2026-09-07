export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatBytes(bytes?: number): string {
  if (bytes == null || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function startOfWeek(d = new Date()): Date {
  const x = new Date(d)
  const day = x.getDay()
  const diff = (day + 6) % 7
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - diff)
  return x
}

/** Short user-facing errors (strip Electron IPC wrappers + DNS dumps). */
export function formatAppError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '')
  const scrubbed = raw
    .replace(/Error invoking remote method '[^']+':\s*/gi, '')
    .replace(/^Error:\s*/i, '')
  if (
    /getaddrinfo failed|ENOTFOUND|Failed to resolve|EAI_AGAIN|Name or service not known/i.test(
      scrubbed,
    )
  ) {
    return 'No internet (DNS failed). Connect Wi‑Fi/Ethernet and try again.'
  }
  if (/ENETUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network is unreachable/i.test(scrubbed)) {
    return 'No internet connection. ShiftGrab needs the web to fetch video info.'
  }
  if (/Sign in to confirm you(?:'re| are) not a bot|YouTube wants a login/i.test(scrubbed)) {
    return 'YouTube wants a login. Open Settings → Sign in to YouTube.'
  }
  if (
    /Playlists that require authentication|successful webpage download|Unable to download webpage|channel does not exist|does not exist|HTTP Error 404|Unsupported URL|Unable to extract|youtube:tab|Wrong link or this channel|not a valid URL|Incomplete YouTube ID/i.test(
      scrubbed,
    )
  ) {
    return 'Wrong link or this channel isn’t available. Check the URL and try again.'
  }
  if (/Requested format is not available/i.test(scrubbed)) {
    return 'This quality isn’t available. Try Best quality or another link.'
  }
  // Never dump engine/tab prefixes into the UI
  const cleaned = scrubbed
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const last = lines.slice(-1)[0] || 'Something went wrong.'
  return last.length > 120 ? `${last.slice(0, 117)}…` : last
}
